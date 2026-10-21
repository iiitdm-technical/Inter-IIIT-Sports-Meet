import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { getDb } from "@/db/index";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/passwords";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { LIMITS, hit, peek, reset } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

// Compared against when the account does not exist, so a missing account
// takes as long to reject as a wrong password.
const dummyHash = bcrypt.hash("not-a-real-password-" + Math.random(), 12);

function tooMany(retryAfter) {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return NextResponse.json(
    { error: `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success || parsed.data.username.length > 254 || parsed.data.password.length > 256) {
      return NextResponse.json({ error: "Enter your IIIT code or email and your password." }, { status: 400 });
    }

    const identifier = parsed.data.username.trim().toLowerCase();
    const { password } = parsed.data;
    const ip = await getClientIp();
    const userAgent = await getUserAgent();
    const accountKey = `login:account:${identifier}`;

    const ipCheck = await hit(`login:ip:${ip}`, LIMITS.loginPerIp);
    if (!ipCheck.ok) {
      await audit({ actor: identifier, action: "login_rate_limited", ip, details: { scope: "ip" } });
      return tooMany(ipCheck.retryAfter);
    }
    const accountCheck = await peek(accountKey, LIMITS.loginPerAccount);
    if (!accountCheck.ok) {
      await audit({ actor: identifier, action: "login_rate_limited", ip, details: { scope: "account" } });
      return tooMany(accountCheck.retryAfter);
    }

    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.username, identifier), eq(users.email, identifier)))
      .limit(1);

    const passwordMatch = user
      ? await verifyPassword(password, user.passwordHash)
      : (await bcrypt.compare(password, await dummyHash), false);

    if (!passwordMatch) {
      await hit(accountKey, LIMITS.loginPerAccount);
      await audit({ actor: identifier, action: "login_failed", ip, details: { knownAccount: Boolean(user) } });
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    await reset(accountKey);
    const session = await createSession(user, { ip, userAgent });
    await audit({ actor: user.username, role: user.role, action: "login", ip });

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
    return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}
