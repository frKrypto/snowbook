"use client";

import { useActionState } from "react";

import { deleteClientAction } from "@/app/admin/clients/actions";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/action-state";

/**
 * Hard delete, gated behind a confirm. The database refuses when the client
 * has paid invoices, so the error is surfaced inline rather than thrown —
 * it tells the studio to archive instead.
 */
export function DeleteClientButton({
  clientId,
  clientName,
  paidInvoiceCount,
}: {
  clientId: string;
  clientName: string;
  paidInvoiceCount: number;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    deleteClientAction,
    {},
  );

  const blocked = paidInvoiceCount > 0;

  return (
    <div className="space-y-2">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Delete ${clientName}? This also deletes their projects, tasks and unpaid invoices. This cannot be undone.`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={clientId} />
        <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
          Delete permanently
        </SubmitButton>
      </form>

      {blocked ? (
        <p className="text-xs text-ink-muted">
          This client has {paidInvoiceCount} paid{" "}
          {paidInvoiceCount === 1 ? "invoice" : "invoices"}, so deleting is
          blocked — those are part of your financial records. Archive them
          instead.
        </p>
      ) : null}

      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </div>
  );
}
