import type {
  ClientStatus,
  Invoice,
  InvoiceStatus,
  ProjectStatus,
} from "@/lib/database.types";
import { todayISO } from "@/lib/format";

export type Tone =
  | "neutral"
  | "positive"
  | "warning"
  | "danger"
  | "info"
  | "accent";

interface StatusMeta<T extends string> {
  value: T;
  label: string;
  tone: Tone;
}

export const CLIENT_STATUSES: StatusMeta<ClientStatus>[] = [
  { value: "lead", label: "Lead", tone: "warning" },
  { value: "active", label: "Active", tone: "positive" },
  { value: "past", label: "Past", tone: "neutral" },
];

export const PROJECT_STATUSES: StatusMeta<ProjectStatus>[] = [
  { value: "inquiry", label: "Inquiry", tone: "neutral" },
  { value: "booked", label: "Booked", tone: "info" },
  { value: "in_progress", label: "In progress", tone: "accent" },
  { value: "delivered", label: "Delivered", tone: "positive" },
  { value: "completed", label: "Completed", tone: "positive" },
];

export const INVOICE_STATUSES: StatusMeta<InvoiceStatus>[] = [
  { value: "draft", label: "Draft", tone: "neutral" },
  { value: "sent", label: "Sent", tone: "info" },
  { value: "paid", label: "Paid", tone: "positive" },
  { value: "overdue", label: "Overdue", tone: "danger" },
];

/** Ordered stages shown on the client-facing project timeline. */
export const PROJECT_TIMELINE: ProjectStatus[] = [
  "inquiry",
  "booked",
  "in_progress",
  "delivered",
  "completed",
];

function lookup<T extends string>(
  list: StatusMeta<T>[],
  value: T,
): StatusMeta<T> {
  return (
    list.find((entry) => entry.value === value) ?? {
      value,
      label: value,
      tone: "neutral" as Tone,
    }
  );
}

export const clientStatusMeta = (value: ClientStatus) =>
  lookup(CLIENT_STATUSES, value);
export const projectStatusMeta = (value: ProjectStatus) =>
  lookup(PROJECT_STATUSES, value);
export const invoiceStatusMeta = (value: InvoiceStatus) =>
  lookup(INVOICE_STATUSES, value);

/**
 * An invoice is overdue the moment its due date passes, whether or not the
 * nightly sweep has run. Display always uses this rather than the raw column.
 */
export function effectiveInvoiceStatus(
  invoice: Pick<Invoice, "status" | "due_date">,
): InvoiceStatus {
  if (
    invoice.status === "sent" &&
    invoice.due_date &&
    invoice.due_date < todayISO()
  ) {
    return "overdue";
  }
  return invoice.status;
}

export const isInvoicePayable = (
  invoice: Pick<Invoice, "status" | "due_date">,
) => invoice.status === "sent" || invoice.status === "overdue";

export const isProjectActive = (status: ProjectStatus) =>
  status === "booked" || status === "in_progress";
