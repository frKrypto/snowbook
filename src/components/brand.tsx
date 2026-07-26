import { cn } from "@/components/ui";

/** Small geometric aperture mark — stands in for the studio's own logo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9l7.8 4.5" />
      <path d="M12 12 4.2 16.5" />
      <path d="M12 12l7.8-4.5" />
    </svg>
  );
}

export function Wordmark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark className={cn("text-accent", markClassName)} />
      <span className="font-display text-lg font-semibold tracking-tight text-ink">
        Snowbook
      </span>
    </span>
  );
}
