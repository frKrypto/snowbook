import Link from "next/link";

import { InvoiceStatusBadge, ProjectStatusBadge } from "@/components/status-badge";
import type { Invoice, Project } from "@/lib/database.types";
import { formatDate, formatMoney } from "@/lib/format";
import { effectiveInvoiceStatus } from "@/lib/statuses";

/** One row in any list of projects. */
export function ProjectListItem({
  project,
  href,
  secondary,
}: {
  project: Pick<
    Project,
    "id" | "title" | "status" | "event_date" | "delivery_due_date"
  >;
  href: string;
  secondary?: string | null;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-surface-sunken/60"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{project.title}</p>
          <p className="truncate text-sm text-ink-muted">
            {secondary ? `${secondary} · ` : ""}
            {project.event_date
              ? `Shoot ${formatDate(project.event_date)}`
              : "No shoot date"}
            {project.delivery_due_date
              ? ` · Delivery ${formatDate(project.delivery_due_date)}`
              : ""}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </Link>
    </li>
  );
}

/** One row in any list of invoices. */
export function InvoiceListItem({
  invoice,
  href,
  secondary,
}: {
  invoice: Pick<
    Invoice,
    "id" | "invoice_number" | "title" | "status" | "due_date" | "total"
  >;
  href: string;
  secondary?: string | null;
}) {
  const status = effectiveInvoiceStatus(invoice);

  return (
    <li>
      <Link
        href={href}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-surface-sunken/60"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">
            {invoice.invoice_number}
            {invoice.title ? (
              <span className="font-normal text-ink-muted"> · {invoice.title}</span>
            ) : null}
          </p>
          <p className="truncate text-sm text-ink-muted">
            {secondary ? `${secondary} · ` : ""}
            {invoice.due_date ? `Due ${formatDate(invoice.due_date)}` : "No due date"}
          </p>
        </div>
        <div className="tabular w-24 text-right text-sm font-medium text-ink">
          {formatMoney(invoice.total)}
        </div>
        <InvoiceStatusBadge status={status} />
      </Link>
    </li>
  );
}
