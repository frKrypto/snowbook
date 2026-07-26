"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import type { ProjectStatus } from "@/lib/database.types";
import { PROJECT_STATUSES } from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import {
  enumValue,
  optionalDate,
  optionalString,
  requiredString,
  requiredUuid,
  toFormError,
} from "@/lib/validation";

const STATUS_VALUES = PROJECT_STATUSES.map((s) => s.value) as ProjectStatus[];

function readProjectFields(formData: FormData) {
  return {
    client_id: requiredUuid(formData, "client_id", "Client"),
    title: requiredString(formData, "title", "Title", 200),
    description: optionalString(formData, "description", 5000),
    status: enumValue<ProjectStatus>(
      formData,
      "status",
      STATUS_VALUES,
      "inquiry",
    ),
    event_date: optionalDate(formData, "event_date"),
    delivery_due_date: optionalDate(formData, "delivery_due_date"),
  };
}

export async function createProjectAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  let projectId: string;
  try {
    const fields = readProjectFields(formData);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert(fields)
      .select("id")
      .single();

    if (error || !data) {
      return { error: error?.message ?? "Could not save project." };
    }
    projectId = data.id;
  } catch (error) {
    return { error: toFormError(error) };
  }

  revalidatePath("/admin/projects");
  redirect(`/admin/projects/${projectId}`);
}

export async function updateProjectAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  let projectId: string;
  try {
    projectId = requiredUuid(formData, "id", "Project");
    const fields = readProjectFields(formData);
    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update(fields)
      .eq("id", projectId);

    if (error) return { error: error.message };
  } catch (error) {
    return { error: toFormError(error) };
  }

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  redirect(`/admin/projects/${projectId}`);
}

export async function deleteProjectAction(formData: FormData) {
  await requireAdmin();

  const projectId = requiredUuid(formData, "id", "Project");
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/projects");
  redirect(project ? `/admin/clients/${project.client_id}` : "/admin/projects");
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                       */
/* -------------------------------------------------------------------------- */

export async function addTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  try {
    const projectId = requiredUuid(formData, "project_id", "Project");
    const name = requiredString(formData, "name", "Task", 200);
    const dueDate = optionalDate(formData, "due_date");

    const supabase = await createClient();

    // Append to the end of the current list.
    const { data: last } = await supabase
      .from("tasks")
      .select("position")
      .eq("project_id", projectId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("tasks").insert({
      project_id: projectId,
      name,
      due_date: dueDate,
      position: (last?.position ?? 0) + 1,
    });

    if (error) return { error: error.message };

    revalidatePath(`/admin/projects/${projectId}`);
    return { message: "Task added." };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

export async function toggleTaskAction(formData: FormData) {
  await requireAdmin();

  const taskId = requiredUuid(formData, "id", "Task");
  const isDone = formData.get("is_done") === "on";

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .update({ is_done: isDone })
    .eq("id", taskId)
    .select("project_id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (task) {
    revalidatePath(`/admin/projects/${task.project_id}`);
    revalidatePath(`/portal/projects/${task.project_id}`);
  }
}

export async function deleteTaskAction(formData: FormData) {
  await requireAdmin();

  const taskId = requiredUuid(formData, "id", "Task");
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .maybeSingle();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);

  if (task) revalidatePath(`/admin/projects/${task.project_id}`);
}
