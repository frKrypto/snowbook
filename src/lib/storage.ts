/**
 * Storage constants.
 *
 * Kept out of the "use server" action files, which may only export async
 * functions — a plain const there fails the build.
 */

/** Private bucket holding files delivered to clients. */
export const DELIVERABLES_BUCKET = "deliverables";

/** How long a download link stays valid once minted. */
export const DOWNLOAD_URL_TTL_SECONDS = 60;
