"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  addTaskAction,
  deleteTaskAction,
  toggleTaskAction,
} from "@/app/admin/projects/actions";
import type { ActionState } from "@/lib/action-state";
import { ConfirmForm } from "@/components/confirm-form";
import { TrashIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { EmptyState, cn } from "@/components/ui";
import type { Task } from "@/lib/database.types";
import { formatDate, relativeDays, todayISO } from "@/lib/format";

export function TaskChecklist({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: Task[];
}) {
  return (
    <div>
      {tasks.length > 0 ? (
        <ul className="divide-y divide-line">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No tasks yet"
          description="Break the project into the steps you actually work through — scout, shoot, first cut, delivery."
        />
      )}

      <AddTaskForm projectId={projectId} />
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const formRef = useRef<HTMLFormElement>(null);
  const overdue =
    !task.is_done && task.due_date != null && task.due_date < todayISO();

  return (
    <li className="group flex items-center gap-3 px-5 py-3">
      <form ref={formRef} action={toggleTaskAction} className="flex min-w-0 flex-1 items-center gap-3">
        <input type="hidden" name="id" value={task.id} />
        <input
          type="checkbox"
          name="is_done"
          defaultChecked={task.is_done}
          aria-label={`Mark "${task.name}" ${task.is_done ? "not done" : "done"}`}
          onChange={() => formRef.current?.requestSubmit()}
          className="h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-brand"
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm",
              task.is_done ? "text-ink-faint line-through" : "text-ink",
            )}
          >
            {task.name}
          </span>
          {task.due_date ? (
            <span
              className={cn(
                "block text-xs",
                overdue ? "text-danger" : "text-ink-muted",
              )}
            >
              Due {formatDate(task.due_date)}
              {!task.is_done ? ` · ${relativeDays(task.due_date)}` : ""}
            </span>
          ) : null}
        </span>
      </form>

      <ConfirmForm
        action={deleteTaskAction}
        message={`Delete task "${task.name}"?`}
        className="shrink-0"
      >
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          aria-label={`Delete task ${task.name}`}
          className="rounded-md p-1.5 text-ink-faint opacity-0 transition group-hover:opacity-100 hover:bg-danger-soft hover:text-danger focus:opacity-100 focus:outline-none"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </ConfirmForm>
    </li>
  );
}

function AddTaskForm({ projectId }: { projectId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(
    addTaskAction,
    {},
  );

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-sunken/40 px-5 py-3"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input
        name="name"
        required
        maxLength={200}
        placeholder="Add a task"
        aria-label="Task name"
        className="field min-w-40 flex-1"
      />
      <input
        name="due_date"
        type="date"
        aria-label="Task due date"
        className="field w-auto"
      />
      <SubmitButton variant="secondary" pendingLabel="Adding…">
        Add
      </SubmitButton>
      {state.error ? (
        <p className="w-full text-xs text-danger">{state.error}</p>
      ) : null}
    </form>
  );
}
