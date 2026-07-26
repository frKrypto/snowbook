import "server-only";

import { redirect } from "next/navigation";

import type { Profile } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile;
}

/**
 * Resolves the signed-in user and their profile. Returns null when there is no
 * session, so callers can decide whether that is an error or just a
 * logged-out visitor.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile };
}

/** Guard for /admin — sends clients to their own portal rather than 404ing. */
export async function requireAdmin(): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  if (context.profile.role !== "admin") redirect("/portal");
  return context;
}

/**
 * Guard for /portal. Also returns the client_id, since every portal query is
 * scoped by it. A client profile with no client_id is a broken invite, so we
 * surface that rather than silently showing an empty portal.
 */
export async function requireClient(): Promise<
  SessionContext & { clientId: string }
> {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  if (context.profile.role === "admin") redirect("/admin");
  if (!context.profile.client_id) redirect("/login?error=unlinked");
  return { ...context, clientId: context.profile.client_id };
}
