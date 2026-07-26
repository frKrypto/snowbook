import type { Metadata } from "next";
import Link from "next/link";

import { PlusIcon } from "@/components/icons";
import { InvoiceListItem } from "@/components/records";
import { ButtonLink, Card, EmptyState, StatCard, cn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import type { InvoiceStatus } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";
import { INVOICE_STATUSES, effectiveInvoiceStatus } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoices" };

const STATUS_VALUES = INVOICE_STATUSES.map((status) => status.value);

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;

  const statusFilter = STATUS_VALUES.includes(status as InvoiceStatus)
    ? (status as InvoiceStatus)
    : null;

  const supabase = await createClient();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, title, status, due_date, total, amount_paid, created_at, clients (id, name)",
    )
    .order("created_at", { ascending: false });

  const all = invoices ?? [];

  // 'overdue' is derived from the due date, so filter on the effective status
  // rather than the stored column.
  const visible = statusFilter
    ? all.filter((invoice) => effectiveInvoiceStatus(invoice) === statusFilter)
    : all;

  const outstanding = all
    .filter((invoice) => invoice.status !== "draft" && invoice.status !== "paid")
    .reduce(
      (sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid),
      0,
    );
  const overdueCount = all.filter(
    (invoice) => effectiveInvoiceStatus(invoice) === "overdue",
  ).length;
  const collected = all.reduce(
    (sum, invoice) => sum + Number(invoice.amount_paid),
    0,
  );

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Invoices
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Deposits and finals are separate invoices linked to the same project.
          </p>
        </div>
        <ButtonLink href="/admin/invoices/new">
          <PlusIcon className="h-4 w-4" />
          New invoice
        </ButtonLink>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={formatMoney(outstanding)}
          hint="Sent and overdue, less anything paid"
          tone={outstanding > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          hint={overdueCount === 1 ? "invoice past due" : "invoices past due"}
          tone={overdueCount > 0 ? "danger" : "neutral"}
        />
        <StatCard label="Collected" value={formatMoney(collected)} tone="positive" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1">
        <FilterChip href="/admin/invoices" label="All" active={!statusFilter} />
        {INVOICE_STATUSES.map((option) => (
          <FilterChip
            key={option.value}
            href={`/admin/invoices?status=${option.value}`}
            label={option.label}
            active={statusFilter === option.value}
          />
        ))}
      </div>

      <Card>
        {error ? (
          <EmptyState title="Couldn't load invoices" description={error.message} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={statusFilter ? "Nothing with that status" : "No invoices yet"}
            description={
              statusFilter
                ? "Try a different status filter."
                : "Create an invoice to bill a deposit or a final balance."
            }
            action={
              <ButtonLink href="/admin/invoices/new" variant="secondary">
                New invoice
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((invoice) => (
              <InvoiceListItem
                key={invoice.id}
                invoice={invoice}
                href={`/admin/invoices/${invoice.id}`}
                secondary={invoice.clients?.name ?? null}
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
        active
          ? "bg-brand text-white"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}
