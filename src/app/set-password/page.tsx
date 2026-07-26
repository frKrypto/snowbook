import type { Metadata } from "next";

import { SetPasswordForm } from "@/app/set-password/set-password-form";
import { Wordmark } from "@/components/brand";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Set your password" };

export default function SetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark className="justify-center" />
          <p className="mt-3 text-sm text-ink-muted">
            Choose a password to finish setting up your portal.
          </p>
        </div>

        <Card className="p-6">
          <SetPasswordForm />
        </Card>
      </div>
    </main>
  );
}
