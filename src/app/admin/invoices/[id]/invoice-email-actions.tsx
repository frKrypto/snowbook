"use client";

import { useActionState } from "react";

import {
  markInvoiceSentAction,
  resendInvoiceEmailAction,
} from "@/app/admin/invoices/actions";
import { MailIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/action-state";

function Feedback({ state }: { state: ActionState }) {
  if (state.message) {
    return <p className="text-xs text-positive">{state.message}</p>;
  }
  if (state.error) return <p className="text-xs text-danger">{state.error}</p>;
  return null;
}

/** Draft → sent, which also emails the invoice to the client. */
export function MarkSentButton({ invoiceId }: { invoiceId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    markInvoiceSentAction,
    {},
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={invoiceId} />
        <SubmitButton className="w-full" pendingLabel="Sending…">
          Mark as sent &amp; email
        </SubmitButton>
      </form>
      <Feedback state={state} />
    </div>
  );
}

export function ResendInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    resendInvoiceEmailAction,
    {},
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={invoiceId} />
        <SubmitButton
          variant="secondary"
          className="w-full"
          pendingLabel="Emailing…"
        >
          <MailIcon className="h-4 w-4" />
          Email invoice again
        </SubmitButton>
      </form>
      <Feedback state={state} />
    </div>
  );
}
