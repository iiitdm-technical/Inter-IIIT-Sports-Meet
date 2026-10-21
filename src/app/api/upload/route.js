import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { getDb } from "@/db/index";
import { paymentTransactions, registrations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteProof, listProofs, putProof } from "@/lib/storage/neon";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { MAX_PROOF_BYTES, MAX_PROOF_LABEL } from "@/lib/registration/labels";

export const runtime = "nodejs";

// Multipart overhead allowed on top of the file itself.
const FORM_OVERHEAD_BYTES = 64 * 1024;
const EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * Reads the request body, stopping as soon as it exceeds `limit` bytes.
 * Returns the bytes, or null when the body is too large.
 */
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

/**
 * Deletes earlier uploads for this IIIT so replaced proofs do not pile up.
 * Keeps the new file and any proof already attached to a payment record.
 */
async function removeReplacedProofs(iiitCode, registrationId, keepKey) {
  try {
    const [payment] = await getDb()
      .select({ proofPathname: paymentTransactions.proofPathname })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.registrationId, registrationId))
      .limit(1);
    const keep = new Set([keepKey, payment?.proofPathname].filter(Boolean));
    const keys = await listProofs(`payment-proofs/${iiitCode}/`);
    await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => deleteProof(key)));
  } catch (error) {
    console.error("Could not remove replaced payment proofs:", error.message);
  }
}

export async function POST(request) {
  try {
    const session = await requireAuth(["iiit"]);
    await enforce(`upload:${session.userId}`, LIMITS.upload, "Too many uploads. Please wait before trying again.");
    const [registration] = await getDb()
      .select({ id: registrations.id, status: registrations.status })
      .from(registrations)
      .where(eq(registrations.iiitCode, session.iiitCode))
      .limit(1);
    if (registration?.status !== "payment_pending") {
      return NextResponse.json({ error: "Submit your roster before uploading payment proof" }, { status: 403 });
    }

    const tooLarge = () => NextResponse.json({ error: `Proof must be ${MAX_PROOF_LABEL} or smaller` }, { status: 413 });
    const contentLength = Number(request.headers.get("content-length"));
    if (contentLength > MAX_PROOF_BYTES + FORM_OVERHEAD_BYTES) return tooLarge();
    // Read at most the allowed size even when Content-Length is missing or wrong.
    const body = await readLimited(request, MAX_PROOF_BYTES + FORM_OVERHEAD_BYTES);
    if (!body) return tooLarge();
    const form = await new Request(request.url, { method: "POST", headers: request.headers, body }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a proof file" }, { status: 400 });
    }
    const extension = EXTENSIONS[file.type];
    if (!extension || file.size === 0 || file.size > MAX_PROOF_BYTES) {
      return NextResponse.json({ error: `Upload a PDF, JPG or PNG of up to ${MAX_PROOF_LABEL}` }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validSignature = file.type === "application/pdf"
      ? bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
      : file.type === "image/jpeg"
        ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((part, index) => bytes[index] === part);
    if (!validSignature) {
      return NextResponse.json({ error: "File content does not match its PDF, JPG or PNG type" }, { status: 400 });
    }

    const key = `payment-proofs/${session.iiitCode}/${randomUUID()}.${extension}`;
    await putProof(key, bytes, file.type);
    await removeReplacedProofs(session.iiitCode, registration.id, key);
    return NextResponse.json({ pathname: key, fileName: file.name });
  } catch (error) {
    console.error("Payment proof upload failed:", error);
    return errorResponse(error, "Payment proof upload failed");
  }
}
