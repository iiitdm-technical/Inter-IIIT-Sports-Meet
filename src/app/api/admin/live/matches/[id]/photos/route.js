import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp, httpError } from "@/lib/security/request";
import { getScope } from "@/lib/live/service";
import { MAX_PHOTO_BYTES, MAX_THUMB_BYTES, addMatchPhoto, listMatchPhotos } from "@/lib/live/photos";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };
// Multipart overhead allowed on top of the photo and its thumbnail.
const MAX_BODY_BYTES = MAX_PHOTO_BYTES + MAX_THUMB_BYTES + 64 * 1024;

function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw) throw httpError(404, "Match not found");
  return id;
}

/** Reads the body, stopping as soon as it passes `limit` bytes; null when too large. */
async function readLimited(request, limit) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fileBytes(form, name) {
  const file = form.get(name);
  return file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null;
}

/** The match's photos (coordinator of the sport, or Sports SAC). */
export async function GET(_request, { params }) {
  try {
    const session = await requireAuth(["admin", "coordinator"]);
    const id = parseId((await params).id);
    return NextResponse.json({ data: await listMatchPhotos(id, { scope: await getScope(session) }) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Unable to load the photos");
  }
}

/** Adds one photo (form fields "photo" and, optionally, "thumb"). */
export async function POST(request, { params }) {
  try {
    const session = await requireAuth(["admin", "coordinator"]);
    await enforce(`photo:${session.userId}`, LIMITS.photoUpload, "Too many photo uploads. Please wait a little and try again.");
    const id = parseId((await params).id);
    const tooLarge = () => NextResponse.json({ error: "The photo is too large; take it again or choose a smaller one" }, { status: 413 });
    if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return tooLarge();
    const body = await readLimited(request, MAX_BODY_BYTES);
    if (!body) return tooLarge();
    let form;
    try {
      form = await new Request(request.url, { method: "POST", headers: request.headers, body }).formData();
    } catch {
      throw httpError(400, "Choose a photo");
    }
    const result = await addMatchPhoto(id, { photo: await fileBytes(form, "photo"), thumb: await fileBytes(form, "thumb") }, {
      actor: session.username, scope: await getScope(session), isSuper: session.role === "admin",
    });
    await audit({ actor: session.username, role: session.role, action: "live_photo_added", target: String(id), ip: await getClientIp(), details: { photoId: result.photo.id } });
    return NextResponse.json({ data: result }, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (!(error?.statusCode >= 400 && error?.statusCode < 500)) console.error("Match photo upload failed:", error);
    return errorResponse(error, "The photo could not be saved. Try again.");
  }
}
