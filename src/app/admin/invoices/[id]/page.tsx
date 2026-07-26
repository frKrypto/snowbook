import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteInvoiceAction,
  markInvoicePaidAction,
  markInvoiceSentAction,
} from "@/app/admin/invoices/actions";
import { ConfirmForm } from "@/components/confirm-form";
import { InvoiceDocument } from "@/components/invoice-document";
import { SubmitButton } from "@/components/submit-button";
import {
  ButtonLink,
  Card,
  CardHeader,
  DefinitionList,
  PageHeader,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients (id, name, email, company), projects (id, title)")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", id)
    .order("position")
    .order("created_at");

  const client = invoice.clients;
  const project = invoice.projects;
  const isPaid = invoice.status === "paid";

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
            "Invoice"
          )
        }
        title={invoice.invoice_number}
        actions={
          !isPaid ? (
            <ButtonLink
              href={`/admin/invoices/${invoice.id}/edit`}
              variant="secondary"
            >
              Edit
            </ButtonLink>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoiceDocument
            invoice={invoice}
            lineItems={lineItems ?? []}
            billedTo={client}
            projectTitle={project?.title ?? null}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Status"
              description={
                invoice.status === "draft"
                  ? "Drafts are hidden from the client portal."
                  : "Visible in the client's portal."
              }
            />
            <div className="space-y-3 px-5 py-4">
              {invoice.status === "draft" ? (
                <form action={markInvoiceSentAction}>
                  <input type="hidden" name="id" value={invoice.id} />
                  <SubmitButton className="w-full" pendingLabel="Marking sent…">
                    Mark as sent
                  </SubmitButton>
                </form>
              ) : null}

              {!isPaid && invoice.status !== "draft" ? (
                <ConfirmForm
                  action={markInvoicePaidAction}
                  message="Record this invoice as paid in full outside PayPal?"
                >
                  <input type="hidden" name="id" value={invoice.id} />
                  <SubmitButton
                    variant="secondary"
                    className="w-full"
                    pendingLabel="Recording…"
                  >
                    Record manual payment
                  </SubmitButton>
                </ConfirmForm>
              ) : null}

              {isPaid ? (
                <p className="text-sm text-positive">
                  Paid in full on {formatDateTime(invoice.paid_at)}.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Record" />
            <DefinitionList
              items={[
                {
                  term: "Project",
                  value: project ? (
                    <Link
                      href={`/admin/projects/${project.id}`}
                      className="text-accent hover:underline"
                    >
                      {project.title}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { term: "Created", value: formatDateTime(invoice.created_at) },
                { term: "Sent", value: formatDateTime(invoice.sent_at) },
                { term: "Paid", value: formatDateTime(invoice.paid_at) },
                {
                  term: "PayPal txn",
                  value: (
                    <span className="tabular text-xs">
                      {invoice.paypal_transaction_id ?? "—"}
                    </span>
                  ),
                },
              ]}
            />
          </Card>

          {!isPaid ? (
            <Card className="border-danger/20">
              <CardHeader title="Danger zone" />
              <div className="px-5 py-4">
                <ConfirmForm
                  action={deleteInvoiceAction}
                  message={`Delete invoice ${invoice.invoice_number}? This cannot be undone.`}
                >
                  <input type="hidden" name="id" value={invoice.id} />
                  <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
                    Delete invoice
                  </SubmitButton>
                </ConfirmForm>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
