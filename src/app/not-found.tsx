import { Wordmark } from "@/components/brand";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Wordmark className="mb-8" />
      <p className="font-display text-3xl font-semibold tracking-tight text-ink">
        Page not found
      </p>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        That page doesn&rsquo;t exist, or it belongs to someone else&rsquo;s account.
      </p>
      <ButtonLink href="/" className="mt-6">
        Take me back
      </ButtonLink>
    </main>
  );
}
