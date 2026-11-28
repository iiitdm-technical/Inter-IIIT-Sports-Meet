import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { getStudentsByIds } from "@/lib/admin/service";
import { cacheGeneratedSheet, generateIdCardSheetPdf, getCachedSheet } from "@/lib/admin/id-card";

export const runtime = "nodejs";

const postSchema = z.object({
  studentIds: z.array(z.number().int().positive()).min(1).max(3),
});

function safeFilenamePart(value) {
  return String(value || "student").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32) || "student";
}

/**
 * Generates a 3-up Portrait A4 ID card sheet on the server and caches it in
 * memory for 5 minutes. Returns tiny JSON metadata so the browser does not
 * download the PDF until the admin clicks Print or Download.
 */
export async function POST(request) {
  try {
    const admin = await requireAuth(["admin"]);
    await enforce(`idcard:${admin.userId}`, LIMITS.idCard);

    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Select between 1 and 3 students to generate an ID sheet" }, { status: 400 });
    }

    const uniqueIds = [...new Set(parsed.data.studentIds)];
    const students = await getStudentsByIds(uniqueIds);
    if (students.length === 0) {
      return NextResponse.json({ error: "No matching students found" }, { status: 404 });
    }

    const pdfBytes = await generateIdCardSheetPdf(
      students.map((s) => ({ name: s.studentName, institute: s.iiitName }))
    );

    const rolls = students.map((s) => safeFilenamePart(s.rollNumber)).join("_");
    const filename = `ID_Sheet_${rolls}.pdf`;
    const { key, expiresAt } = cacheGeneratedSheet({
      pdfBytes,
      filename,
      studentIds: students.map((s) => s.id),
    });

    return NextResponse.json({
      success: true,
      data: {
        key,
        filename,
        count: students.length,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("ID card sheet generation failed:", error);
    return errorResponse(error, "Failed to generate ID card sheet");
  }
}

/**
 * Streams the cached 3-up A4 ID card sheet PDF when Print or Download is clicked.
 */
export async function GET(request) {
  try {
    const admin = await requireAuth(["admin"]);
    await enforce(`idcard:${admin.userId}`, LIMITS.idCard);

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") || "";
    if (!key) {
      return NextResponse.json({ error: "Missing sheet key" }, { status: 400 });
    }

    const cached = getCachedSheet(key);
    if (!cached) {
      return NextResponse.json(
        { error: "Generated ID sheet expired (5 min cache). Click Generate Sheet again." },
        { status: 410 }
      );
    }

    return new NextResponse(Buffer.from(cached.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${cached.filename}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("ID card sheet fetch failed:", error);
    return errorResponse(error, "Failed to fetch ID card sheet");
  }
}
