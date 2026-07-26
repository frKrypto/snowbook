"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-3xl font-semibold tracking-tight text-ink">
        Something went wrong
      </p>
      <p className="mt-2 max-w-md text-sm text-ink-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Go home
        </ButtonLink>
      </div>
    </main>
  );
}
