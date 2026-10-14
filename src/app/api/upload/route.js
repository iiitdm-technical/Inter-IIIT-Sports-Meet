import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getDb } from "@/db/index";
import { registrations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { putProof } from "@/lib/storage/neon";

export const runtime = "nodejs";

const MAX_SIZE = 4 * 1024 * 1024;
const EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export async function POST(request) {
  try {
    const session = await requireAuth(["iiit"]);
    const [registration] = await getDb()
      .select({ status: registrations.status })
      .from(registrations)
      .where(eq(registrations.iiitCode, session.iiitCode))
      .limit(1);
    if (registration?.status !== "payment_pending") {
      return NextResponse.json({ error: "Submit your roster before uploading payment proof" }, { status: 403 });
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (contentLength > MAX_SIZE + 64 * 1024) {
      return NextResponse.json({ error: "Proof must be 4 MB or smaller" }, { status: 413 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a proof file" }, { status: 400 });
    }
    const extension = EXTENSIONS[file.type];
    if (!extension || file.size === 0 || file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Upload a PDF, JPG or PNG of up to 4 MB" }, { status: 400 });
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
    return NextResponse.json({ pathname: key, fileName: file.name });
  } catch (error) {
    console.error("Payment proof upload failed:", error);
    return NextResponse.json({ error: error.statusCode ? error.message : "Payment proof upload failed" }, { status: error.statusCode || 500 });
  }
}
