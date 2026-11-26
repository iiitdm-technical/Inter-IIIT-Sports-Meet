import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { getStudentById } from "@/lib/admin/service";
import { generateStudentIdCardPdf } from "@/lib/admin/id-card";

export const runtime = "nodejs";

function safeFilenamePart(value) {
  return String(value || "student").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "student";
}

export async function GET(_request, context) {
  try {
    const admin = await requireAuth(["admin"]);
    await enforce(`idcard:${admin.userId}`, LIMITS.idCard);

    const { id } = await context.params;
    const studentId = Number(id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
    }

    const student = await getStudentById(studentId);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const pdfBytes = await generateStudentIdCardPdf({
      name: student.studentName,
      institute: student.iiitName,
    });

    const filename = `ID_${safeFilenamePart(student.iiitCode)}_${safeFilenamePart(student.rollNumber)}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ID card generation failed:", error);
    return errorResponse(error, "Failed to generate ID card PDF");
  }
}
