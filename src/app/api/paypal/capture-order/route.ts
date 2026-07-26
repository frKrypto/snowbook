import { NextResponse, type NextRequest } from "next/server";

import { getSessionContext } from "@/lib/auth";
import { capturePayPalOrder, extractCapture } from "@/lib/paypal";
import { recordInvoicePayment } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

/**
 * Captures the approved PayPal order and records the payment.
 *
 * The webhook does the same job asynchronously; whichever arrives first wins
 * and the other is a no-op. Doing it here too means the client sees their
 * invoice flip to paid immediately instead of waiting on a delivery.
 */
export async function POST(request: NextRequest) {
  const context = await getSessionContext();
  if (!context) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let invoiceId: string;
  let orderId: string;
  try {
    const body = (await request.json()) as {
      invoiceId?: unknown;
      orderId?: unknown;
    };
    if (typeof body.invoiceId !== "string" || typeof body.orderId !== "string") {
      throw new Error("bad request");
    }
    invoiceId = body.invoiceId;
    orderId = body.orderId;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Read through the caller's session so RLS confirms this invoice is theirs.
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, paypal_order_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  if (invoice.paypal_order_id !== orderId) {
    return NextResponse.json(
      { error: "That payment doesn't match this invoice." },
      { status: 409 },
    );
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ status: "already_paid" });
  }

  try {
    const order = await capturePayPalOrder(orderId);
    const capture = extractCapture(order);

    if (!capture) {
      return NextResponse.json(
        { error: "PayPal didn't complete the payment. Nothing was charged." },
        { status: 402 },
      );
    }

    const result = await recordInvoicePayment({
      invoiceId: invoice.id,
      amount: capture.amount,
      transactionId: capture.id,
      orderId,
    });

    if (result.status === "error") {
      // The money moved — surface it loudly so it can be reconciled by hand.
      console.error("Captured payment but failed to record it", {
        invoiceId: invoice.id,
        captureId: capture.id,
        message: result.message,
      });
      return NextResponse.json(
        {
          error:
            "Your payment went through, but we couldn't update the invoice. Please contact the studio.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ status: "paid" });
  } catch (error) {
    console.error("PayPal capture failed", error);
    return NextResponse.json(
      { error: "We couldn't complete the payment. Please try again." },
      { status: 502 },
    );
  }
}
