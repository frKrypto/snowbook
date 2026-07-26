import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CheckIcon } from "@/components/icons";
import { ProjectTimeline } from "@/components/project-timeline";
import { InvoiceListItem } from "@/components/records";
import { ProjectStatusBadge } from "@/components/status-badge";
import {
  Card,
  CardHeader,
  DefinitionList,
  EmptyState,
  PageHeader,
  cn,
} from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Project" };

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { clientId } = await requireClient();
  const { id } = await params;

  const supabase = await createClient();

  // The client_id filter is belt-and-braces: RLS would already hide another
  // client's project, and a miss becomes a 404 rather than an error.
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: tasks }, { data: invoices }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, name, is_done, due_date")
      .eq("project_id", id)
      .order("position")
      .order("created_at"),
    supabase
      .from("invoices")
      .select("id, invoice_number, title, status, due_date, total")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const doneCount = (tasks ?? []).filter((task) => task.is_done).length;

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title={project.title}
        actions={<ProjectStatusBadge status={project.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Where things stand" />
            <ProjectTimeline status={project.status} />
          </Card>

          {project.description ? (
            <Card>
              <CardHeader title="What we're making" />
              <p className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">
                {project.description}
              </p>
            </Card>
          ) : null}

          {tasks && tasks.length > 0 ? (
            <Card>
              <CardHeader
                title="Progress checklist"
                description={`${doneCount} of ${tasks.length} done`}
              />
              <ul className="divide-y divide-line">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        task.is_done
                          ? "border-positive bg-positive text-white"
                          : "border-line",
                      )}
                    >
                      {task.is_done ? <CheckIcon className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm",
                          task.is_done ? "text-ink-faint line-through" : "text-ink",
                        )}
                      >
                        {task.name}
                      </span>
                      {task.due_date && !task.is_done ? (
                        <span className="block text-xs text-ink-muted">
                          {formatDate(task.due_date)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Key dates" />
            <DefinitionList
              items={[
                { term: "Shoot date", value: formatDate(project.event_date) },
                {
                  term: "Delivery due",
                  value: formatDate(project.delivery_due_date),
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Invoices" />
            {invoices && invoices.length > 0 ? (
              <ul className="divide-y divide-line">
                {invoices.map((invoice) => (
                  <InvoiceListItem
                    key={invoice.id}
                    invoice={invoice}
                    href={`/portal/invoices/${invoice.id}`}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Nothing billed yet"
                description="Invoices for this project will appear here."
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
