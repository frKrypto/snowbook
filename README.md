# Snowbook

A client portal for a small videography studio — clients, projects and
invoicing in one place, with clients paying by PayPal from their own login.

Built as an internal tool first: the studio can run real workflows through it
before any client account is handed out.

- **Next.js** (App Router) + TypeScript
- **Supabase** for auth and Postgres, with row level security doing the
  access control
- **Tailwind CSS v4** for styling
- **PayPal** Orders v2 for payments
- Deploys to **Vercel**

## What's in it

**Admin console** (`/admin`)

- Clients: full CRUD, search by name/email/company, filter by status
  (lead / active / past), detail page with linked projects and invoices
- Projects: CRUD tied to a client, five-stage status, shoot and delivery
  dates, and a per-project checklist
- Invoices: line items with auto-calculated subtotal/tax/total, draft →
  sent → paid/overdue, manual payment recording for money taken offline
- Dashboard: active projects, outstanding and overdue totals, upcoming
  shoots, recent activity

**Client portal** (`/portal`)

- Read-only view of their own projects with a stage timeline and checklist
- Their invoices, with a "Pay now" PayPal checkout
- Dashboard showing active projects and anything outstanding

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Create the Supabase project

Create a project at [supabase.com](https://supabase.com), then fill in
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` in `.env.local` from **Project Settings → API**.

### 3. Run the migrations

In the Supabase SQL editor, run the two files in `supabase/migrations/` in
order:

1. `20260101000000_init.sql` — tables, enums, triggers
2. `20260101000001_rls.sql` — row level security policies

Or, with the Supabase CLI linked to your project:

```bash
supabase db push
```

### 4. Create your admin account

Supabase has no self-serve admin signup by design, so the first admin is made
with the service-role key:

```bash
npm run admin:create -- you@studio.com 'a-strong-password' Your Name
```

### 5. Seed some test data (optional but recommended)

```bash
npm run db:seed
```

This creates three clients, four projects at different stages, and six
invoices — including a paid deposit, an overdue final balance and a draft that
should stay invisible to the client. It also creates a portal login for
`maya.ellison@example.com` (password from `SEED_CLIENT_PASSWORD`, default
`snowbook-demo-2026`) so you can see both sides.

Re-running the seed replaces those records and leaves everything else alone.

### 6. Run it

```bash
npm run dev
```

## PayPal

Payments are optional to get started. With the PayPal variables blank, the
portal shows a "contact the studio" note where the pay button would be, and
everything else works.

To enable payments:

1. Create an app at
   [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox)
   and copy the client ID and secret into `NEXT_PUBLIC_PAYPAL_CLIENT_ID` and
   `PAYPAL_CLIENT_SECRET`.
2. Leave `PAYPAL_ENV=sandbox` until you're ready to take real money; set it to
   `live` and swap in live credentials when you are.
3. Create a webhook pointing at `https://your-domain/api/paypal/webhook`,
   subscribed to **PAYMENT.CAPTURE.COMPLETED**, and put its ID in
   `PAYPAL_WEBHOOK_ID`.

The invoice is marked paid by two independent paths: the browser capture call
when the payer finishes checkout, and the webhook. Either alone is enough, and
recording is idempotent, so the invoice can't be double-credited if both land.

For local webhook testing, expose your dev server with a tunnel
(`ngrok http 3000`) and point the webhook at the tunnel URL.

## Inviting a client

From a client's detail page, **Send portal invite** emails them a link to set
a password. The invite carries their role and client id in user metadata,
which a trigger copies onto their profile row — that link is what every RLS
policy keys off.

Supabase's default email sending is rate-limited and only really suitable for
testing. Configure SMTP under **Authentication → Emails** before inviting real
clients, and add `https://your-domain/auth/callback` to the allowed redirect
URLs under **Authentication → URL Configuration**.

## How access control works

Authorisation is enforced in the database, not in the app. Every table has RLS
enabled and denies by default:

- `is_admin()` and `auth_client_id()` are `SECURITY DEFINER` helpers, so
  reading `profiles` inside a policy doesn't recurse into the policy on
  `profiles`
- Admins get full access to everything
- Clients can only ever `SELECT`, and only rows reachable from their own
  `client_id`
- **Draft invoices are invisible to clients** — the policy filters on
  `status <> 'draft'`, so an invoice appears in the portal only once the admin
  marks it sent
- Clients have **no write policy at all** on invoices. Payment state is
  written server-side with the service role after PayPal confirms the capture,
  so a crafted request from the browser can't mark an invoice paid
- A trigger blocks anyone from changing their own `role` or `client_id`, which
  would otherwise be a way to escalate straight past every policy

The service-role key bypasses RLS entirely. It is used in exactly two places —
inviting users, and recording confirmed payments — and never reaches the
browser.

Those claims are tested rather than asserted. `npm run test:rls` spins up a
throwaway Postgres cluster, applies the migrations against a stand-in for
Supabase's `auth` schema, and checks each property from the perspective of an
admin, two different clients, and an anonymous visitor — including that a
client can't promote themselves to admin or repoint their profile at someone
else's records.

Totals are derived in the database too: line item amounts are a generated
column, and triggers recalculate the invoice subtotal, tax and total on every
change, so a tampered form can't set its own price.

## Deploying to Vercel

Import the repo, then add every variable from `.env.example` in **Settings →
Environment Variables**. Set `NEXT_PUBLIC_SITE_URL` to the production domain so
invite links point at the right place, and add that domain's `/auth/callback`
to Supabase's allowed redirect URLs.

## Project layout

```
src/
  app/
    admin/          Studio console — clients, projects, invoices, dashboard
    portal/         Client-facing portal (read-only + pay)
    api/paypal/     create-order, capture-order, webhook
    auth/           Sign-in/out actions and the email-link callback
  components/       Shared UI kit and record views
  lib/
    supabase/       Browser, server (RLS) and service-role clients
    auth.ts         Session + role guards
    paypal.ts       Orders v2 wrapper
    payments.ts     Idempotent payment recording
    statuses.ts     Status metadata and derived states
    validation.ts   Form-data parsing for server actions
supabase/
  migrations/     Schema and RLS
  tests/          RLS test suite (see npm run test:rls)
scripts/          Seed, admin bootstrap, RLS test runner
```

## Notes and next steps

Deliberately not built yet, but the structure leaves room for them: contracts
and e-signatures, scheduling, automated email sequences, and
questionnaires/forms. Each would be a new table plus a route group alongside
the existing ones.

A couple of things worth knowing:

- Overdue status is derived from the due date at render time, so it's always
  accurate. `mark_overdue_invoices()` exists to persist it on a schedule
  (pg_cron) if you ever want the stored column to match.
- Partial payments are modelled as separate invoices against the same project —
  a deposit invoice and a final invoice — rather than part-payments on one
  invoice.
- File delivery isn't in this MVP. Supabase Storage with a policy mirroring the
  invoice policies would be the natural place for it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:rls` | Run the row level security test suite |
| `npm run db:seed` | Seed demo clients, projects and invoices |
| `npm run admin:create` | Create or promote an admin account |
