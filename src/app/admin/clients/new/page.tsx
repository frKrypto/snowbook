import type { Metadata } from "next";

import { createClientAction } from "@/app/admin/clients/actions";
import { ClientForm } from "@/app/admin/clients/client-form";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Clients"
        title="New client"
        description="Add the record first — you can invite them to the portal once their details are in."
      />
      <ClientForm
        action={createClientAction}
        submitLabel="Create client"
        cancelHref="/admin/clients"
      />
    </div>
  );
}
