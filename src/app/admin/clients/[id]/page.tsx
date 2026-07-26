import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { deleteClientAction } from "@/app/admin/clients/actions";
import { InviteButton } from "@/app/admin/clients/[id]/invite-button";
import { ConfirmForm } from "@/components/confirm-form";
import { PlusIcon } from "@/components/icons";
import { InvoiceListItem, ProjectListItem } from "@/components/records";
import { ClientStatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import {
  ButtonLink,
  Card,
  CardHeader,
  DefinitionList,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client" };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();

  const [{ data: client }, { data: projects }, { data: invoices }, { data: portalUsers }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("projects")
        .select("id, title, status, event_date, delivery_due_date")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, invoice_number, title, status, due_date, total, amount_paid")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id").eq("client_id", id),
    ]);

  if (!client) notFound();

  const billed = (invoices ?? [])
    .filter((invoice) => invoice.status !== "draft")
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const collected = (invoices ?? []).reduce(
    (sum, invoice) => sum + Number(invoice.amount_paid),
    0,
  );
  const hasPortalAccess = (portalUsers ?? []).length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Client"
        title={client.name}
        description={client.company ?? undefined}
        actions={
          <>
            <ButtonLink
              href={`/admin/projects/new?client=${client.id}`}
              variant="secondary"
            >
              <PlusIcon className="h-4 w-4" />
              New project
            </ButtonLink>
            <ButtonLink href={`/admin/clients/${client.id}/edit`}>Edit</ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Billed" value={formatMoney(billed)} hint="Excludes drafts" />
            <StatCard
              label="Collected"
              value={formatMoney(collected)}
              tone="positive"
            />
            <StatCard
              label="Outstanding"
              value={formatMoney(Math.max(billed - collected, 0))}
              tone={billed - collected > 0 ? "warning" : "neutral"}
            />
          </div>

          <Card>
            <CardHeader
              title="Projects"
              description={`${projects?.length ?? 0} total`}
              action={
                <ButtonLink
                  href={`/admin/projects/new?client=${client.id}`}
                  variant="secondary"
                  size="sm"
                >
                  Add
                </ButtonLink>
              }
            />
            {projects && projects.length > 0 ? (
              <ul className="divide-y divide-line">
                {projects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    href={`/admin/projects/${project.id}`}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No projects yet"
                description="Create a project to track the shoot, tasks and delivery."
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Invoices"
              description={`${invoices?.length ?? 0} total`}
              action={
                <ButtonLink
                  href={`/admin/invoices/new?client=${client.id}`}
                  variant="secondary"
                  size="sm"
                >
                  Add
                </ButtonLink>
              }
            />
            {invoices && invoices.length > 0 ? (
              <ul className="divide-y divide-line">
                {invoices.map((invoice) => (
                  <InvoiceListItem
                    key={invoice.id}
                    invoice={invoice}
                    href={`/admin/invoices/${invoice.id}`}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No invoices yet"
                description="Deposits and final payments are separate invoices on the same project."
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <DefinitionList
              items={[
                { term: "Status", value: <ClientStatusBadge status={client.status} /> },
                {
                  term: "Email",
                  value: (
                    <a
                      href={`mailto:${client.email}`}
                      className="text-accent hover:underline"
                    >
                      {client.email}
                    </a>
                  ),
                },
                { term: "Phone", value: client.phone ?? "—" },
                { term: "Company", value: client.company ?? "—" },
                { term: "Added", value: formatDate(client.created_at) },
                {
                  term: "Portal access",
                  value: hasPortalAccess ? "Invited" : "Not invited",
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader
              title="Portal access"
              description="Sends an email invite to set a password."
            />
            <div className="px-5 py-4">
              <InviteButton clientId={client.id} />
            </div>
          </Card>

          {client.notes ? (
            <Card>
              <CardHeader title="Notes" description="Internal only" />
              <p className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">
                {client.notes}
              </p>
            </Card>
          ) : null}

          <Card className="border-danger/20">
            <CardHeader
              title="Danger zone"
              description="Deleting removes their projects, tasks and invoices too."
            />
            <div className="px-5 py-4">
              <ConfirmForm
                action={deleteClientAction}
                message={`Delete ${client.name}? This also deletes their projects, tasks and invoices. This cannot be undone.`}
              >
                <input type="hidden" name="id" value={client.id} />
                <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
                  Delete client
                </SubmitButton>
              </ConfirmForm>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
