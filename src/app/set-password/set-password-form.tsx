"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, ButtonLink, Field, FormError } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Phase = "checking" | "ready" | "no-session";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Invite and recovery links can arrive with the session in the URL fragment,
 * which never reaches the server. The browser client picks that up
 * automatically on load, so wait for it before deciding the link is dead.
 */
export function SetPasswordForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          settled = true;
          setPhase("ready");
        }
      },
    );

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setPhase("ready");
      }
    });

    // Give the client a moment to parse the fragment before giving up.
    const timer = setTimeout(() => {
      if (!settled) setPhase("no-session");
    }, 2500);

    return () => {
      clearTimeout(timer);
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // Root redirects to the right surface for the account's role.
    router.replace("/");
    router.refresh();
  }

  if (phase === "checking") {
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        Checking your invite link…
      </p>
    );
  }

  if (phase === "no-session") {
    return (
      <div className="space-y-4 text-center">
        <FormError message="This link is no longer valid. Invite links expire after a while — ask the studio to send a fresh one." />
        <ButtonLink href="/login" variant="secondary" className="w-full">
          Back to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <Field label="New password" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          className="field"
          placeholder="At least 8 characters"
        />
      </Field>

      <Field label="Confirm password" htmlFor="confirm">
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="field"
        />
      </Field>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving…" : "Set password and continue"}
      </Button>
    </form>
  );
}
