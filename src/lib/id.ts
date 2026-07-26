/**
 * Short unique-enough id for storage paths.
 *
 * Deliberately not crypto.randomUUID(): that is undefined outside a secure
 * context, which breaks the moment the app is opened over a LAN IP. Collisions
 * are caught anyway by the unique constraint on deliverables.storage_path.
 */
export function shortId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Strips a filename down to something safe to put in a storage key. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return (cleaned || "file").slice(0, 100);
}
