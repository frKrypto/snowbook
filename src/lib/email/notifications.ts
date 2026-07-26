import "server-only";

import { sendEmail, type SendEmailResult } from "@/lib/email/send";
import {
  deliveryReadyEmail,
  invoiceSentEmail,
  paymentReceiptEmail,
  studioPaymentAlertEmail,
} from "@/lib/email/templates";
import { siteUrl, studioName, studioNotificationEmail } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Composes and sends the app's notifications.
 *
 * Reads go through the service-role client because one of these paths runs
 * from the PayPal webhook, where there is no session at all. Nothing here
 * takes user input — the only argument is an id the caller has already
 * authorised.
 */

/** Emails the client their invoice and stamps last_emailed_at. */
export async function sendInvoiceNotification(
  invoiceId: string,
): Promise<SendEmailResult> {
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, invoice_number, title, total, due_date, clients (name, email)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice?.clients?.email) {
    return { status: "skipped", reason: "no client email on file" };
  }

  const email = invoiceSentEmail({
    studioName: studioName(),
    clientName: invoice.clients.name,
    invoiceNumber: invoice.invoice_number,
    title: invoice.title,
    total: Number(invoice.total),
    dueDate: invoice.due_date,
    url: `${siteUrl()}/portal/invoices/${invoice.id}`,
  });

  const result = await sendEmail({ to: invoice.clients.email, ...email });

  if (result.status === "sent") {
    await admin
      .from("invoices")
      .update({ last_emailed_at: new Date().toISOString() })
      .eq("id", invoice.id);
  }

  return result;
}

/**
 * Receipt to the client, plus a heads-up to the studio. Failures are logged
 * rather than surfaced — the payment itself has already been recorded and must
 * not be undone because an email bounced.
 */
export async function sendPaymentNotifications(invoiceId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, invoice_number, amount_paid, clients (name, email)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return;

  const amount = Number(invoice.amount_paid);
  const clientName = invoice.clients?.name ?? "Client";

  if (invoice.clients?.email) {
    const receipt = paymentReceiptEmail({
      studioName: studioName(),
      clientName,
      invoiceNumber: invoice.invoice_number,
      amount,
      url: `${siteUrl()}/portal/invoices/${invoice.id}`,
    });
    await sendEmail({ to: invoice.clients.email, ...receipt });
  }

  const studioInbox = studioNotificationEmail();
  if (studioInbox) {
    const alert = studioPaymentAlertEmail({
      studioName: studioName(),
      clientName,
      invoiceNumber: invoice.invoice_number,
      amount,
      url: `${siteUrl()}/admin/invoices/${invoice.id}`,
    });
    await sendEmail({ to: studioInbox, ...alert });
  }
}

/** Tells the client their files are ready and stamps delivery_notified_at. */
export async function sendDeliveryNotification(
  projectId: string,
): Promise<SendEmailResult> {
  const admin = createAdminClient();

  const [{ data: project }, { count }] = await Promise.all([
    admin
      .from("projects")
      .select("id, title, clients (name, email)")
      .eq("id", projectId)
      .maybeSingle(),
    admin
      .from("deliverables")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  if (!project?.clients?.email) {
    return { status: "skipped", reason: "no client email on file" };
  }

  const fileCount = count ?? 0;
  if (fileCount === 0) {
    return { status: "skipped", reason: "nothing has been uploaded yet" };
  }

  const email = deliveryReadyEmail({
    studioName: studioName(),
    clientName: project.clients.name,
    projectTitle: project.title,
    fileCount,
    url: `${siteUrl()}/portal/projects/${project.id}`,
  });

  const result = await sendEmail({ to: project.clients.email, ...email });

  if (result.status === "sent") {
    await admin
      .from("projects")
      .update({ delivery_notified_at: new Date().toISOString() })
      .eq("id", project.id);
  }

  return result;
}
