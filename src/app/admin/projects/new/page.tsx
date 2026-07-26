import type { Metadata } from "next";

import { createProjectAction } from "@/app/admin/projects/actions";
import { ProjectForm } from "@/app/admin/projects/project-form";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await requireAdmin();
  const { client: defaultClientId } = await searchParams;

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, company")
    .order("name");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Projects"
        title="New project"
        description="Projects hang off a client — add the client first if they're not listed."
      />

      {clients && clients.length > 0 ? (
        <ProjectForm
          action={createProjectAction}
          clients={clients}
          defaultClientId={defaultClientId}
          submitLabel="Create project"
          cancelHref="/admin/projects"
        />
      ) : (
        <Card>
          <EmptyState
            title="Add a client first"
            description="Every project belongs to a client, so start there."
            action={<ButtonLink href="/admin/clients/new">New client</ButtonLink>}
          />
        </Card>
      )}
    </div>
  );
}
