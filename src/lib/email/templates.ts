import { formatDate, formatMoney } from "@/lib/format";

/**
 * Transactional email templates.
 *
 * Styles are inline and the layout is table-based on purpose: most clients
 * strip <style> blocks, and Outlook still does not do flexbox or grid. Every
 * interpolated value is escaped — names and titles are free text.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const COLORS = {
  canvas: "#faf8f5",
  surface: "#ffffff",
  ink: "#191c19",
  inkMuted: "#6b6459",
  inkFaint: "#98907f",
  line: "#e7e2d9",
  brand: "#1f2a24",
  accent: "#a87c4f",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(options: {
  studioName: string;
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const studio = escapeHtml(options.studioName);

  const cta =
    options.ctaLabel && options.ctaUrl
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
        <tr>
          <td style="border-radius:8px;background:${COLORS.brand};">
            <a href="${escapeHtml(options.ctaUrl)}"
               style="display:inline-block;padding:13px 26px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
              ${escapeHtml(options.ctaLabel)}
            </a>
          </td>
        </tr>
      </table>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(options.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.canvas};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
        <tr>
          <td style="padding-bottom:20px;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:600;color:${COLORS.ink};letter-spacing:-0.01em;">
            ${studio}
          </td>
        </tr>
        <tr>
          <td style="background:${COLORS.surface};border:1px solid ${COLORS.line};border-radius:14px;padding:32px;">
            <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:23px;line-height:1.25;font-weight:600;color:${COLORS.ink};letter-spacing:-0.01em;">
              ${escapeHtml(options.heading)}
            </h1>
            ${options.bodyHtml}
            ${cta}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${COLORS.inkFaint};">
            ${options.footerNote ? `${escapeHtml(options.footerNote)}<br><br>` : ""}
            Sent by ${studio}.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const p = (content: string) =>
  `<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${COLORS.inkMuted};">${content}</p>`;

/** Key/value block used for invoice and payment summaries. */
function summary(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value], index) => `
      <tr>
        <td style="padding:${index === 0 ? "0" : "9px"} 0 9px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${COLORS.inkMuted};border-bottom:1px solid ${COLORS.line};">${escapeHtml(label)}</td>
        <td align="right" style="padding:${index === 0 ? "0" : "9px"} 0 9px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:${COLORS.ink};border-bottom:1px solid ${COLORS.line};">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 4px;">${cells}</table>`;
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

export function invoiceSentEmail(options: {
  studioName: string;
  clientName: string;
  invoiceNumber: string;
  title: string | null;
  total: number;
  dueDate: string | null;
  url: string;
}): RenderedEmail {
  const firstName = options.clientName.split(/\s+/)[0] || "there";
  const amount = formatMoney(options.total);
  const due = options.dueDate ? formatDate(options.dueDate) : null;

  const rows: Array<[string, string]> = [
    ["Invoice", options.invoiceNumber],
    ...(options.title ? ([["Reference", options.title]] as Array<[string, string]>) : []),
    ["Amount due", amount],
    ...(due ? ([["Due", due]] as Array<[string, string]>) : []),
  ];

  return {
    subject: `Invoice ${options.invoiceNumber} from ${options.studioName} — ${amount}`,
    html: layout({
      studioName: options.studioName,
      preheader: `${amount} due${due ? ` by ${due}` : ""}.`,
      heading: `Your invoice is ready`,
      bodyHtml:
        p(`Hi ${escapeHtml(firstName)},`) +
        p(
          `Here's invoice <strong style="color:${COLORS.ink};">${escapeHtml(options.invoiceNumber)}</strong>${
            due ? `, due <strong style="color:${COLORS.ink};">${escapeHtml(due)}</strong>` : ""
          }. You can view it and pay securely by card or PayPal from your portal.`,
        ) +
        summary(rows),
      ctaLabel: "View and pay invoice",
      ctaUrl: options.url,
      footerNote: "You can pay by card without a PayPal account.",
    }),
    text: [
      `Hi ${firstName},`,
      ``,
      `Here's invoice ${options.invoiceNumber}${due ? `, due ${due}` : ""}.`,
      ``,
      `Amount due: ${amount}`,
      ``,
      `View and pay: ${options.url}`,
      ``,
      `You can pay by card without a PayPal account.`,
      ``,
      `— ${options.studioName}`,
    ].join("\n"),
  };
}

export function paymentReceiptEmail(options: {
  studioName: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  url: string;
}): RenderedEmail {
  const firstName = options.clientName.split(/\s+/)[0] || "there";
  const amount = formatMoney(options.amount);

  return {
    subject: `Payment received — invoice ${options.invoiceNumber}`,
    html: layout({
      studioName: options.studioName,
      preheader: `We've received your ${amount} payment. Thank you!`,
      heading: "Thanks — payment received",
      bodyHtml:
        p(`Hi ${escapeHtml(firstName)},`) +
        p(
          `We've received your payment of <strong style="color:${COLORS.ink};">${escapeHtml(amount)}</strong> for invoice ${escapeHtml(options.invoiceNumber)}. Nothing further is needed.`,
        ) +
        summary([
          ["Invoice", options.invoiceNumber],
          ["Amount paid", amount],
          ["Received", formatDate(new Date().toISOString())],
        ]),
      ctaLabel: "View invoice",
      ctaUrl: options.url,
    }),
    text: [
      `Hi ${firstName},`,
      ``,
      `We've received your payment of ${amount} for invoice ${options.invoiceNumber}. Nothing further is needed.`,
      ``,
      `View invoice: ${options.url}`,
      ``,
      `— ${options.studioName}`,
    ].join("\n"),
  };
}

export function deliveryReadyEmail(options: {
  studioName: string;
  clientName: string;
  projectTitle: string;
  fileCount: number;
  url: string;
}): RenderedEmail {
  const firstName = options.clientName.split(/\s+/)[0] || "there";
  const noun = options.fileCount === 1 ? "file is" : "files are";

  return {
    subject: `Your files from ${options.studioName} are ready`,
    html: layout({
      studioName: options.studioName,
      preheader: `${options.fileCount} ${noun} ready to download.`,
      heading: "Your files are ready",
      bodyHtml:
        p(`Hi ${escapeHtml(firstName)},`) +
        p(
          `Your ${escapeHtml(options.fileCount === 1 ? "file" : "files")} for <strong style="color:${COLORS.ink};">${escapeHtml(options.projectTitle)}</strong> ${options.fileCount === 1 ? "is" : "are"} ready. Sign in to your portal to download ${options.fileCount === 1 ? "it" : "them"}.`,
        ),
      ctaLabel: "Download your files",
      ctaUrl: options.url,
      footerNote: "Your files stay available in the portal — grab them any time.",
    }),
    text: [
      `Hi ${firstName},`,
      ``,
      `Your ${options.fileCount === 1 ? "file" : "files"} for ${options.projectTitle} ${options.fileCount === 1 ? "is" : "are"} ready to download.`,
      ``,
      `Download: ${options.url}`,
      ``,
      `— ${options.studioName}`,
    ].join("\n"),
  };
}

export function studioPaymentAlertEmail(options: {
  studioName: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  url: string;
}): RenderedEmail {
  const amount = formatMoney(options.amount);

  return {
    subject: `${amount} paid — ${options.clientName} (${options.invoiceNumber})`,
    html: layout({
      studioName: options.studioName,
      preheader: `${options.clientName} paid ${amount}.`,
      heading: "You've been paid",
      bodyHtml:
        p(
          `<strong style="color:${COLORS.ink};">${escapeHtml(options.clientName)}</strong> has paid invoice ${escapeHtml(options.invoiceNumber)}.`,
        ) +
        summary([
          ["Client", options.clientName],
          ["Invoice", options.invoiceNumber],
          ["Amount", amount],
        ]),
      ctaLabel: "Open invoice",
      ctaUrl: options.url,
    }),
    text: [
      `${options.clientName} has paid invoice ${options.invoiceNumber}.`,
      ``,
      `Amount: ${amount}`,
      ``,
      `Open: ${options.url}`,
    ].join("\n"),
  };
}
