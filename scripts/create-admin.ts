/**
 * Creates (or promotes) an admin account.
 *
 *   npm run admin:create -- owner@studio.com 'a-strong-password'
 *
 * Supabase has no self-serve admin signup by design — the first admin has to be
 * made with the service-role key, which is what this does.
 */
import { createClient } from "@supabase/supabase-js";

import { loadEnv, requireEnv } from "./load-env";

loadEnv();

async function main() {
  const [emailArg, passwordArg, ...nameParts] = process.argv.slice(2);
  const email = (emailArg ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = passwordArg ?? process.env.ADMIN_PASSWORD ?? "";
  const fullName = nameParts.join(" ") || process.env.ADMIN_NAME || "Studio Owner";

  if (!email || !password) {
    console.error(
      "\nUsage: npm run admin:create -- owner@studio.com 'a-strong-password' [Full Name]\n",
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("\nPassword must be at least 8 characters.\n");
    process.exit(1);
  }

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin", full_name: fullName },
  });

  let userId = created?.user?.id;

  if (error) {
    // Already exists: find them and promote instead of failing.
    const { data: list } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const existing = list?.users.find(
      (user) => user.email?.toLowerCase() === email,
    );

    if (!existing) {
      console.error(`\nCould not create the account: ${error.message}\n`);
      process.exit(1);
    }

    userId = existing.id;
    await supabase.auth.admin.updateUserById(existing.id, { password });
    console.log(`Account already existed — password reset and promoted to admin.`);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    { id: userId!, role: "admin", client_id: null, full_name: fullName },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error(`\nCreated the user but couldn't set the profile: ${profileError.message}\n`);
    process.exit(1);
  }

  console.log(`\n✓ Admin ready: ${email}\n  Sign in at /login\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
