import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { getDb } from "@/db/index";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/passwords";
import { createSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";

export async function POST(request) {
  try {
    const body = await request.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid login credentials format",
          details: parsed.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const identifier = username.trim().toLowerCase();
    const db = getDb();

    const userList = await db
      .select()
      .from(users)
      .where(or(eq(users.username, identifier), eq(users.email, identifier)))
      .limit(1);

    if (userList.length === 0) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const user = userList[0];
    const passwordMatch = await verifyPassword(password, user.passwordHash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Set secure HTTP-only session cookie
    const session = await createSessionCookie(user);

    return NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        username: session.username,
        email: session.email,
        displayName: session.displayName,
        role: session.role,
        iiitName: session.iiitName,
        iiitCode: session.iiitCode,
      },
    });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Internal server error during login" },
      { status: 500 }
    );
  }
}
