"use client";

import { useActionState } from "react";

import { inviteClientAction } from "@/app/admin/clients/actions";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/submit-button";
import { MailIcon } from "@/components/icons";

export function InviteButton({ clientId }: { clientId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    inviteClientAction,
    {},
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="id" value={clientId} />
        <SubmitButton
          variant="secondary"
          size="sm"
          pendingLabel="Sending invite…"
        >
          <MailIcon className="h-4 w-4" />
          Send portal invite
        </SubmitButton>
      </form>

      {state.message ? (
        <p className="text-xs text-positive">{state.message}</p>
      ) : null}
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </div>
  );
}
