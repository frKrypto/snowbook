import type { Metadata } from "next";
import Link from "next/link";

import { PlusIcon } from "@/components/icons";
import { InvoiceListItem, ProjectListItem } from "@/components/records";
import {
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  StatCard,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { effectiveInvoiceStatus, isProjectActive } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

interface ActivityEntry {
  id: string;
  at: string;
  text: string;
  href: string;
}

export default async function AdminDashboard() {
  const { profile, email } = await requireAdmin();

  const supabase = await createClient();
  const [{ data: projects }, { data: invoices }, { data: clients }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, title, status, event_date, delivery_due_date, created_at, clients (id, name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, title, status, due_date, total, amount_paid, created_at, sent_at, paid_at, clients (id, name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, name, status, created_at")
        .order("created_at", { ascending: false }),
    ]);

  const allProjects = projects ?? [];
  const allInvoices = invoices ?? [];
  const allClients = clients ?? [];

  const activeProjects = allProjects.filter((project) =>
    isProjectActive(project.status),
  );
  const openInvoices = allInvoices.filter(
    (invoice) => invoice.status !== "draft" && invoice.status !== "paid",
  );
  const outstanding = openInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid),
    0,
  );
  const overdue = openInvoices.filter(
    (invoice) => effectiveInvoiceStatus(invoice) === "overdue",
  );
  const collected = allInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount_paid),
    0,
  );

  const today = todayISO();
  const upcomingShoots = allProjects
    .filter(
      (project) =>
        project.event_date != null &&
        project.event_date >= today &&
        project.status !== "completed",
    )
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""))
    .slice(0, 5);

  // A lightweight audit trail assembled from record timestamps — enough to see
  // what moved recently without a dedicated events table.
  const activity: ActivityEntry[] = [
    ...allClients.map((client) => ({
      id: `client-${client.id}`,
      at: client.created_at,
      text: `${client.name} added as a ${client.status}`,
      href: `/admin/clients/${client.id}`,
    })),
    ...allProjects.map((project) => ({
      id: `project-${project.id}`,
      at: project.created_at,
      text: `Project “${project.title}” created${
        project.clients ? ` for ${project.clients.name}` : ""
      }`,
      href: `/admin/projects/${project.id}`,
    })),
    ...allInvoices.flatMap((invoice) => {
      const entries: ActivityEntry[] = [];
      const who = invoice.clients ? ` to ${invoice.clients.name}` : "";
      if (invoice.paid_at) {
        entries.push({
          id: `invoice-paid-${invoice.id}`,
          at: invoice.paid_at,
          text: `${invoice.invoice_number} paid — ${formatMoney(invoice.amount_paid)}`,
          href: `/admin/invoices/${invoice.id}`,
        });
      }
      if (invoice.sent_at) {
        entries.push({
          id: `invoice-sent-${invoice.id}`,
          at: invoice.sent_at,
          text: `${invoice.invoice_number} sent${who} — ${formatMoney(invoice.total)}`,
          href: `/admin/invoices/${invoice.id}`,
        });
      }
      return entries;
    }),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const greetingName = (profile.full_name ?? email ?? "").split(/[\s@]/)[0];

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-xs font-medium tracking-widest text-ink-faint uppercase">
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).format(new Date())}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {greetingName ? `Good to see you, ${greetingName}` : "Studio overview"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/clients/new" variant="secondary">
            <PlusIcon className="h-4 w-4" />
            Client
          </ButtonLink>
          <ButtonLink href="/admin/invoices/new">
            <PlusIcon className="h-4 w-4" />
            Invoice
          </ButtonLink>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active projects"
          value={activeProjects.length}
          hint="Booked or in progress"
        />
        <StatCard
          label="Outstanding"
          value={formatMoney(outstanding)}
          hint={`${openInvoices.length} open ${
            openInvoices.length === 1 ? "invoice" : "invoices"
          }`}
          tone={outstanding > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Overdue"
          value={overdue.length}
          hint={
            overdue.length > 0
              ? formatMoney(
                  overdue.reduce(
                    (sum, invoice) =>
                      sum + Number(invoice.total) - Number(invoice.amount_paid),
                    0,
                  ),
                )
              : "nothing past due"
          }
          tone={overdue.length > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Collected"
          value={formatMoney(collected)}
          hint="All time"
          tone="positive"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Upcoming shoots"
              description="Next five dates in the diary"
              action={
                <Link
                  href="/admin/projects"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  All projects
                </Link>
              }
            />
            {upcomingShoots.length > 0 ? (
              <ul className="divide-y divide-line">
                {upcomingShoots.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    href={`/admin/projects/${project.id}`}
                    secondary={project.clients?.name ?? null}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Nothing on the calendar"
                description="Projects with a future shoot date show up here."
                action={
                  <ButtonLink href="/admin/projects/new" variant="secondary">
                    New project
                  </ButtonLink>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Outstanding invoices"
              description={
                outstanding > 0 ? `${formatMoney(outstanding)} owed` : undefined
              }
              action={
                <Link
                  href="/admin/invoices"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  All invoices
                </Link>
              }
            />
            {openInvoices.length > 0 ? (
              <ul className="divide-y divide-line">
                {openInvoices.slice(0, 6).map((invoice) => (
                  <InvoiceListItem
                    key={invoice.id}
                    invoice={invoice}
                    href={`/admin/invoices/${invoice.id}`}
                    secondary={invoice.clients?.name ?? null}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Everything's paid"
                description="No sent invoices are waiting on payment."
              />
            )}
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader title="Recent activity" />
            {activity.length > 0 ? (
              <ul className="divide-y divide-line">
                {activity.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={entry.href}
                      className="block px-5 py-3 transition hover:bg-surface-sunken/60"
                    >
                      <p className="text-sm text-ink">{entry.text}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {formatDate(entry.at)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Nothing yet"
                description="Activity shows up as you add clients and send invoices."
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
