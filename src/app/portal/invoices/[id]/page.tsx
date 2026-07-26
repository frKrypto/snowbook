import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvoiceDocument } from "@/components/invoice-document";
import { PayPalCheckout } from "@/components/paypal-checkout";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { currency, isPayPalConfigured } from "@/lib/env";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { isInvoicePayable } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoice" };

export default async function PortalInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { clientId } = await requireClient();
  const { id } = await params;

  const supabase = await createClient();

  // Drafts are excluded by RLS, so an unsent invoice 404s here.
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients (name, email, company), projects (id, title)")
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", id)
    .order("position")
    .order("created_at");

  const amountDue =
    Math.round((Number(invoice.total) - Number(invoice.amount_paid)) * 100) / 100;
  const payable = isInvoicePayable(invoice) && amountDue > 0;
  const paypalReady = isPayPalConfigured();

  return (
    <>
      <PageHeader
        eyebrow="Invoice"
        title={invoice.invoice_number}
        description={invoice.projects?.title ?? undefined}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoiceDocument
            invoice={invoice}
            lineItems={lineItems ?? []}
            billedTo={invoice.clients}
            projectTitle={invoice.projects?.title ?? null}
          />
        </div>

        <div className="space-y-6">
          {payable ? (
            <Card className="border-accent/30">
              <CardHeader
                title="Pay this invoice"
                description={
                  invoice.due_date ? `Due ${formatDate(invoice.due_date)}` : undefined
                }
              />
              <div className="space-y-4 px-5 py-5">
                <div>
                  <p className="text-xs font-medium tracking-widest text-ink-faint uppercase">
                    Amount due
                  </p>
                  <p className="tabular mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
                    {formatMoney(amountDue)}
                  </p>
                </div>

                {paypalReady ? (
                  <PayPalCheckout
                    invoiceId={invoice.id}
                    clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!}
                    currency={currency()}
                  />
                ) : (
                  <p className="rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-sm text-ink-muted">
                    Online payment isn&rsquo;t set up yet. Please contact the studio
                    to settle this invoice.
                  </p>
                )}

                <p className="text-xs leading-relaxed text-ink-faint">
                  Payments are processed by PayPal. You can pay with a card
                  without a PayPal account.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="border-positive/30">
              <CardHeader title="Payment" />
              <div className="px-5 py-5">
                {invoice.status === "paid" ? (
                  <>
                    <p className="font-display text-lg font-semibold text-positive">
                      Paid in full
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Received {formatDateTime(invoice.paid_at)}. Thank you!
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">
                    Nothing is outstanding on this invoice.
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
