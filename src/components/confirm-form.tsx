"use client";

import type { ReactNode } from "react";

/**
 * Form whose submission is gated behind a native confirm dialog. Used for the
 * destructive actions (deleting a client, project or invoice) where a stray
 * click would take related records down with it.
 */
export function ConfirmForm({
  action,
  message,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
