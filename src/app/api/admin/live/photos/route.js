import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { folderContents, photoFolders } from "@/lib/live/photos";

export const runtime = "nodejs";

/** Sports SAC: the photo folder of every IIIT, or one folder's contents with ?iiit=code. */
export async function GET(request) {
  try {
    await requireAuth(["admin"]);
    const iiit = new URL(request.url).searchParams.get("iiit");
    const data = iiit ? await folderContents(iiit) : await photoFolders();
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to load the photos");
  }
}
