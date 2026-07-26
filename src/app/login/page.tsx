import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, FormError } from "@/components/ui";
import { getSessionContext } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  link_invalid: "That invite link has expired. Ask your contact to resend it.",
  unlinked:
    "Your account isn't linked to a client record yet. Please contact the studio.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const context = await getSessionContext();
  if (context) redirect(context.profile.role === "admin" ? "/admin" : "/portal");

  const { next, error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark className="justify-center" />
          <p className="mt-3 text-sm text-ink-muted">
            Sign in to your studio portal.
          </p>
        </div>

        <Card className="p-6">
          {error ? (
            <div className="mb-4">
              <FormError
                message={ERROR_MESSAGES[error] ?? "Something went wrong."}
              />
            </div>
          ) : null}

          <LoginForm next={next} />
        </Card>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-faint">
          Clients receive an invite by email. If you need access, contact the
          studio directly.
        </p>

        <div className="mt-6 flex justify-center">
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
}
