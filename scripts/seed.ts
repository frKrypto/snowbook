/**
 * Fills the database with a realistic slice of studio work so the app can be
 * exercised end to end: a paid deposit, an overdue final, a draft, projects at
 * different stages, and a client account you can actually sign into.
 *
 *   npm run db:seed
 *
 * Re-running replaces the seeded records (matched by email) and leaves any
 * other data alone.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/database.types";
import { loadEnv, requireEnv } from "./load-env";

loadEnv();

const supabase = createClient<Database>(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const DEMO_CLIENT_PASSWORD =
  process.env.SEED_CLIENT_PASSWORD ?? "snowbook-demo-2026";

/** Dates relative to today, so seeded data never looks stale. */
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

interface LineItemSeed {
  description: string;
  quantity: number;
  rate: number;
}

async function insertInvoice(options: {
  clientId: string;
  projectId: string | null;
  title: string;
  status: "draft" | "sent" | "paid";
  issueDate: string;
  dueDate: string;
  taxRate?: number;
  notes?: string;
  lineItems: LineItemSeed[];
  markPaidOn?: string;
}) {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      client_id: options.clientId,
      project_id: options.projectId,
      title: options.title,
      status: options.status === "paid" ? "sent" : options.status,
      issue_date: options.issueDate,
      due_date: options.dueDate,
      tax_rate: options.taxRate ?? 0,
      notes: options.notes ?? null,
      sent_at:
        options.status === "draft"
          ? null
          : new Date(`${options.issueDate}T10:00:00Z`).toISOString(),
    })
    .select("id")
    .single();

  if (error || !invoice) throw new Error(error?.message ?? "invoice insert failed");

  const { error: itemsError } = await supabase.from("invoice_line_items").insert(
    options.lineItems.map((item, index) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      position: index,
    })),
  );
  if (itemsError) throw new Error(itemsError.message);

  if (options.status === "paid") {
    // Totals are computed by triggers, so read the row back before settling it.
    const { data: saved } = await supabase
      .from("invoices")
      .select("total")
      .eq("id", invoice.id)
      .single();

    await supabase
      .from("invoices")
      .update({
        status: "paid",
        amount_paid: saved?.total ?? 0,
        paid_at: new Date(
          `${options.markPaidOn ?? options.issueDate}T14:30:00Z`,
        ).toISOString(),
        paypal_transaction_id: `SEED-${invoice.id.slice(0, 8).toUpperCase()}`,
      })
      .eq("id", invoice.id);
  }

  return invoice.id;
}

async function ensurePortalUser(email: string, clientId: string, fullName: string) {
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_CLIENT_PASSWORD,
    email_confirm: true,
    user_metadata: { role: "client", client_id: clientId, full_name: fullName },
  });

  let userId = created?.user?.id;

  if (error) {
    const { data: list } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const existing = list?.users.find(
      (user) => user.email?.toLowerCase() === email,
    );
    if (!existing) {
      console.warn(`  ! Could not create portal login for ${email}: ${error.message}`);
      return;
    }
    userId = existing.id;
    await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_CLIENT_PASSWORD,
    });
  }

  await supabase
    .from("profiles")
    .upsert(
      { id: userId!, role: "client", client_id: clientId, full_name: fullName },
      { onConflict: "id" },
    );
}

async function main() {
  const seedEmails = [
    "maya.ellison@example.com",
    "theo@northlightcoffee.example",
    "priya.raghavan@example.com",
  ];

  console.log("Clearing previously seeded clients…");
  const { error: clearError } = await supabase
    .from("clients")
    .delete()
    .in("email", seedEmails);
  if (clearError) throw new Error(clearError.message);

  console.log("Inserting clients…");
  const { data: clients, error: clientError } = await supabase
    .from("clients")
    .insert([
      {
        name: "Maya Ellison",
        email: seedEmails[0],
        phone: "(555) 014-8829",
        company: null,
        status: "active",
        notes:
          "Found us through the Bramble Barn preferred-vendor list. Wants a documentary feel, no posed group shots beyond the family formals.",
      },
      {
        name: "Theo Barrett",
        email: seedEmails[1],
        phone: "(555) 071-3350",
        company: "Northlight Coffee",
        status: "active",
        notes:
          "Roastery owner. Second project with us. Approves quickly, prefers a single round of notes over a long back-and-forth.",
      },
      {
        name: "Priya Raghavan",
        email: seedEmails[2],
        phone: "(555) 262-9041",
        company: null,
        status: "lead",
        notes:
          "Enquired about an engagement session in the autumn. Sent the pricing guide, waiting to hear back on dates.",
      },
    ])
    .select("id, email, name");

  if (clientError || !clients) throw new Error(clientError?.message ?? "no clients");

  const byEmail = new Map(clients.map((client) => [client.email, client]));
  const maya = byEmail.get(seedEmails[0])!;
  const theo = byEmail.get(seedEmails[1])!;
  const priya = byEmail.get(seedEmails[2])!;

  console.log("Inserting projects…");
  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .insert([
      {
        client_id: maya.id,
        title: "Ellison & Vance — Wedding Film",
        description:
          "Full-day coverage at Bramble Barn: 8 hours, two shooters, drone establishing shots if weather allows. Deliverables are a 6–8 minute highlight film, a full ceremony edit and a 60-second social cutdown.",
        status: "booked",
        event_date: daysFromNow(38),
        delivery_due_date: daysFromNow(94),
      },
      {
        client_id: theo.id,
        title: "Northlight Coffee — Brand Story",
        description:
          "Roastery brand film covering sourcing, roasting and the counter. One shoot day plus a half-day of pickups. Deliverables: a 2-minute hero film and six vertical cutdowns for social.",
        status: "in_progress",
        event_date: daysFromNow(-12),
        delivery_due_date: daysFromNow(9),
      },
      {
        client_id: theo.id,
        title: "Northlight Coffee — Spring Menu Teasers",
        description:
          "Three 15-second vertical teasers for the spring menu launch. Shot alongside the brand story day.",
        status: "delivered",
        event_date: daysFromNow(-12),
        delivery_due_date: daysFromNow(-2),
      },
      {
        client_id: priya.id,
        title: "Raghavan Engagement Session",
        description:
          "Golden-hour engagement session, location to be confirmed. Roughly 90 minutes of coverage with a short social edit.",
        status: "inquiry",
        event_date: null,
        delivery_due_date: null,
      },
    ])
    .select("id, title");

  if (projectError || !projects) throw new Error(projectError?.message ?? "no projects");

  const projectByTitle = new Map(projects.map((project) => [project.title, project]));
  const wedding = projectByTitle.get("Ellison & Vance — Wedding Film")!;
  const brandStory = projectByTitle.get("Northlight Coffee — Brand Story")!;
  const teasers = projectByTitle.get("Northlight Coffee — Spring Menu Teasers")!;

  console.log("Inserting tasks…");
  const { error: taskError } = await supabase.from("tasks").insert([
    { project_id: wedding.id, name: "Send contract and deposit invoice", is_done: true, position: 0 },
    { project_id: wedding.id, name: "Venue walkthrough at Bramble Barn", is_done: true, position: 1 },
    { project_id: wedding.id, name: "Confirm second shooter", is_done: false, due_date: daysFromNow(14), position: 2 },
    { project_id: wedding.id, name: "Lock the run of show with the planner", is_done: false, due_date: daysFromNow(28), position: 3 },
    { project_id: wedding.id, name: "Prep and charge kit", is_done: false, due_date: daysFromNow(37), position: 4 },

    { project_id: brandStory.id, name: "Shoot day — roastery", is_done: true, position: 0 },
    { project_id: brandStory.id, name: "Back up and log footage", is_done: true, position: 1 },
    { project_id: brandStory.id, name: "First cut of the hero film", is_done: true, due_date: daysFromNow(-3), position: 2 },
    { project_id: brandStory.id, name: "Colour grade and sound mix", is_done: false, due_date: daysFromNow(4), position: 3 },
    { project_id: brandStory.id, name: "Export vertical cutdowns", is_done: false, due_date: daysFromNow(7), position: 4 },

    { project_id: teasers.id, name: "Edit three teasers", is_done: true, position: 0 },
    { project_id: teasers.id, name: "Deliver via download link", is_done: true, position: 1 },
  ]);
  if (taskError) throw new Error(taskError.message);

  console.log("Inserting invoices…");

  // Wedding: deposit already paid, final balance issued and due before the day.
  await insertInvoice({
    clientId: maya.id,
    projectId: wedding.id,
    title: "50% booking deposit",
    status: "paid",
    issueDate: daysFromNow(-52),
    dueDate: daysFromNow(-38),
    lineItems: [
      { description: "Wedding film package — booking deposit", quantity: 1, rate: 2200 },
    ],
    markPaidOn: daysFromNow(-49),
    notes: "Thank you — your date is now held.",
  });

  await insertInvoice({
    clientId: maya.id,
    projectId: wedding.id,
    title: "Final balance",
    status: "sent",
    issueDate: daysFromNow(-6),
    dueDate: daysFromNow(24),
    taxRate: 8.5,
    lineItems: [
      { description: "Wedding film package — final balance", quantity: 1, rate: 2200 },
      { description: "Second shooter — full day", quantity: 1, rate: 450 },
      { description: "Drone coverage", quantity: 1, rate: 300 },
    ],
    notes: "Due two weeks before the wedding date.",
  });

  // Northlight: deposit paid, final balance now overdue.
  await insertInvoice({
    clientId: theo.id,
    projectId: brandStory.id,
    title: "Production deposit",
    status: "paid",
    issueDate: daysFromNow(-40),
    dueDate: daysFromNow(-26),
    lineItems: [
      { description: "Brand story film — 50% production deposit", quantity: 1, rate: 1750 },
    ],
    markPaidOn: daysFromNow(-37),
  });

  await insertInvoice({
    clientId: theo.id,
    projectId: brandStory.id,
    title: "Final balance",
    status: "sent",
    issueDate: daysFromNow(-25),
    dueDate: daysFromNow(-4),
    lineItems: [
      { description: "Brand story film — final balance", quantity: 1, rate: 1750 },
      { description: "Additional vertical cutdowns", quantity: 3, rate: 150 },
    ],
    notes: "Net 21. Bank transfer also accepted — just let us know.",
  });

  await insertInvoice({
    clientId: theo.id,
    projectId: teasers.id,
    title: "Spring menu teasers",
    status: "paid",
    issueDate: daysFromNow(-18),
    dueDate: daysFromNow(-4),
    lineItems: [{ description: "Vertical teaser edits", quantity: 3, rate: 275 }],
    markPaidOn: daysFromNow(-15),
  });

  // Priya is still a lead, so her proposal stays a draft and never reaches the portal.
  await insertInvoice({
    clientId: priya.id,
    projectId: null,
    title: "Engagement session — proposal",
    status: "draft",
    issueDate: daysFromNow(-2),
    dueDate: daysFromNow(28),
    lineItems: [
      { description: "Engagement session — 90 minutes", quantity: 1, rate: 650 },
      { description: "Social edit (60 seconds)", quantity: 1, rate: 200 },
    ],
    notes: "Draft — not yet sent.",
  });

  console.log("Creating a portal login for the demo client…");
  await ensurePortalUser(maya.email, maya.id, maya.name);

  console.log(`
✓ Seed complete.

  Client portal login
    email:    ${maya.email}
    password: ${DEMO_CLIENT_PASSWORD}

  Admin login: create one with
    npm run admin:create -- you@studio.com 'a-strong-password'
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
