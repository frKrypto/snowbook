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
- Delivery: upload finished films and stills against a project; they appear
  in that client's portal immediately
- Print / PDF of any invoice, for clients and bookkeepers
- Dashboard: active projects, outstanding and overdue totals, upcoming
  shoots, recent activity

**Client portal** (`/portal`)

- Read-only view of their own projects with a stage timeline and checklist
- Downloads of the files delivered against their projects
- Their invoices, with a "Pay now" PayPal checkout
- Dashboard showing active projects and anything outstanding

**Both** get a light/dark/system theme toggle. The preference is stored per
browser and applied before first paint, so there is no flash of the wrong
palette on load; on "system" it follows the OS live.

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

In the Supabase SQL editor, run the files in `supabase/migrations/` in order:

1. `20260101000000_init.sql` — tables, enums, triggers
2. `20260101000001_rls.sql` — row level security policies
3. `20260101000002_deliverables.sql` — file delivery table, the private
   `deliverables` storage bucket, and its storage policies
4. `20260101000003_email.sql` — notification timestamps
5. `20260101000004_client_archive.sql` — archiving, and the triggers that stop
   a delete destroying paid invoices

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

## Email

Four transactional emails, all sent through [Resend](https://resend.com):

| When | Goes to | What it says |
| --- | --- | --- |
| An invoice is marked sent | Client | The amount, the due date, and a link to pay |
| A payment is confirmed | Client | A receipt |
| A payment is confirmed | Studio | That you've been paid, and by whom |
| You press "Notify client" on a delivery | Client | Their files are ready to download |

Set `RESEND_API_KEY` and `EMAIL_FROM` to switch it on. **Without them the app
still works** — invoices become visible in the portal and files still appear,
the client just isn't told about it, and the UI says so rather than pretending
an email went out.

Two deliberate choices:

- **Delivery emails are a separate button**, not automatic on upload. A
  seven-file delivery would otherwise mean seven emails.
- **A failed email never rolls back the thing that triggered it.** If the
  provider is down, the invoice is still marked sent and the payment is still
  recorded — you just get told the email failed, and there's a resend button.

`npm run email:preview` renders every template to `.email-previews/` so you can
open them in a browser and edit the copy without sending anything.

Note this is separate from Supabase's own auth emails (the client invite and
password reset), which are configured under **Authentication → Emails**.

## File delivery

Finished files are uploaded against a project from its admin page and show up
in that client's portal straight away.

The third migration creates a **private** `deliverables` bucket, so nothing is
reachable by URL alone. Objects are stored under a key beginning with the
project id (`<project_id>/<random>-<filename>`), and the storage policies read
that leading segment to decide who may see the object — which is what keeps one
client's delivery out of another's portal.

Two details worth knowing:

- **Uploads go straight from the browser to Storage**, not through a server
  action. Vercel caps a server action body at roughly 4.5MB, which no video
  clears. The row indexing the file is written afterwards by a server action.
- **Downloads use signed URLs that expire after 60 seconds**, minted only after
  the caller's own session has passed both the table and storage policies. A
  copied link goes stale almost immediately.

Supabase enforces a global per-file upload cap that is lower than the bucket's
own limit on smaller plans (50MB on free at the time of writing). Raise it under
**Project Settings → Storage** before delivering full-resolution video, and keep
an eye on storage cost — video is heavy.

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
  `client_id` — including delivered files, in both the table and the storage
  bucket
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

Financial records are protected the same way. A paid invoice cannot be
deleted, and neither can a client who has one — otherwise the `ON DELETE
CASCADE` would quietly take their paid invoices with them. Both refusals are
database triggers rather than app checks, so they hold no matter which client
or key the delete arrives through. **Archive** a finished client instead: they
drop out of the working list, keep every record, and can be restored.

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
- Delivered files live in Supabase Storage. That keeps everything in one place,
  but full-resolution video gets expensive; moving to external links (Vimeo,
  Frame.io) later would only touch the deliverables table and its panel.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:rls` | Run the row level security test suite |
| `npm run email:preview` | Render the transactional emails to `.email-previews/` |
| `npm run db:seed` | Seed demo clients, projects and invoices |
| `npm run admin:create` | Create or promote an admin account |
