import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/request";
import { checkInStudent } from "@/lib/admin/service";

export const runtime = "nodejs";

const bodySchema = z.object({
  override: z.boolean().optional().default(false),
});

export async function POST(request, context) {
  try {
    const admin = await requireAuth(["admin"]);
    await enforce(`checkin:${admin.userId}`, LIMITS.checkIn);

    const { id } = await context.params;
    const studentId = Number(id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid check-in request" }, { status: 400 });
    }

    const { override } = parsed.data;
    const result = await checkInStudent(studentId, admin.username, { override });

    await audit({
      actor: admin.username,
      role: admin.role,
      action: result.wasAlreadyCheckedIn ? "student_checkin_override" : "student_checkin",
      target: `${result.iiitCode}:${result.rollNumber}`,
      ip: await getClientIp(),
      details: {
        studentId: result.id,
        override,
        previousCheckedInAt: result.previousCheckedInAt,
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Student check-in failed:", error);
    return errorResponse(error, "Could not check in student");
  }
}
