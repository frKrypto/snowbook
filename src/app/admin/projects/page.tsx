import type { Metadata } from "next";
import Link from "next/link";

import { PlusIcon } from "@/components/icons";
import { ProjectListItem } from "@/components/records";
import { ButtonLink, Card, EmptyState, cn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import type { ProjectStatus } from "@/lib/database.types";
import { PROJECT_STATUSES } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Projects" };

const STATUS_VALUES = PROJECT_STATUSES.map((status) => status.value);

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;

  const statusFilter = STATUS_VALUES.includes(status as ProjectStatus)
    ? (status as ProjectStatus)
    : null;

  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select(
      "id, title, status, event_date, delivery_due_date, clients (id, name)",
    )
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: projects, error } = await query;

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Projects
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Every shoot, from first enquiry through final delivery.
          </p>
        </div>
        <ButtonLink href="/admin/projects/new">
          <PlusIcon className="h-4 w-4" />
          New project
        </ButtonLink>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1">
        <FilterChip href="/admin/projects" label="All" active={!statusFilter} />
        {PROJECT_STATUSES.map((option) => (
          <FilterChip
            key={option.value}
            href={`/admin/projects?status=${option.value}`}
            label={option.label}
            active={statusFilter === option.value}
          />
        ))}
      </div>

      <Card>
        {error ? (
          <EmptyState title="Couldn't load projects" description={error.message} />
        ) : !projects || projects.length === 0 ? (
          <EmptyState
            title={statusFilter ? "Nothing at this stage" : "No projects yet"}
            description={
              statusFilter
                ? "Try a different stage filter."
                : "Create a project to start tracking a shoot."
            }
            action={
              <ButtonLink href="/admin/projects/new" variant="secondary">
                New project
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {projects.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                href={`/admin/projects/${project.id}`}
                secondary={project.clients?.name ?? null}
              />
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
