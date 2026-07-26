import "server-only";

import {
  emailFrom,
  emailReplyTo,
  isEmailConfigured,
  resendApiKey,
} from "@/lib/env";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmailResult =
  | { status: "sent"; id: string | null }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Sends one transactional email through Resend.
 *
 * Never throws. Email is a side effect of an action that has already
 * succeeded — an invoice is marked sent, a payment is recorded — and losing
 * the notification must not roll that back or surface as a failure. Callers
 * decide whether to surface the result; failures are always logged.
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { status: "skipped", reason: "email is not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        ...(emailReplyTo() ? { reply_to: emailReplyTo() } : {}),
      }),
      cache: "no-store",
    });

    const body = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };

    if (!response.ok) {
      const error = body.message ?? `provider returned ${response.status}`;
      console.error("Email send failed", { to: options.to, error });
      return { status: "failed", error };
    }

    return { status: "sent", id: body.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("Email send threw", { to: options.to, message });
    return { status: "failed", error: message };
  }
}
