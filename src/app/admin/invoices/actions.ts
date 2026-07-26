"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ValidationError,
  decimal,
  optionalDate,
  optionalString,
  optionalUuid,
  requiredUuid,
  toFormError,
} from "@/lib/validation";

const MAX_LINE_ITEMS = 50;

interface LineItemInput {
  description: string;
  quantity: number;
  rate: number;
  position: number;
}

/**
 * Line items arrive as parallel arrays (one entry per row in the form). Rows
 * with no description at all are treated as blanks and skipped, so an empty
 * trailing row doesn't block saving.
 */
function readLineItems(formData: FormData): LineItemInput[] {
  const descriptions = formData.getAll("line_description");
  const quantities = formData.getAll("line_quantity");
  const rates = formData.getAll("line_rate");

  if (descriptions.length > MAX_LINE_ITEMS) {
    throw new ValidationError(`An invoice can have at most ${MAX_LINE_ITEMS} line items.`);
  }

  const items: LineItemInput[] = [];

  descriptions.forEach((rawDescription, index) => {
    const description = String(rawDescription ?? "").trim();
    if (!description) return;

    items.push({
      description: description.slice(0, 500),
      quantity: decimal(quantities[index] ?? null, "Quantity", { max: 100_000 }),
      rate: decimal(rates[index] ?? null, "Rate"),
      position: items.length,
    });
  });

  if (items.length === 0) {
    throw new ValidationError("Add at least one line item with a description.");
  }

  return items;
}

function readInvoiceFields(formData: FormData) {
  const issueDate = optionalDate(formData, "issue_date");
  const dueDate = optionalDate(formData, "due_date");

  if (issueDate && dueDate && dueDate < issueDate) {
    throw new ValidationError("The due date can't be before the issue date.");
  }

  return {
    client_id: requiredUuid(formData, "client_id", "Client"),
    project_id: optionalUuid(formData, "project_id"),
    title: optionalString(formData, "title", 200),
    issue_date: issueDate ?? undefined,
    due_date: dueDate,
    tax_rate: decimal(formData.get("tax_rate"), "Tax rate", { max: 100 }),
    notes: optionalString(formData, "notes", 5000),
  };
}

/**
 * The client and project selects are independent inputs, so verify the pair
 * actually belongs together before writing it.
 */
async function assertProjectBelongsToClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  projectId: string | null,
) {
  if (!projectId) return;

  const { data } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!data || data.client_id !== clientId) {
    throw new ValidationError(
      "That project belongs to a different client. Pick a project from the selected client.",
    );
  }
}

/** Guards against editing an invoice that has already been paid. */
async function assertEditable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
) {
  const { data } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!data) throw new ValidationError("Invoice not found.");
  if (data.status === "paid") {
    throw new ValidationError(
      "This invoice has been paid, so it can no longer be edited.",
    );
  }
}

export async function createInvoiceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  let invoiceId: string;
  try {
    const fields = readInvoiceFields(formData);
    const lineItems = readLineItems(formData);
    const supabase = await createClient();

    await assertProjectBelongsToClient(
      supabase,
      fields.client_id,
      fields.project_id,
    );

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert(fields)
      .select("id")
      .single();

    if (error || !invoice) {
      return { error: error?.message ?? "Could not create invoice." };
    }
    invoiceId = invoice.id;

    const { error: itemsError } = await supabase.from("invoice_line_items").insert(
      lineItems.map((item) => ({ ...item, invoice_id: invoiceId })),
    );

    if (itemsError) {
      // Don't leave a totals-less shell behind if the items failed to save.
      await supabase.from("invoices").delete().eq("id", invoiceId);
      return { error: itemsError.message };
    }
  } catch (error) {
    return { error: toFormError(error) };
  }

  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices/${invoiceId}`);
}

export async function updateInvoiceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  let invoiceId: string;
  try {
    invoiceId = requiredUuid(formData, "id", "Invoice");
    const fields = readInvoiceFields(formData);
    const lineItems = readLineItems(formData);
    const supabase = await createClient();

    await assertEditable(supabase, invoiceId);
    await assertProjectBelongsToClient(
      supabase,
      fields.client_id,
      fields.project_id,
    );

    const { error } = await supabase
      .from("invoices")
      .update(fields)
      .eq("id", invoiceId);
    if (error) return { error: error.message };

    // Line items are small and fully owned by this invoice, so replacing the
    // set is simpler and less error-prone than diffing.
    const { error: deleteError } = await supabase
      .from("invoice_line_items")
      .delete()
      .eq("invoice_id", invoiceId);
    if (deleteError) return { error: deleteError.message };

    const { error: itemsError } = await supabase
      .from("invoice_line_items")
      .insert(lineItems.map((item) => ({ ...item, invoice_id: invoiceId })));
    if (itemsError) return { error: itemsError.message };
  } catch (error) {
    return { error: toFormError(error) };
  }

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  redirect(`/admin/invoices/${invoiceId}`);
}

export async function markInvoiceSentAction(formData: FormData) {
  await requireAdmin();

  const invoiceId = requiredUuid(formData, "id", "Invoice");
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("status", "draft");

  if (error) throw new Error(error.message);

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
}

/** Records a payment taken outside PayPal (bank transfer, cash, cheque). */
export async function markInvoicePaidAction(formData: FormData) {
  await requireAdmin();

  const invoiceId = requiredUuid(formData, "id", "Invoice");
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("total, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice || invoice.status === "paid") return;

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      amount_paid: invoice.total,
    })
    .eq("id", invoiceId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  await requireAdmin();

  const invoiceId = requiredUuid(formData, "id", "Invoice");
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("status, client_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoice?.status === "paid") {
    throw new Error("Paid invoices can't be deleted — they're part of your records.");
  }

  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/invoices");
  redirect("/admin/invoices");
}
