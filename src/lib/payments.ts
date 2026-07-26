import "server-only";

import { sendPaymentNotifications } from "@/lib/email/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export type RecordPaymentResult =
  | { status: "recorded"; invoiceId: string }
  | { status: "already_recorded"; invoiceId: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

/**
 * Writes a confirmed PayPal capture onto an invoice.
 *
 * Uses the service-role client because the caller is either PayPal (webhook,
 * no session at all) or a client who deliberately has no UPDATE policy on
 * invoices — payment state must never be writable from the browser.
 *
 * Safe to call more than once for the same capture: the capture/webhook races
 * are expected, and both paths land here.
 */
export async function recordInvoicePayment(options: {
  invoiceId: string;
  amount: number;
  transactionId: string;
  orderId?: string | null;
}): Promise<RecordPaymentResult> {
  const admin = createAdminClient();

  const { data: invoice, error } = await admin
    .from("invoices")
    .select("id, total, amount_paid, status, paypal_transaction_id")
    .eq("id", options.invoiceId)
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!invoice) return { status: "not_found" };

  if (
    invoice.status === "paid" ||
    invoice.paypal_transaction_id === options.transactionId
  ) {
    return { status: "already_recorded", invoiceId: invoice.id };
  }

  const amountPaid = Number(invoice.amount_paid) + options.amount;
  // Tolerate sub-cent float noise when comparing against the total.
  const settled = amountPaid + 0.005 >= Number(invoice.total);

  const { error: updateError } = await admin
    .from("invoices")
    .update({
      status: settled ? "paid" : invoice.status,
      amount_paid: Math.round(amountPaid * 100) / 100,
      paid_at: settled ? new Date().toISOString() : null,
      paypal_transaction_id: options.transactionId,
      ...(options.orderId ? { paypal_order_id: options.orderId } : {}),
    })
    .eq("id", invoice.id)
    // Only transition an invoice that hasn't already been settled, so two
    // concurrent writers can't double-count the same capture.
    .neq("status", "paid");

  if (updateError) return { status: "error", message: updateError.message };

  // Receipt to the client, heads-up to the studio. Deliberately awaited but
  // never allowed to fail the payment — the money has already moved, and
  // sendEmail swallows its own errors.
  await sendPaymentNotifications(invoice.id);

  return { status: "recorded", invoiceId: invoice.id };
}
