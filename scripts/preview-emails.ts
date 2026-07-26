/**
 * Renders every transactional email to .email-previews/ so the copy and layout
 * can be checked in a browser without sending anything.
 *
 *   npm run email:preview
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  deliveryReadyEmail,
  invoiceSentEmail,
  paymentReceiptEmail,
  studioPaymentAlertEmail,
} from "../src/lib/email/templates";

const studioName = process.env.NEXT_PUBLIC_STUDIO_NAME ?? "Northlight Films";
const site = "https://example.com";

const previews = {
  "invoice-sent": invoiceSentEmail({
    studioName,
    clientName: "Maya Ellison",
    invoiceNumber: "INV-1042",
    title: "Final balance",
    total: 3202.5,
    dueDate: "2026-08-14",
    url: `${site}/portal/invoices/demo`,
  }),
  "payment-receipt": paymentReceiptEmail({
    studioName,
    clientName: "Maya Ellison",
    invoiceNumber: "INV-1042",
    amount: 3202.5,
    url: `${site}/portal/invoices/demo`,
  }),
  "delivery-ready": deliveryReadyEmail({
    studioName,
    clientName: "Theo Barrett",
    projectTitle: "Northlight Coffee — Brand Story",
    fileCount: 7,
    url: `${site}/portal/projects/demo`,
  }),
  "studio-payment-alert": studioPaymentAlertEmail({
    studioName,
    clientName: "Maya Ellison",
    invoiceNumber: "INV-1042",
    amount: 3202.5,
    url: `${site}/admin/invoices/demo`,
  }),
};

const outDir = resolve(process.cwd(), ".email-previews");
mkdirSync(outDir, { recursive: true });

for (const [name, email] of Object.entries(previews)) {
  writeFileSync(resolve(outDir, `${name}.html`), email.html, "utf8");
  writeFileSync(resolve(outDir, `${name}.txt`), email.text, "utf8");
  console.log(`${name}\n  subject: ${email.subject}`);
}

console.log(`\nWrote ${Object.keys(previews).length} previews to ${outDir}`);
