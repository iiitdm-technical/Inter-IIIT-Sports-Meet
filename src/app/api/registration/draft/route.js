import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { assertRegistrationOpen, isUniqueViolation } from "@/lib/registration/deadline";
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
    // Travel fields arrived later; drafts saved before then lack them.
    arrivalDate: z.string().max(10).optional(),
    arrivalTime: z.string().max(5).optional(),
    travelMode: z.string().max(32).optional(),
    arrivalPoint: z.string().max(128).optional(),
    departureDate: z.string().max(10).optional(),
    boysSecretaryName: z.string().max(128).optional(),
    boysSecretaryPhone: z.string().max(32).optional(),
    boysSecretaryEmail: z.string().max(128).optional(),
    girlsSecretaryName: z.string().max(128).optional(),
    girlsSecretaryPhone: z.string().max(32).optional(),
    girlsSecretaryEmail: z.string().max(128).optional(),
    staffCount: z.union([z.string().max(3), z.number().int().min(0).max(99)]).optional(),
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

function affectedRows(result) {
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
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
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid draft data" }, { status: 400 });
    }
    if (Object.keys(parsed.data.slotsMap).length > 1200) {
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
      const updatedAt = new Date();
      try {
        await db.insert(registrationDrafts)
          .values({ iiitCode: session.iiitCode, contactDetails, slotsMap, revision: 1, updatedAt });
        // Return the values written by this request rather than doing a
        // follow-up read that could observe a later concurrent revision.
        saved = { iiitCode: session.iiitCode, contactDetails, slotsMap, revision: 1, updatedAt };
      } catch (error) {
        // A duplicate on the first save means another session created the
        // draft. Do not suppress validation or connection errors as if they
        // were a harmless conflict.
        if (!isUniqueViolation(error)) throw error;
        const [latest] = await db.select().from(registrationDrafts)
          .where(eq(registrationDrafts.iiitCode, session.iiitCode)).limit(1);
        return NextResponse.json({ error: "A newer draft exists in another session", data: publicDraft(latest) }, { status: 409 });
      }
    } else {
      const updatedAt = new Date();
      const result = await db.update(registrationDrafts)
        .set({ contactDetails, slotsMap, revision: revision + 1, updatedAt })
        .where(and(eq(registrationDrafts.iiitCode, session.iiitCode), eq(registrationDrafts.revision, revision)));
      if (affectedRows(result) > 0) {
        // Construct the successful response from this write. A later save
        // must not cause this request to return another request's revision.
        saved = { iiitCode: session.iiitCode, contactDetails, slotsMap, revision: revision + 1, updatedAt };
      }
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
