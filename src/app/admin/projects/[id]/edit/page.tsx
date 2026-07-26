import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateProjectAction } from "@/app/admin/projects/actions";
import { ProjectForm } from "@/app/admin/projects/project-form";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: project }, { data: clients }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("clients").select("id, name, company").order("name"),
  ]);

  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Projects" title={`Edit ${project.title}`} />
      <ProjectForm
        action={updateProjectAction}
        project={project}
        clients={clients ?? []}
        submitLabel="Save changes"
        cancelHref={`/admin/projects/${project.id}`}
      />
    </div>
  );
}
