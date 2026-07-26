import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Wordmark } from "@/components/brand";
import { ArrowLeftIcon } from "@/components/icons";
import { InvoiceDocument } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { getSessionContext } from "@/lib/auth";
import { studioName } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoice" };

/**
 * Printable invoice, shared by both roles.
 *
 * There is deliberately one route rather than an admin and a portal copy: the
 * query runs under the caller's own session, so RLS already decides what they
 * can see — an admin gets any invoice, a client only their own non-draft ones,
 * and anyone else gets a 404.
 */
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients (name, email, company), projects (title)")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("*")
    .eq("invoice_id", id)
    .order("position")
    .order("created_at");

  const backHref =
    context.profile.role === "admin"
      ? `/admin/invoices/${invoice.id}`
      : `/portal/invoices/${invoice.id}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to invoice
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-baseline justify-between gap-4">
        <Wordmark />
        <p className="text-sm text-ink-muted">{studioName()}</p>
      </div>

      <div className="print-plain">
        <InvoiceDocument
          invoice={invoice}
          lineItems={lineItems ?? []}
          billedTo={invoice.clients}
          projectTitle={invoice.projects?.title ?? null}
        />
      </div>

      <p className="no-print mt-6 text-center text-xs text-ink-faint">
        Choose &ldquo;Save as PDF&rdquo; as the destination to keep a copy.
      </p>
    </main>
  );
}
