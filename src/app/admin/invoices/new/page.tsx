import type { Metadata } from "next";

import { createInvoiceAction } from "@/app/admin/invoices/actions";
import { InvoiceForm } from "@/app/admin/invoices/invoice-form";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; project?: string }>;
}) {
  await requireAdmin();
  const { client: clientParam, project: projectParam } = await searchParams;

  const supabase = await createClient();
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("projects")
      .select("id, title, client_id")
      .order("created_at", { ascending: false }),
  ]);

  // Arriving from a project page pre-selects both the project and its client.
  const fromProject = projectParam
    ? projects?.find((project) => project.id === projectParam)
    : undefined;
  const defaultClientId = fromProject?.client_id ?? clientParam;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Invoices"
        title="New invoice"
        description="Invoices start as drafts — the client sees nothing until you mark it sent."
      />

      {clients && clients.length > 0 ? (
        <InvoiceForm
          action={createInvoiceAction}
          clients={clients}
          projects={projects ?? []}
          defaultClientId={defaultClientId}
          defaultProjectId={fromProject?.id}
          submitLabel="Create invoice"
          cancelHref="/admin/invoices"
        />
      ) : (
        <Card>
          <EmptyState
            title="Add a client first"
            description="Invoices are billed to a client, so start there."
            action={<ButtonLink href="/admin/clients/new">New client</ButtonLink>}
          />
        </Card>
      )}
    </div>
  );
}
