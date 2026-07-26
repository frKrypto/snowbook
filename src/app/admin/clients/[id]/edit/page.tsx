import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateClientAction } from "@/app/admin/clients/actions";
import { ClientForm } from "@/app/admin/clients/client-form";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Clients" title={`Edit ${client.name}`} />
      <ClientForm
        action={updateClientAction}
        client={client}
        submitLabel="Save changes"
        cancelHref={`/admin/clients/${client.id}`}
      />
    </div>
  );
}
