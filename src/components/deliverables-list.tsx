import { DownloadIcon, FileIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import type { Deliverable } from "@/lib/database.types";
import { formatDate, formatFileSize } from "@/lib/format";

/** Read-only delivery list, as the client sees it in their portal. */
export function DeliverablesList({
  deliverables,
}: {
  deliverables: Deliverable[];
}) {
  if (deliverables.length === 0) {
    return (
      <EmptyState
        title="Nothing to download yet"
        description="Your finished files will appear here as soon as they're ready."
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {deliverables.map((file) => (
        <li key={file.id}>
          <a
            href={`/api/deliverables/${file.id}/download`}
            className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface-sunken/60"
          >
            <FileIcon className="h-5 w-5 shrink-0 text-ink-faint" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {file.title || file.file_name}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {formatFileSize(file.size_bytes)} · Delivered{" "}
                {formatDate(file.created_at)}
              </p>
            </div>
            <DownloadIcon className="h-4 w-4 shrink-0 text-accent" />
          </a>
        </li>
      ))}
    </ul>
  );
}
