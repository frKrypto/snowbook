import type { Metadata } from "next";

import { ProjectListItem } from "@/components/records";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your projects" };

export default async function PortalProjectsPage() {
  const { clientId } = await requireClient();

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, status, event_date, delivery_due_date")
    .eq("client_id", clientId)
    .order("event_date", { ascending: false, nullsFirst: false });

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="Your projects"
        description="Every shoot we're working on together."
      />

      <Card>
        {projects && projects.length > 0 ? (
          <ul className="divide-y divide-line">
            {projects.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                href={`/portal/projects/${project.id}`}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No projects yet"
            description="Your project will show up here once it's booked."
          />
        )}
      </Card>
    </>
  );
}
