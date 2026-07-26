# Roadmap and open questions

Working notes for the Snowbook MVP — what's verified, what isn't, and what to
pick up next. Delete or fold into issues once the project has a tracker.

## Status

The MVP covers the three areas it set out to: client management, project
management, and invoicing with PayPal payments. Build, typecheck and lint are
clean, and the row level security policies have a test suite behind them
(`npm run test:rls`, 32 assertions).

**What has been verified**

- Production build across all 25 routes
- TypeScript and ESLint clean
- The RLS policies, against a real Postgres cluster: client isolation, draft
  invoices hidden, clients unable to write payment state or escalate their own
  role, admin full access, anonymous denied
- Invoice totals derived correctly by trigger on insert, update and delete of
  line items

**What has NOT been verified**

Nothing has run against a live Supabase project yet. Specifically untested:

- Sign-in, invite, and set-password end to end
- Server actions against a real database
- PayPal sandbox checkout and the webhook round trip
- Rendering in a real browser at real breakpoints

## Before you start

Create the Supabase project, run both migrations, then `npm run admin:create`
and `npm run db:seed`, and click through both sides. See the README for the
full sequence.

The one thing that will stop you cold is **email**. Supabase's built-in sender
is rate-limited to a couple of messages an hour and tends to land in spam, so
the client invite flow is not really testable until SMTP is configured under
**Authentication → Emails**. Resend or Postmark take about ten minutes to wire
up. Everything else — clients, projects, invoices, the portal — works without
it.

PayPal can wait. With those environment variables blank the portal degrades to
a "contact the studio" note instead of the pay button.

## Open decision: deleting a client with paid invoices

There is an inconsistency worth resolving before real data goes in.

Deleting a paid invoice directly is blocked, on the grounds that it is part of
the financial record. But deleting a *client* cascades through the foreign key
and silently takes their paid invoices with it. Those two rules disagree.

Two reasonable fixes:

1. Refuse to delete a client who has paid invoices, mirroring the invoice rule.
2. Archive clients instead of deleting them — a status value plus a filter on
   the list view.

Archiving is probably the right answer for a business, and it is the smaller
change of the two in practice. Needs a decision either way.

## Next up, in priority order

1. **Email on invoice send, and on invite.** The biggest workflow gap. Marking
   an invoice sent only makes it visible in the portal — the client has no idea
   a bill exists until they happen to log in. This matches the original spec,
   but it is the thing that makes the tool usable with real clients.

2. **Print / PDF view of an invoice.** Clients and bookkeepers ask for one
   constantly. `InvoiceDocument` is already a self-contained component and
   `globals.css` has a `no-print` hook, so this is mostly print styles plus a
   route.

3. **Per-file titles and reordering on deliveries.** Files currently show their
   filename; letting the studio label them ("Highlight film", "Full ceremony")
   and set an order would make the portal read better.

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
  deleting the auth user in the Supabase console.

## Deliberately out of scope

Left for later by design, and the structure leaves room for each: contracts and
e-signatures, scheduling, automated email sequences, questionnaires and forms.
Each is a new table plus a route group alongside the existing ones.

## Changelog

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
