import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp, httpError } from "@/lib/security/request";
import { getScope } from "@/lib/live/service";
import { deleteMatchPhoto, readMatchPhoto } from "@/lib/live/photos";

export const runtime = "nodejs";

function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw) throw httpError(404, "Photo not found");
  return id;
}

/** The photo, or its thumbnail with ?size=thumb. Private: never cached by shared caches. */
export async function GET(request, { params }) {
  try {
    const session = await requireAuth(["admin", "coordinator"]);
    const id = parseId((await params).photoId);
    const thumb = new URL(request.url).searchParams.get("size") === "thumb";
    const download = new URL(request.url).searchParams.get("download") === "1";
    const file = await readMatchPhoto(id, { scope: await getScope(session), thumb });
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": file.contentType,
        ...(file.size ? { "Content-Length": String(file.size) } : {}),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="photo-${id}.${file.contentType === "image/png" ? "png" : "jpg"}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, "Unable to load the photo");
  }
}

/** Removes a photo (coordinator while the match is live; Sports SAC any time). */
export async function DELETE(_request, { params }) {
  try {
    const session = await requireAuth(["admin", "coordinator"]);
    await enforce(`live:${session.userId}`, LIMITS.liveWrite);
    const id = parseId((await params).photoId);
    const result = await deleteMatchPhoto(id, { scope: await getScope(session), isSuper: session.role === "admin" });
    await audit({ actor: session.username, role: session.role, action: "live_photo_removed", target: String(result.matchId), ip: await getClientIp(), details: { photoId: id } });
    return NextResponse.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to remove the photo");
  }
}
