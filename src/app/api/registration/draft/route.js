import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { assertRegistrationOpen } from "@/lib/registration/deadline";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { getDb } from "@/db/index";
import { registrationDrafts, registrations } from "@/db/schema";

export const runtime = "nodejs";

const MAX_DRAFT_BYTES = 1024 * 1024;
const draftSchema = z.object({
  revision: z.number().int().min(0),
  contactDetails: z.object({
    contactName: z.string().max(128),
    contactEmail: z.string().max(128),
    contactPhone: z.string().max(32),
    notes: z.string().max(1000),
  }),
  slotsMap: z.record(
    z.string().min(1).max(200),
    z.object({
      rollNumber: z.string().max(64),
      name: z.string().max(128),
      gender: z.enum(["M", "F"]),
    })
  ),
});

function publicDraft(row) {
  if (!row) return null;
  return {
    contactDetails: row.contactDetails,
    slotsMap: row.slotsMap,
    revision: row.revision,
    updatedAt: row.updatedAt,
  };
}

export async function GET() {
  try {
    const session = await requireAuth(["iiit"]);
    const [draft] = await getDb().select().from(registrationDrafts)
      .where(eq(registrationDrafts.iiitCode, session.iiitCode)).limit(1);
    return NextResponse.json({ data: publicDraft(draft) });
  } catch (error) {
    console.error("Get registration draft failed:", error);
    return errorResponse(error, "Could not load draft");
  }
}

export async function PUT(request) {
  try {
    const session = await requireAuth(["iiit"]);
    assertRegistrationOpen();
    await enforce(`draft:${session.userId}`, LIMITS.draftSave, "Saving too often. Your draft is kept in this browser; it will sync shortly.");
    const contentLength = Number(request.headers.get("content-length"));
    if (contentLength > MAX_DRAFT_BYTES) {
      return NextResponse.json({ error: "Draft is too large" }, { status: 413 });
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_DRAFT_BYTES) {
      return NextResponse.json({ error: "Draft is too large" }, { status: 413 });
    }
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid draft data" }, { status: 400 });
    }
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success || Object.keys(parsed.data.slotsMap).length > 1200) {
      return NextResponse.json({ error: "Invalid draft data" }, { status: 400 });
    }

    const db = getDb();
    const [registration] = await db.select({ id: registrations.id }).from(registrations)
      .where(eq(registrations.iiitCode, session.iiitCode)).limit(1);
    if (registration) {
      return NextResponse.json({ error: "Registration is already locked" }, { status: 409 });
    }

    const { revision, contactDetails, slotsMap } = parsed.data;
    let saved;
    if (revision === 0) {
      const [row] = await db.insert(registrationDrafts)
        .values({ iiitCode: session.iiitCode, contactDetails, slotsMap })
        .onConflictDoNothing()
        .returning();
      saved = row;
    } else {
      const [row] = await db.update(registrationDrafts)
        .set({ contactDetails, slotsMap, revision: revision + 1, updatedAt: new Date() })
        .where(and(eq(registrationDrafts.iiitCode, session.iiitCode), eq(registrationDrafts.revision, revision)))
        .returning();
      saved = row;
    }
    if (!saved) {
      const [latest] = await db.select().from(registrationDrafts)
        .where(eq(registrationDrafts.iiitCode, session.iiitCode)).limit(1);
      return NextResponse.json({ error: "A newer draft exists in another session", data: publicDraft(latest) }, { status: 409 });
    }
    return NextResponse.json({ data: publicDraft(saved) });
  } catch (error) {
    console.error("Save registration draft failed:", error);
    return errorResponse(error, "Could not save draft");
  }
}
