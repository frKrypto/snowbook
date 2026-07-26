"use client";

import Link from "next/link";
import { useActionState, useId, useMemo, useRef, useState } from "react";

import type { ActionState } from "@/lib/action-state";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardHeader, Field, FormError, Button } from "@/components/ui";
import type { Invoice, InvoiceLineItem } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";

export interface InvoiceClientOption {
  id: string;
  name: string;
}

export interface InvoiceProjectOption {
  id: string;
  title: string;
  client_id: string;
}

interface Row {
  key: string;
  description: string;
  quantity: string;
  rate: string;
}

const emptyRow = (key: string): Row => ({
  key,
  description: "",
  quantity: "1",
  rate: "",
});

const toNumber = (value: string) => {
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function InvoiceForm({
  action,
  invoice,
  lineItems,
  clients,
  projects,
  defaultClientId,
  defaultProjectId,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  invoice?: Invoice;
  lineItems?: InvoiceLineItem[];
  clients: InvoiceClientOption[];
  projects: InvoiceProjectOption[];
  defaultClientId?: string;
  defaultProjectId?: string;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const formId = useId();

  const [clientId, setClientId] = useState(
    invoice?.client_id ?? defaultClientId ?? "",
  );
  const [projectId, setProjectId] = useState(
    invoice?.project_id ?? defaultProjectId ?? "",
  );
  const [taxRate, setTaxRate] = useState(String(invoice?.tax_rate ?? "0"));

  /*
   * Row keys come from a counter rather than crypto.randomUUID(), for two
   * reasons: randomUUID is undefined outside a secure context (any dev server
   * reached over a LAN IP rather than localhost), which made "Add line" throw
   * and silently do nothing; and a random value differs between the server
   * render and hydration, which desynced the input ids.
   */
  const FIRST_ROW_KEY = "line-0";
  const keySeq = useRef(1); // line-0 belongs to the initial blank row.
  const nextKey = () => `line-${keySeq.current++}`;

  const [rows, setRows] = useState<Row[]>(() =>
    lineItems && lineItems.length > 0
      ? lineItems.map((item) => ({
          key: item.id,
          description: item.description,
          quantity: String(item.quantity),
          rate: String(item.rate),
        }))
      : [emptyRow(FIRST_ROW_KEY)],
  );

  const clientProjects = useMemo(
    () => projects.filter((project) => project.client_id === clientId),
    [projects, clientId],
  );

  const totals = useMemo(() => {
    const subtotal = rows.reduce(
      (sum, row) =>
        sum + Math.round(toNumber(row.quantity) * toNumber(row.rate) * 100) / 100,
      0,
    );
    const tax = Math.round(((subtotal * toNumber(taxRate)) / 100) * 100) / 100;
    return { subtotal, tax, total: subtotal + tax };
  }, [rows, taxRate]);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {invoice ? <input type="hidden" name="id" value={invoice.id} /> : null}

      <FormError message={state.error} />

      <Card className="p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Client" htmlFor={`${formId}-client`}>
            <select
              id={`${formId}-client`}
              name="client_id"
              required
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setProjectId("");
              }}
              className="field"
            >
              <option value="" disabled>
                Select a client
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Project"
            htmlFor={`${formId}-project`}
            hint="Optional — link deposits and finals to the same project."
          >
            <select
              id={`${formId}-project`}
              name="project_id"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              disabled={!clientId}
              className="field disabled:opacity-60"
            >
              <option value="">No project</option>
              {clientProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Reference"
            htmlFor={`${formId}-title`}
            className="sm:col-span-2"
            hint="Shown next to the invoice number, e.g. “50% deposit”."
          >
            <input
              id={`${formId}-title`}
              name="title"
              maxLength={200}
              defaultValue={invoice?.title ?? ""}
              className="field"
              placeholder="50% booking deposit"
            />
          </Field>

          <Field label="Issue date" htmlFor={`${formId}-issue`}>
            <input
              id={`${formId}-issue`}
              name="issue_date"
              type="date"
              defaultValue={invoice?.issue_date ?? ""}
              className="field"
            />
          </Field>

          <Field label="Due date" htmlFor={`${formId}-due`}>
            <input
              id={`${formId}-due`}
              name="due_date"
              type="date"
              defaultValue={invoice?.due_date ?? ""}
              className="field"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Line items"
          description="Quantity × rate. Totals are recalculated on the server when you save."
        />

        <div className="px-5 py-4">
          {/* Column headings, desktop only — each row is self-labelling on mobile. */}
          <div className="mb-2 hidden gap-3 px-1 text-xs font-medium tracking-wide text-ink-faint uppercase sm:grid sm:grid-cols-[1fr_5rem_7rem_6rem_2rem]">
            <span>Description</span>
            <span>Qty</span>
            <span>Rate</span>
            <span className="text-right">Amount</span>
            <span className="sr-only">Remove</span>
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => {
              const amount =
                Math.round(toNumber(row.quantity) * toNumber(row.rate) * 100) / 100;

              return (
                <div
                  key={row.key}
                  className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_5rem_7rem_6rem_2rem] sm:items-center sm:border-0 sm:p-0"
                >
                  <div>
                    <label className="label sm:hidden" htmlFor={`${row.key}-desc`}>
                      Description
                    </label>
                    <input
                      id={`${row.key}-desc`}
                      name="line_description"
                      value={row.description}
                      onChange={(event) =>
                        updateRow(row.key, { description: event.target.value })
                      }
                      maxLength={500}
                      placeholder="Full-day wedding coverage"
                      className="field"
                      aria-label={`Line ${index + 1} description`}
                    />
                  </div>

                  <div>
                    <label className="label sm:hidden" htmlFor={`${row.key}-qty`}>
                      Quantity
                    </label>
                    <input
                      id={`${row.key}-qty`}
                      name="line_quantity"
                      value={row.quantity}
                      onChange={(event) =>
                        updateRow(row.key, { quantity: event.target.value })
                      }
                      inputMode="decimal"
                      className="field tabular"
                      aria-label={`Line ${index + 1} quantity`}
                    />
                  </div>

                  <div>
                    <label className="label sm:hidden" htmlFor={`${row.key}-rate`}>
                      Rate
                    </label>
                    <input
                      id={`${row.key}-rate`}
                      name="line_rate"
                      value={row.rate}
                      onChange={(event) =>
                        updateRow(row.key, { rate: event.target.value })
                      }
                      inputMode="decimal"
                      placeholder="0.00"
                      className="field tabular"
                      aria-label={`Line ${index + 1} rate`}
                    />
                  </div>

                  <div className="tabular flex items-center justify-between text-sm font-medium text-ink sm:justify-end">
                    <span className="text-xs text-ink-muted sm:hidden">Amount</span>
                    {formatMoney(amount)}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setRows((current) =>
                          current.length === 1
                            ? [emptyRow(nextKey())]
                            : current.filter((entry) => entry.key !== row.key),
                        )
                      }
                      aria-label={`Remove line ${index + 1}`}
                      className="rounded-md p-1.5 text-ink-faint transition hover:bg-danger-soft hover:text-danger"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => setRows((current) => [...current, emptyRow(nextKey())])}
          >
            <PlusIcon className="h-4 w-4" />
            Add line
          </Button>
        </div>

        <div className="border-t border-line bg-surface-sunken/40 px-5 py-4">
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Subtotal</span>
              <span className="tabular font-medium text-ink">
                {formatMoney(totals.subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`${formId}-tax`} className="text-ink-muted">
                Tax rate %
              </label>
              <input
                id={`${formId}-tax`}
                name="tax_rate"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
                inputMode="decimal"
                className="field tabular w-24 text-right"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Tax</span>
              <span className="tabular font-medium text-ink">
                {formatMoney(totals.tax)}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-2">
              <span className="font-medium text-ink">Total</span>
              <span className="tabular font-display text-lg font-semibold text-ink">
                {formatMoney(totals.total)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <Field
          label="Notes"
          htmlFor={`${formId}-notes`}
          hint="Shown on the invoice in the client's portal."
        >
          <textarea
            id={`${formId}-notes`}
            name="notes"
            rows={3}
            defaultValue={invoice?.notes ?? ""}
            className="field resize-y"
            placeholder="Payment terms, what happens next, thank you note."
          />
        </Field>
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
