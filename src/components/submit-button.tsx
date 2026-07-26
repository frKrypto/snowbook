"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui";

/**
 * Submit button that disables itself while its parent form action is running,
 * so double submits can't create duplicate records.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
    >
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}
