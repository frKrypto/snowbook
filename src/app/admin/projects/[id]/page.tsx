import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteProjectAction } from "@/app/admin/projects/actions";
import { DeliverablesPanel } from "@/app/admin/projects/[id]/deliverables-panel";
import { TaskChecklist } from "@/app/admin/projects/[id]/task-checklist";
import { ConfirmForm } from "@/components/confirm-form";
import { PlusIcon } from "@/components/icons";
import { ProjectTimeline } from "@/components/project-timeline";
import { InvoiceListItem } from "@/components/records";
import { ProjectStatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import {
  ButtonLink,
  Card,
  CardHeader,
  DefinitionList,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients (id, name, company, email)")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: tasks }, { data: invoices }, { data: deliverables }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("project_id", id)
        .order("position")
        .order("created_at"),
      supabase
        .from("invoices")
        .select("id, invoice_number, title, status, due_date, total, amount_paid")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("deliverables")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const client = project.clients;
  const doneCount = (tasks ?? []).filter((task) => task.is_done).length;
  const invoiced = (invoices ?? [])
    .filter((invoice) => invoice.status !== "draft")
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const collected = (invoices ?? []).reduce(
    (sum, invoice) => sum + Number(invoice.amount_paid),
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow={
          client ? (
            <Link
              href={`/admin/clients/${client.id}`}
              className="transition hover:text-accent"
            >
              {client.name}
            </Link>
          ) : (
            "Project"
          )
        }
        title={project.title}
        actions={
          <>
            <ButtonLink
              href={`/admin/invoices/new?project=${project.id}`}
              variant="secondary"
            >
              <PlusIcon className="h-4 w-4" />
              New invoice
            </ButtonLink>
            <ButtonLink href={`/admin/projects/${project.id}/edit`}>Edit</ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Progress"
              action={<ProjectStatusBadge status={project.status} />}
            />
            <ProjectTimeline status={project.status} />
          </Card>

          {project.description ? (
            <Card>
              <CardHeader title="Brief" description="Visible to the client" />
              <p className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">
                {project.description}
              </p>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Checklist"
              description={
                tasks && tasks.length > 0
                  ? `${doneCount} of ${tasks.length} done`
                  : undefined
              }
            />
            <TaskChecklist projectId={project.id} tasks={tasks ?? []} />
          </Card>

          <Card>
            <CardHeader
              title="Delivery"
              description={
                deliverables && deliverables.length > 0
                  ? `${deliverables.length} ${
                      deliverables.length === 1 ? "file" : "files"
                    } visible to the client`
                  : "Files you upload here appear in the client's portal straight away."
              }
            />
            <DeliverablesPanel
              projectId={project.id}
              deliverables={deliverables ?? []}
            />
          </Card>

          <Card>
            <CardHeader
              title="Invoices"
              description="Deposits and finals are separate invoices on this project."
              action={
                <ButtonLink
                  href={`/admin/invoices/new?project=${project.id}`}
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
                title="No invoices on this project"
                description="Create a deposit invoice to lock the date, then a final invoice before delivery."
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <DefinitionList
              items={[
                {
                  term: "Client",
                  value: client ? (
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="text-accent hover:underline"
                    >
                      {client.name}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { term: "Status", value: <ProjectStatusBadge status={project.status} /> },
                { term: "Shoot date", value: formatDate(project.event_date) },
                {
                  term: "Delivery due",
                  value: formatDate(project.delivery_due_date),
                },
                { term: "Created", value: formatDate(project.created_at) },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Billing" />
            <DefinitionList
              items={[
                { term: "Invoiced", value: formatMoney(invoiced) },
                { term: "Collected", value: formatMoney(collected) },
                {
                  term: "Outstanding",
                  value: formatMoney(Math.max(invoiced - collected, 0)),
                },
              ]}
            />
          </Card>

          <Card className="border-danger/20">
            <CardHeader
              title="Danger zone"
              description="Deleting removes this project's tasks. Invoices are kept and unlinked."
            />
            <div className="px-5 py-4">
              <ConfirmForm
                action={deleteProjectAction}
                message={`Delete "${project.title}"? Its tasks will be deleted too.`}
              >
                <input type="hidden" name="id" value={project.id} />
                <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
                  Delete project
                </SubmitButton>
              </ConfirmForm>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
