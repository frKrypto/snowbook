"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, FormError } from "@/components/ui";
import type { Project } from "@/lib/database.types";
import { PROJECT_STATUSES } from "@/lib/statuses";

export interface ClientOption {
  id: string;
  name: string;
  company: string | null;
}

export function ProjectForm({
  action,
  project,
  clients,
  defaultClientId,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  project?: Project;
  clients: ClientOption[];
  defaultClientId?: string;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}

      <FormError message={state.error} />

      <Card className="p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Client" htmlFor="client_id">
            <select
              id="client_id"
              name="client_id"
              required
              defaultValue={project?.client_id ?? defaultClientId ?? ""}
              className="field"
            >
              <option value="" disabled>
                Select a client
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                  {client.company ? ` — ${client.company}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status" htmlFor="status">
            <select
              id="status"
              name="status"
              defaultValue={project?.status ?? "inquiry"}
              className="field"
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Title" htmlFor="title" className="sm:col-span-2">
            <input
              id="title"
              name="title"
              required
              maxLength={200}
              defaultValue={project?.title ?? ""}
              className="field"
              placeholder="Avery & Cole — Wedding Film"
            />
          </Field>

          <Field
            label="Shoot date"
            htmlFor="event_date"
            hint="The day of the shoot or event."
          >
            <input
              id="event_date"
              name="event_date"
              type="date"
              defaultValue={project?.event_date ?? ""}
              className="field"
            />
          </Field>

          <Field
            label="Delivery due"
            htmlFor="delivery_due_date"
            hint="When the final files are promised."
          >
            <input
              id="delivery_due_date"
              name="delivery_due_date"
              type="date"
              defaultValue={project?.delivery_due_date ?? ""}
              className="field"
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            className="sm:col-span-2"
            hint="Visible to the client in their portal."
          >
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={project?.description ?? ""}
              className="field resize-y"
              placeholder="Scope, deliverables, locations, run of show."
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
