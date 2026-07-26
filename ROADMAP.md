# Roadmap and open questions

Working notes for the Snowbook MVP — what's verified, what isn't, and what to
pick up next. Delete or fold into issues once the project has a tracker.

## Status

The MVP covers the three areas it set out to — client management, project
management, and invoicing with PayPal payments — plus file delivery,
transactional email, invoice printing and theming. Build, typecheck and lint
are clean, and the data-access rules have a test suite behind them
(`npm run test:rls`, 54 assertions).

**What has been verified**

- Production build across all 28 routes; TypeScript and ESLint clean
- The RLS policies, against a real Postgres cluster: client isolation, draft
  invoices hidden, clients unable to write payment state or escalate their own
  role, admin full access, anonymous denied — covering deliverables and
  `storage.objects` as well as the core tables
- Paid invoices, and clients holding them, cannot be deleted; unpaid ones still
  cascade normally
- Invoice totals derived correctly by trigger on insert, update and delete of
  line items
- In a real browser: the invoice line-item form across secure and non-secure
  origins, both colour themes with persistence, and that printing forces the
  light palette even for a dark-mode viewer

**What has NOT been verified**

Nothing has run against a live Supabase project yet. Specifically untested:

- Sign-in, invite, and set-password end to end
- Server actions against a real database
- PayPal sandbox checkout and the webhook round trip
- Rendering in a real browser at real breakpoints

## Before you start

Create the Supabase project, run the five migrations, then
`npm run admin:create` and `npm run db:seed`, and click through both sides. See
the README for the full sequence.

The one thing that will stop you cold is **email**. Supabase's built-in sender
is rate-limited to a couple of messages an hour and tends to land in spam, so
the client invite flow is not really testable until SMTP is configured under
**Authentication → Emails**. Resend or Postmark take about ten minutes to wire
up. Everything else — clients, projects, invoices, the portal — works without
it.

PayPal can wait. With those environment variables blank the portal degrades to
a "contact the studio" note instead of the pay button.

## Next up, in priority order

1. **Per-file titles and reordering on deliveries.** Files currently show their
   filename; letting the studio label them ("Highlight film", "Full ceremony")
   and set an order would make the portal read better.

2. **Resend or revoke a portal invite.** Right now the only way to cut off
   access is deleting the auth user in the Supabase console.

3. **Overdue reminder emails.** The templates and sending layer are in place;
   this needs a scheduled job (pg_cron or a Vercel cron route) that finds
   overdue invoices and nudges once, without nagging daily.

## Known limitations

Worth knowing, none of them urgent:

- **No pagination.** List and dashboard queries fetch all rows and aggregate in
  memory. Genuinely fine at studio scale and will stay fine for a long time,
  but it is the first thing that needs attention if the client list grows into
  the thousands.
- **Overdue status is derived at render time** from the due date, so display is
  always correct, but the stored `status` column drifts. `mark_overdue_invoices()`
  exists to reconcile it on a schedule — wire it to pg_cron if the stored value
  ever needs to be authoritative.
- **Recent activity is derived** from record timestamps rather than a real
  events table. Fine for a dashboard; would need a proper audit log if activity
  history ever becomes a feature.
- **No way to revoke portal access** once a client has been invited, short of
  deleting the auth user in the Supabase console. Archiving a client hides them
  from the admin list but does not sign them out of their portal.

## Deliberately out of scope

Left for later by design, and the structure leaves room for each: contracts and
e-signatures, scheduling, automated email sequences, questionnaires and forms.
Each is a new table plus a route group alongside the existing ones.

## Changelog

- **Client deletion hole closed.** Database triggers now refuse to delete a
  paid invoice, or a client holding one, so the cascade can no longer destroy
  financial records. Archiving replaces deletion for finished clients.
- **Invoice print / PDF view added** at `/invoices/[id]/print`, shared by both
  roles and scoped by RLS. Print styles force the light palette so a dark-mode
  viewer doesn't print a black page.
- **Email added.** Invoice sent, payment receipt, studio payment alert and
  delivery-ready notifications via Resend. Optional: without an API key the app
  behaves exactly as before and says so instead of pretending to send.
- **Dark mode added.** Theme-aware design tokens plus a light/dark/system
  toggle. An inline script resolves the preference before first paint, which is
  why `globals.css` only carries a `[data-theme="dark"]` block and no
  `prefers-color-scheme` duplicate.
- **File delivery added.** Uploads go browser-to-Storage against a private
  bucket, downloads use 60-second signed URLs, and isolation is covered by the
  RLS suite for both the table and `storage.objects`.
- **Invoice form fixed.** It keyed rows off `crypto.randomUUID()`, which is
  undefined outside a secure context, so the whole line-items form collapsed
  when the app was opened over a LAN IP rather than localhost.
