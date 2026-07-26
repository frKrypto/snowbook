import type { Metadata } from "next";
import Link from "next/link";

import { ProjectTimeline } from "@/components/project-timeline";
import { InvoiceListItem } from "@/components/records";
import { ProjectStatusBadge } from "@/components/status-badge";
import {
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { effectiveInvoiceStatus, isInvoicePayable } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your portal" };

export default async function PortalDashboard() {
  const { clientId } = await requireClient();

  const supabase = await createClient();

  // RLS already restricts these to this client; the filters keep the payload
  // small rather than doing the security work.
  const [{ data: client }, { data: projects }, { data: invoices }] =
    await Promise.all([
      supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
      supabase
        .from("projects")
        .select("id, title, status, event_date, delivery_due_date, description")
        .eq("client_id", clientId)
        .order("event_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("invoices")
        .select("id, invoice_number, title, status, due_date, total, amount_paid")
        .eq("client_id", clientId)
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);

  const activeProjects = (projects ?? []).filter(
    (project) => project.status !== "completed",
  );
  const unpaid = (invoices ?? []).filter(isInvoicePayable);
  const amountDue = unpaid.reduce(
    (sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid),
    0,
  );
  const overdueCount = unpaid.filter(
    (invoice) => effectiveInvoiceStatus(invoice) === "overdue",
  ).length;

  const firstName = client?.name?.split(/\s+/)[0] ?? "there";

  return (
    <>
      <PageHeader
        eyebrow="Welcome back"
        title={`Hello, ${firstName}`}
        description="Everything about your projects and invoices, in one place."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active projects"
          value={activeProjects.length}
          hint={activeProjects.length === 1 ? "in progress" : "in progress"}
        />
        <StatCard
          label="Amount due"
          value={formatMoney(amountDue)}
          tone={amountDue > 0 ? "warning" : "positive"}
          hint={amountDue > 0 ? "across open invoices" : "you're all settled"}
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          tone={overdueCount > 0 ? "danger" : "neutral"}
          hint={overdueCount === 1 ? "invoice past due" : "invoices past due"}
        />
      </div>

      {unpaid.length > 0 ? (
        <Card className="mb-6 border-accent/30 bg-accent-soft/40">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
            <div>
              <p className="font-display text-base font-semibold text-ink">
                {unpaid.length === 1
                  ? "You have an invoice to pay"
                  : `You have ${unpaid.length} invoices to pay`}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {formatMoney(amountDue)} outstanding
                {unpaid[0].due_date
                  ? ` · next due ${formatDate(unpaid[0].due_date)}`
                  : ""}
              </p>
            </div>
            <ButtonLink href={`/portal/invoices/${unpaid[0].id}`}>
              Pay now
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {activeProjects.length > 0 ? (
            activeProjects.map((project) => (
              <Card key={project.id}>
                <CardHeader
                  title={
                    <Link
                      href={`/portal/projects/${project.id}`}
                      className="transition hover:text-accent"
                    >
                      {project.title}
                    </Link>
                  }
                  description={
                    project.event_date
                      ? `Shoot ${formatDate(project.event_date)}`
                      : undefined
                  }
                  action={<ProjectStatusBadge status={project.status} />}
                />
                <ProjectTimeline status={project.status} />
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState
                title="No active projects"
                description="Once your booking is confirmed it will show up here with its progress."
              />
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader
              title="Invoices"
              action={
                <Link
                  href="/portal/invoices"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  All
                </Link>
              }
            />
            {invoices && invoices.length > 0 ? (
              <ul className="divide-y divide-line">
                {invoices.slice(0, 5).map((invoice) => (
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
        </div>
      </div>
    </>
  );
}
