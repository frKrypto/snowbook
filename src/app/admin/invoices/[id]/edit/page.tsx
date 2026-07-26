import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { updateInvoiceAction } from "@/app/admin/invoices/actions";
import { InvoiceForm } from "@/app/admin/invoices/invoice-form";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();
  // Paid invoices are part of the financial record — no edits.
  if (invoice.status === "paid") redirect(`/admin/invoices/${invoice.id}`);

  const [{ data: lineItems }, { data: clients }, { data: projects }] =
    await Promise.all([
      supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", id)
        .order("position")
        .order("created_at"),
      supabase.from("clients").select("id, name").order("name"),
      supabase
        .from("projects")
        .select("id, title, client_id")
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Invoices"
        title={`Edit ${invoice.invoice_number}`}
      />
      <InvoiceForm
        action={updateInvoiceAction}
        invoice={invoice}
        lineItems={lineItems ?? []}
        clients={clients ?? []}
        projects={projects ?? []}
        submitLabel="Save changes"
        cancelHref={`/admin/invoices/${invoice.id}`}
      />
    </div>
  );
}
