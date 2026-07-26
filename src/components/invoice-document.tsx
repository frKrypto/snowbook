import { Card } from "@/components/ui";
import { InvoiceStatusBadge } from "@/components/status-badge";
import type { Invoice, InvoiceLineItem } from "@/lib/database.types";
import { formatDate, formatMoney } from "@/lib/format";
import { effectiveInvoiceStatus } from "@/lib/statuses";

/**
 * The invoice itself, rendered identically for the studio and the client so
 * there is never a discrepancy between what each side sees.
 */
export function InvoiceDocument({
  invoice,
  lineItems,
  billedTo,
  projectTitle,
}: {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  billedTo: { name: string; email: string; company: string | null } | null;
  projectTitle?: string | null;
}) {
  const status = effectiveInvoiceStatus(invoice);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
        <div>
          <p className="font-display text-xl font-semibold tracking-tight text-ink">
            {invoice.invoice_number}
          </p>
          {invoice.title ? (
            <p className="mt-0.5 text-sm text-ink-muted">{invoice.title}</p>
          ) : null}
          {projectTitle ? (
            <p className="mt-0.5 text-sm text-ink-muted">{projectTitle}</p>
          ) : null}
        </div>
        <InvoiceStatusBadge status={status} />
      </div>

      <div className="grid gap-5 border-b border-line px-5 py-5 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="label">Billed to</p>
          {billedTo ? (
            <>
              <p className="text-sm font-medium text-ink">{billedTo.name}</p>
              {billedTo.company ? (
                <p className="text-sm text-ink-muted">{billedTo.company}</p>
              ) : null}
              <p className="text-sm text-ink-muted">{billedTo.email}</p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">—</p>
          )}
        </div>
        <div>
          <p className="label">Issued</p>
          <p className="text-sm text-ink">{formatDate(invoice.issue_date)}</p>
        </div>
        <div>
          <p className="label">Due</p>
          <p className="text-sm text-ink">{formatDate(invoice.due_date)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-5 py-2.5 text-xs font-medium tracking-wide text-ink-faint uppercase sm:px-6">
                Description
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-medium tracking-wide text-ink-faint uppercase">
                Qty
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-medium tracking-wide text-ink-faint uppercase">
                Rate
              </th>
              <th className="px-5 py-2.5 text-right text-xs font-medium tracking-wide text-ink-faint uppercase sm:px-6">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lineItems.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-3 text-ink sm:px-6">{item.description}</td>
                <td className="tabular px-3 py-3 text-right text-ink-muted">
                  {Number(item.quantity)}
                </td>
                <td className="tabular px-3 py-3 text-right text-ink-muted">
                  {formatMoney(item.rate)}
                </td>
                <td className="tabular px-5 py-3 text-right font-medium text-ink sm:px-6">
                  {formatMoney(item.amount)}
                </td>
              </tr>
            ))}
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-ink-muted sm:px-6">
                  No line items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="border-t border-line bg-surface-sunken/40 px-5 py-5 sm:px-6">
        <dl className="ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="tabular text-ink">{formatMoney(invoice.subtotal)}</dd>
          </div>
          {Number(invoice.tax_rate) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Tax ({Number(invoice.tax_rate)}%)</dt>
              <dd className="tabular text-ink">{formatMoney(invoice.tax)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-line pt-2">
            <dt className="font-medium text-ink">Total</dt>
            <dd className="tabular font-display text-lg font-semibold text-ink">
              {formatMoney(invoice.total)}
            </dd>
          </div>
          {Number(invoice.amount_paid) > 0 ? (
            <div className="flex justify-between text-positive">
              <dt>Paid {invoice.paid_at ? formatDate(invoice.paid_at) : ""}</dt>
              <dd className="tabular">−{formatMoney(invoice.amount_paid)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {invoice.notes ? (
        <div className="border-t border-line px-5 py-4 sm:px-6">
          <p className="label">Notes</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">
            {invoice.notes}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
