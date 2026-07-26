import type { Metadata } from "next";
import Link from "next/link";

import { ClientStatusBadge } from "@/components/status-badge";
import { PlusIcon } from "@/components/icons";
import {
  ButtonLink,
  Card,
  EmptyState,
  cn,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import type { ClientStatus } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";
import { CLIENT_STATUSES } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Clients" };

const STATUS_VALUES = CLIENT_STATUSES.map((status) => status.value);

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; archived?: string }>;
}) {
  await requireAdmin();
  const { q, status, archived } = await searchParams;

  const search = (q ?? "").trim();
  const statusFilter = STATUS_VALUES.includes(status as ClientStatus)
    ? (status as ClientStatus)
    : null;

  const supabase = await createClient();

  // Archived clients are kept out of the working list unless asked for.
  const showArchived = archived === "1";

  let query = supabase
    .from("clients")
    .select("id, name, email, company, status, archived_at, created_at")
    .order("name");

  query = showArchived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);

  if (statusFilter) query = query.eq("status", statusFilter);
  if (search) {
    const escaped = search.replace(/[%,()]/g, " ");
    query = query.or(
      `name.ilike.%${escaped}%,email.ilike.%${escaped}%,company.ilike.%${escaped}%`,
    );
  }

  const [{ data: clients, error }, { data: projects }, { data: invoices }] =
    await Promise.all([
      query,
      supabase.from("projects").select("client_id, status"),
      supabase.from("invoices").select("client_id, status, total, amount_paid"),
    ]);

  const projectCounts = new Map<string, number>();
  for (const project of projects ?? []) {
    if (project.status === "completed") continue;
    projectCounts.set(
      project.client_id,
      (projectCounts.get(project.client_id) ?? 0) + 1,
    );
  }

  const outstanding = new Map<string, number>();
  for (const invoice of invoices ?? []) {
    if (invoice.status === "draft" || invoice.status === "paid") continue;
    const due = Number(invoice.total) - Number(invoice.amount_paid);
    if (due <= 0) continue;
    outstanding.set(
      invoice.client_id,
      (outstanding.get(invoice.client_id) ?? 0) + due,
    );
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Clients
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Everyone you&rsquo;ve worked with, are working with, or are talking to.
          </p>
        </div>
        <ButtonLink href="/admin/clients/new">
          <PlusIcon className="h-4 w-4" />
          New client
        </ButtonLink>
      </div>

      <form
        method="get"
        className="mb-5 flex flex-wrap items-center gap-2"
        role="search"
      >
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search name, email or company"
          aria-label="Search clients"
          className="field max-w-xs flex-1"
        />
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
          <FilterChip
            href="/admin/clients"
            label="All"
            active={!statusFilter && !showArchived}
          />
          {CLIENT_STATUSES.map((option) => (
            <FilterChip
              key={option.value}
              href={`/admin/clients?status=${option.value}`}
              label={option.label}
              active={!showArchived && statusFilter === option.value}
            />
          ))}
          <FilterChip
            href="/admin/clients?archived=1"
            label="Archived"
            active={showArchived}
          />
        </div>
        {statusFilter ? (
          <input type="hidden" name="status" value={statusFilter} />
        ) : null}
        {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
        <button
          type="submit"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface-sunken"
        >
          Search
        </button>
      </form>

      <Card>
        {error ? (
          <EmptyState title="Couldn't load clients" description={error.message} />
        ) : !clients || clients.length === 0 ? (
          <EmptyState
            title={
              showArchived
                ? "Nothing archived"
                : search || statusFilter
                  ? "No matching clients"
                  : "No clients yet"
            }
            description={
              showArchived
                ? "Archived clients are hidden from the main list and can be restored at any time."
                : search || statusFilter
                  ? "Try a different search or clear the status filter."
                  : "Add your first client to start tracking projects and invoices."
            }
            action={
              <ButtonLink href="/admin/clients/new" variant="secondary">
                New client
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {clients.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/admin/clients/${client.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-surface-sunken/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{client.name}</p>
                    <p className="truncate text-sm text-ink-muted">
                      {client.company ? `${client.company} · ` : ""}
                      {client.email}
                    </p>
                  </div>

                  <div className="tabular hidden w-32 text-right text-sm text-ink-muted sm:block">
                    {projectCounts.get(client.id) ?? 0} open
                  </div>

                  <div className="tabular w-28 text-right text-sm font-medium text-ink">
                    {outstanding.get(client.id)
                      ? formatMoney(outstanding.get(client.id))
                      : "—"}
                  </div>

                  <ClientStatusBadge status={client.status} />
                </Link>
              </li>
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
