import "server-only";

import {
  currency,
  paypalApiBase,
  paypalClientId,
  paypalClientSecret,
  paypalWebhookId,
} from "@/lib/env";

/**
 * Thin wrapper over the PayPal Orders v2 REST API. No SDK — the surface we
 * need is three calls, and this keeps the dependency footprint small.
 */

interface CachedToken {
  value: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const credentials = Buffer.from(
    `${paypalClientId()}:${paypalClientSecret()}`,
  ).toString("base64");

  const response = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `PayPal auth failed (${response.status}). Check PAYPAL_CLIENT_SECRET and PAYPAL_ENV.`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.value;
}

async function paypalFetch<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const { idempotencyKey, ...requestInit } = init;
  const token = await getAccessToken();

  const response = await fetch(`${paypalApiBase()}${path}`, {
    ...requestInit,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}),
      ...requestInit.headers,
    },
    cache: "no-store",
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const detail =
      (body as { message?: string }).message ?? `PayPal error ${response.status}`;
    throw new Error(detail);
  }

  return body as T;
}

export interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: Array<{
    custom_id?: string;
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: { value: string; currency_code: string };
      }>;
    };
  }>;
}

/**
 * Creates an order for a fixed amount. The amount always comes from the
 * invoice row on the server — never from the browser.
 */
export async function createPayPalOrder(options: {
  amount: number;
  invoiceId: string;
  invoiceNumber: string;
  description?: string;
}): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: options.invoiceId,
          // custom_id is echoed back on webhook events, which is how an
          // asynchronous capture gets matched to the right invoice.
          custom_id: options.invoiceId,
          description: (
            options.description ?? `Invoice ${options.invoiceNumber}`
          ).slice(0, 127),
          amount: {
            currency_code: currency(),
            value: options.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    }),
  });
}

export async function capturePayPalOrder(
  orderId: string,
): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    body: "{}",
    // Replaying the same capture returns the original result rather than
    // charging twice.
    idempotencyKey: `capture-${orderId}`,
  });
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(`/v2/checkout/orders/${orderId}`, {
    method: "GET",
  });
}

/** Pulls the completed capture (id + amount) out of an order response. */
export function extractCapture(order: PayPalOrder) {
  for (const unit of order.purchase_units ?? []) {
    for (const capture of unit.payments?.captures ?? []) {
      if (capture.status === "COMPLETED") {
        return {
          id: capture.id,
          amount: Number(capture.amount?.value ?? 0),
          invoiceId: unit.custom_id ?? null,
        };
      }
    }
  }
  return null;
}

export interface WebhookHeaders {
  transmissionId: string;
  transmissionTime: string;
  transmissionSig: string;
  certUrl: string;
  authAlgo: string;
}

/**
 * Asks PayPal to verify the signature on a webhook delivery. Without this, the
 * endpoint would accept any POST claiming an invoice was paid.
 */
export async function verifyWebhookSignature(
  headers: WebhookHeaders,
  event: unknown,
): Promise<boolean> {
  try {
    const result = await paypalFetch<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          transmission_id: headers.transmissionId,
          transmission_time: headers.transmissionTime,
          cert_url: headers.certUrl,
          auth_algo: headers.authAlgo,
          transmission_sig: headers.transmissionSig,
          webhook_id: paypalWebhookId(),
          webhook_event: event,
        }),
      },
    );

    return result.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}
