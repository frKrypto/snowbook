import { NextResponse, type NextRequest } from "next/server";

import { getSessionContext } from "@/lib/auth";
import {
  DELIVERABLES_BUCKET,
  DOWNLOAD_URL_TTL_SECONDS,
} from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Hands back a short-lived signed URL for one deliverable.
 *
 * Every step runs through the caller's own session rather than the service
 * role: RLS decides whether the row is visible, and the storage policies
 * decide whether the object is. A client asking for another client's file gets
 * a 404 at the first step and never reaches Storage.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getSessionContext();
  if (!context) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, file_name, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!deliverable) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(DELIVERABLES_BUCKET)
    .createSignedUrl(deliverable.storage_path, DOWNLOAD_URL_TTL_SECONDS, {
      download: deliverable.file_name,
    });

  if (error || !data?.signedUrl) {
    console.error("Could not sign deliverable URL", error);
    return NextResponse.json(
      { error: "That file couldn't be prepared for download." },
      { status: 502 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
