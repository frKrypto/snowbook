import { NextResponse, type NextRequest } from "next/server";

import { getSessionContext } from "@/lib/auth";
import { createPayPalOrder } from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isInvoicePayable } from "@/lib/statuses";

/**
 * Starts a PayPal checkout for one invoice.
 *
 * The invoice is read through the caller's own session, so RLS decides whether
 * they may see it at all, and the charge amount is taken from that row — the
 * browser only ever sends an invoice id.
 */
export async function POST(request: NextRequest) {
  const context = await getSessionContext();
  if (!context) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let invoiceId: string;
  try {
    const body = (await request.json()) as { invoiceId?: unknown };
    if (typeof body.invoiceId !== "string") throw new Error("bad request");
    invoiceId = body.invoiceId;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, title, status, due_date, total, amount_paid")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  if (!isInvoicePayable(invoice)) {
    return NextResponse.json(
      { error: "This invoice isn't open for payment." },
      { status: 409 },
    );
  }

  const amountDue =
    Math.round((Number(invoice.total) - Number(invoice.amount_paid)) * 100) / 100;

  if (amountDue <= 0) {
    return NextResponse.json(
      { error: "This invoice is already settled." },
      { status: 409 },
    );
  }

  try {
    const order = await createPayPalOrder({
      amount: amountDue,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      description: invoice.title
        ? `${invoice.invoice_number} — ${invoice.title}`
        : `Invoice ${invoice.invoice_number}`,
    });

    // Remember the order so the capture step can prove the two belong together.
    await createAdminClient()
      .from("invoices")
      .update({ paypal_order_id: order.id })
      .eq("id", invoice.id);

    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    console.error("PayPal create-order failed", error);
    return NextResponse.json(
      { error: "Could not start the payment. Please try again." },
      { status: 502 },
    );
  }
}
