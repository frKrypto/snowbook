"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  deleteDeliverableAction,
  recordDeliverableAction,
} from "@/app/admin/projects/deliverable-actions";
import { DELIVERABLES_BUCKET } from "@/lib/storage";
import { ConfirmForm } from "@/components/confirm-form";
import { DownloadIcon, FileIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { Button, EmptyState, FormError, cn } from "@/components/ui";
import type { Deliverable } from "@/lib/database.types";
import { formatDate, formatFileSize } from "@/lib/format";
import { sanitizeFileName, shortId } from "@/lib/id";
import { createClient } from "@/lib/supabase/client";

interface PendingUpload {
  name: string;
  status: "uploading" | "failed";
  error?: string;
}

export function DeliverablesPanel({
  projectId,
  deliverables,
}: {
  projectId: string;
  deliverables: Deliverable[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;

    setError(null);
    setPending(files.map((file) => ({ name: file.name, status: "uploading" })));

    const supabase = createClient();

    for (const file of files) {
      // The leading path segment must be the project id — the storage policies
      // read it to decide who is allowed to see this object.
      const path = `${projectId}/${shortId()}-${sanitizeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(DELIVERABLES_BUCKET)
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        setPending((current) =>
          current.map((entry) =>
            entry.name === file.name
              ? { ...entry, status: "failed", error: uploadError.message }
              : entry,
          ),
        );
        continue;
      }

      const form = new FormData();
      form.set("project_id", projectId);
      form.set("storage_path", path);
      form.set("file_name", file.name);
      form.set("content_type", file.type);
      form.set("size_bytes", String(file.size));

      const result = await recordDeliverableAction({}, form);

      if (result.error) {
        // Don't leave an object behind that nothing points at.
        await supabase.storage.from(DELIVERABLES_BUCKET).remove([path]);
        setPending((current) =>
          current.map((entry) =>
            entry.name === file.name
              ? { ...entry, status: "failed", error: result.error }
              : entry,
          ),
        );
        continue;
      }

      setPending((current) =>
        current.filter((entry) => entry.name !== file.name),
      );
      router.refresh();
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      {deliverables.length > 0 ? (
        <ul className="divide-y divide-line">
          {deliverables.map((file) => (
            <li
              key={file.id}
              className="group flex items-center gap-3 px-5 py-3"
            >
              <FileIcon className="h-5 w-5 shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {file.title || file.file_name}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {formatFileSize(file.size_bytes)} · {formatDate(file.created_at)}
                </p>
              </div>

              <a
                href={`/api/deliverables/${file.id}/download`}
                className="rounded-md p-1.5 text-ink-faint transition hover:bg-surface-sunken hover:text-ink"
                aria-label={`Download ${file.file_name}`}
              >
                <DownloadIcon className="h-4 w-4" />
              </a>

              <ConfirmForm
                action={deleteDeliverableAction}
                message={`Delete ${file.file_name}? The client will no longer be able to download it.`}
                className="shrink-0"
              >
                <input type="hidden" name="id" value={file.id} />
                <button
                  type="submit"
                  aria-label={`Delete ${file.file_name}`}
                  className="rounded-md p-1.5 text-ink-faint opacity-0 transition group-hover:opacity-100 hover:bg-danger-soft hover:text-danger focus:opacity-100"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </ConfirmForm>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing delivered yet"
          description="Upload the finished films, stills or anything else the client should be able to download."
        />
      )}

      <div className="border-t border-line px-5 py-4">
        <FormError message={error} />

        {pending.length > 0 ? (
          <ul className="mb-3 space-y-1.5">
            {pending.map((entry) => (
              <li key={entry.name} className="text-xs">
                <span
                  className={cn(
                    entry.status === "failed" ? "text-danger" : "text-ink-muted",
                  )}
                >
                  {entry.status === "failed"
                    ? `${entry.name} — ${entry.error ?? "upload failed"}`
                    : `Uploading ${entry.name}…`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void uploadFiles(Array.from(event.dataTransfer.files));
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition",
            dragging ? "border-accent bg-accent-soft/40" : "border-line-strong",
          )}
        >
          <UploadIcon className="h-5 w-5 text-ink-faint" />
          <p className="text-sm text-ink-muted">
            Drop files here, or
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            id={`upload-${projectId}`}
            onChange={(event) =>
              void uploadFiles(Array.from(event.target.files ?? []))
            }
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            Choose files
          </Button>
          <p className="text-xs text-ink-faint">
            Uploaded straight to storage — large video files are fine.
          </p>
        </div>
      </div>
    </div>
  );
}
