import { Badge } from "@/components/ui";
import type {
  ClientStatus,
  InvoiceStatus,
  ProjectStatus,
} from "@/lib/database.types";
import {
  clientStatusMeta,
  invoiceStatusMeta,
  projectStatusMeta,
} from "@/lib/statuses";

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const meta = clientStatusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = projectStatusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = invoiceStatusMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
