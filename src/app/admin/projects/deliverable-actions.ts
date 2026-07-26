"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { sendDeliveryNotification } from "@/lib/email/notifications";
import { DELIVERABLES_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import {
  ValidationError,
  optionalString,
  requiredString,
  requiredUuid,
  toFormError,
} from "@/lib/validation";

/**
 * Records a file that the browser has already uploaded straight to Storage.
 *
 * Uploads bypass the server because Vercel caps a server action body at about
 * 4.5MB, which no video clears. The row is written here so the upload and its
 * index entry stay consistent, and so RLS governs the write.
 */
export async function recordDeliverableAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  try {
    const projectId = requiredUuid(formData, "project_id", "Project");
    const storagePath = requiredString(formData, "storage_path", "File path", 400);
    const fileName = requiredString(formData, "file_name", "File name", 300);

    // The storage policies key off the leading path segment, so a row whose
    // path points outside its own project would be invisible or, worse,
    // readable by the wrong client.
    if (!storagePath.startsWith(`${projectId}/`)) {
      throw new ValidationError("That file was stored under the wrong project.");
    }

    const rawSize = String(formData.get("size_bytes") ?? "").trim();
    const sizeBytes = rawSize ? Number(rawSize) : null;

    const supabase = await createClient();
    const { error } = await supabase.from("deliverables").insert({
      project_id: projectId,
      title: optionalString(formData, "title", 200),
      file_name: fileName,
      storage_path: storagePath,
      content_type: optionalString(formData, "content_type", 200),
      size_bytes:
        sizeBytes !== null && Number.isFinite(sizeBytes) && sizeBytes >= 0
          ? Math.round(sizeBytes)
          : null,
    });

    if (error) return { error: error.message };

    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/portal/projects/${projectId}`);
    return { message: `${fileName} delivered.` };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

/**
 * Tells the client their files are ready.
 *
 * Deliberately a separate, explicit step rather than firing on every upload —
 * a multi-file delivery would otherwise mean one email per file.
 */
export async function notifyDeliveryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  try {
    const projectId = requiredUuid(formData, "project_id", "Project");
    const result = await sendDeliveryNotification(projectId);

    revalidatePath(`/admin/projects/${projectId}`);

    if (result.status === "sent") {
      return { message: "The client has been emailed." };
    }
    if (result.status === "skipped") {
      return { error: `Nothing sent: ${result.reason}.` };
    }
    return { error: result.error };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

export async function deleteDeliverableAction(formData: FormData) {
  await requireAdmin();

  const deliverableId = requiredUuid(formData, "id", "File");
  const supabase = await createClient();

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, project_id, storage_path")
    .eq("id", deliverableId)
    .maybeSingle();

  if (!deliverable) return;

  // Remove the object first; a leftover row pointing at nothing is worse than
  // an orphaned object, which can be swept up later.
  const { error: storageError } = await supabase.storage
    .from(DELIVERABLES_BUCKET)
    .remove([deliverable.storage_path]);

  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase
    .from("deliverables")
    .delete()
    .eq("id", deliverableId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/projects/${deliverable.project_id}`);
  revalidatePath(`/portal/projects/${deliverable.project_id}`);
}
