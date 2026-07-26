import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { verifyWebhookSignature } from "@/lib/paypal";
import { recordInvoicePayment } from "@/lib/payments";

interface CaptureCompletedResource {
  id?: string;
  custom_id?: string;
  amount?: { value?: string };
  supplementary_data?: { related_ids?: { order_id?: string } };
}

/**
 * PayPal's server-to-server confirmation of a payment.
 *
 * This is the authoritative path: it still lands even if the payer closes the
 * tab mid-checkout, so an invoice can't be left unpaid-looking after the money
 * has actually moved. Every delivery is signature-verified before it is
 * trusted, and recording is idempotent with the browser capture route.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const headers = {
    transmissionId: request.headers.get("paypal-transmission-id") ?? "",
    transmissionTime: request.headers.get("paypal-transmission-time") ?? "",
    transmissionSig: request.headers.get("paypal-transmission-sig") ?? "",
    certUrl: request.headers.get("paypal-cert-url") ?? "",
    authAlgo: request.headers.get("paypal-auth-algo") ?? "",
  };

  if (Object.values(headers).some((value) => !value)) {
    return NextResponse.json({ error: "Missing signature headers." }, { status: 400 });
  }

  let event: { event_type?: string; resource?: CaptureCompletedResource };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const verified = await verifyWebhookSignature(headers, event);
  if (!verified) {
    console.warn("Rejected PayPal webhook with an invalid signature");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
    // Acknowledge everything else so PayPal stops retrying it.
    return NextResponse.json({ received: true });
  }

  const resource = event.resource ?? {};
  const invoiceId = resource.custom_id;
  const transactionId = resource.id;
  const amount = Number(resource.amount?.value ?? 0);

  if (!invoiceId || !transactionId || !Number.isFinite(amount)) {
    console.warn("PayPal capture event missing invoice linkage", { transactionId });
    return NextResponse.json({ received: true });
  }

  const result = await recordInvoicePayment({
    invoiceId,
    amount,
    transactionId,
    orderId: resource.supplementary_data?.related_ids?.order_id ?? null,
  });

  if (result.status === "error") {
    // A non-2xx tells PayPal to retry, which is what we want here.
    console.error("Failed to record webhook payment", result.message);
    return NextResponse.json({ error: "Could not record payment." }, { status: 500 });
  }

  if (result.status === "recorded") {
    revalidatePath("/portal");
    revalidatePath("/admin");
    revalidatePath(`/admin/invoices/${result.invoiceId}`);
    revalidatePath(`/portal/invoices/${result.invoiceId}`);
  }

  return NextResponse.json({ received: true });
}
