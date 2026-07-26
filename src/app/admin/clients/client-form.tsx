"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, FormError } from "@/components/ui";
import type { Client } from "@/lib/database.types";
import { CLIENT_STATUSES } from "@/lib/statuses";

export function ClientForm({
  action,
  client,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  client?: Client;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}

      <FormError message={state.error} />

      <Card className="p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" className="sm:col-span-2">
            <input
              id="name"
              name="name"
              required
              maxLength={200}
              defaultValue={client?.name ?? ""}
              className="field"
              placeholder="Jordan Avery"
            />
          </Field>

          <Field label="Email" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={client?.email ?? ""}
              className="field"
              placeholder="jordan@example.com"
            />
          </Field>

          <Field label="Phone" htmlFor="phone">
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={client?.phone ?? ""}
              className="field"
              placeholder="(555) 010-4477"
            />
          </Field>

          <Field label="Company" htmlFor="company">
            <input
              id="company"
              name="company"
              defaultValue={client?.company ?? ""}
              className="field"
              placeholder="Optional"
            />
          </Field>

          <Field label="Status" htmlFor="status">
            <select
              id="status"
              name="status"
              defaultValue={client?.status ?? "lead"}
              className="field"
            >
              {CLIENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Notes"
            htmlFor="notes"
            className="sm:col-span-2"
            hint="Internal only — never shown in the client portal."
          >
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={client?.notes ?? ""}
              className="field resize-y"
              placeholder="Where they came from, preferences, anything worth remembering."
            />
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        <Link
          href={cancelHref}
          className="text-sm font-medium text-ink-muted transition hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
