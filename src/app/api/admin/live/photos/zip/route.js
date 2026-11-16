import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp, httpError } from "@/lib/security/request";
import { folderZipEntries } from "@/lib/live/photos";
import { zipStream } from "@/lib/live/zip";

export const runtime = "nodejs";

/** Sports SAC: one IIIT's photo folder as a zip (?iiit=code). */
export async function GET(request) {
  try {
    const session = await requireAuth(["admin"]);
    await enforce(`download:${session.userId}`, LIMITS.download);
    const iiit = new URL(request.url).searchParams.get("iiit") || "";
    const entries = await folderZipEntries(iiit);
    if (!entries.length) throw httpError(404, "This IIIT has no photos yet");
    await audit({ actor: session.username, role: session.role, action: "live_photos_downloaded", target: iiit, ip: await getClientIp(), details: { photos: entries.length } });
    return new Response(zipStream(entries), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="match-photos-${iiit}.zip"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, "Unable to prepare the download");
  }
}
