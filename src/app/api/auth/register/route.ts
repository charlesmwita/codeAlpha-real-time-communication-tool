import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, sessionCookieOptions, SESSION_COOKIE, toPublicUser } from "@/lib/auth";
import { hueFromString } from "@/lib/ids";
import { hashPassword } from "@/lib/passwords";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (name.length < 2) {
      return NextResponse.json({ ok: false, error: "Please use your full name." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) {
      return NextResponse.json({ ok: false, error: "An account with that email already exists." }, { status: 409 });
    }

    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash: await hashPassword(password),
        avatarHue: hueFromString(email),
      })
      .returning();

    const { token, expiresAt } = await createSession(user.id);
    const response = NextResponse.json({ ok: true, user: toPublicUser(user) });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to create account." }, { status: 500 });
  }
}
