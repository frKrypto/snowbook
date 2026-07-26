import type { Metadata } from "next";

import { InvoiceListItem } from "@/components/records";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { isInvoicePayable } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your invoices" };

export default async function PortalInvoicesPage() {
  const { clientId } = await requireClient();

  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, title, status, due_date, total, amount_paid")
    .eq("client_id", clientId)
    .order("issue_date", { ascending: false });

  const all = invoices ?? [];
  const outstanding = all
    .filter(isInvoicePayable)
    .reduce(
      (sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid),
      0,
    );
  const paid = all.reduce((sum, invoice) => sum + Number(invoice.amount_paid), 0);

  return (
    <>
      <PageHeader
        eyebrow="Invoices"
        title="Your invoices"
        description="Deposits and final balances are billed separately."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Outstanding"
          value={formatMoney(outstanding)}
          tone={outstanding > 0 ? "warning" : "positive"}
        />
        <StatCard label="Paid to date" value={formatMoney(paid)} tone="positive" />
      </div>

      <Card>
        {all.length > 0 ? (
          <ul className="divide-y divide-line">
            {all.map((invoice) => (
              <InvoiceListItem
                key={invoice.id}
                invoice={invoice}
                href={`/portal/invoices/${invoice.id}`}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No invoices yet"
            description="Invoices appear here as soon as they're issued."
          />
        )}
      </Card>
    </>
  );
}
