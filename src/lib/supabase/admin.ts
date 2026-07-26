import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";

/**
 * Service-role client. It BYPASSES row level security, so it is reserved for
 * the two things that genuinely need it:
 *
 *   1. inviting users / creating auth accounts (Supabase Auth admin API)
 *   2. writing payment results after PayPal confirms a capture, where the
 *      caller is PayPal rather than a signed-in admin
 *
 * Every other query must go through lib/supabase/server.ts so RLS applies.
 * Never import this into a Client Component.
 */
export function createAdminClient() {
  return createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
