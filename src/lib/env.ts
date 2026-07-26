/**
 * Central env access so a missing variable fails loudly at the call site
 * instead of surfacing as a confusing runtime error deeper in the stack.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabaseAnonKey = () =>
  required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

export const supabaseServiceRoleKey = () =>
  required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

export const paypalClientId = () =>
  required("NEXT_PUBLIC_PAYPAL_CLIENT_ID", process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID);

export const paypalClientSecret = () =>
  required("PAYPAL_CLIENT_SECRET", process.env.PAYPAL_CLIENT_SECRET);

export const paypalWebhookId = () =>
  required("PAYPAL_WEBHOOK_ID", process.env.PAYPAL_WEBHOOK_ID);

/** "sandbox" until PAYPAL_ENV is explicitly set to "live". */
export const paypalApiBase = () =>
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export const currency = () => process.env.NEXT_PUBLIC_CURRENCY ?? "USD";

/** Absolute origin, used for invite/redirect links sent by email. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/* -------------------------------------------------------------------------- */
/* Email                                                                       */
/* -------------------------------------------------------------------------- */

export const resendApiKey = () =>
  required("RESEND_API_KEY", process.env.RESEND_API_KEY);

/** Must be an address on a domain verified with the email provider. */
export const emailFrom = () => required("EMAIL_FROM", process.env.EMAIL_FROM);

export const emailReplyTo = () => process.env.EMAIL_REPLY_TO || undefined;

/** Name used in email subjects, signatures and the portal footer. */
export const studioName = () => process.env.NEXT_PUBLIC_STUDIO_NAME ?? "Snowbook";

/** Where "you got paid" alerts go. Alerts are skipped when unset. */
export const studioNotificationEmail = () =>
  process.env.STUDIO_NOTIFICATION_EMAIL || undefined;

/**
 * Email is optional. Without it the app still works — invoices become visible
 * in the portal and files still appear, the client just isn't told about it.
 */
export const isEmailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export const isPayPalConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET,
  );
