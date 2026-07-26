"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { AuthFormState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // Deliberately vague: don't reveal whether the address has an account.
    return { error: "That email and password combination didn't work." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  revalidatePath("/", "layout");

  // Only honour relative paths — an absolute URL here would be an open redirect.
  if (next.startsWith("/") && !next.startsWith("//")) redirect(next);
  redirect(profile?.role === "admin" ? "/admin" : "/portal");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
