import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { hashToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";

export const dynamic = "force-dynamic";

const GENERIC_RESPONSE = {
  ok: true,
  message: "If an account exists for that email, password reset instructions will be sent.",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    }

    const isDevelopment = process.env.NODE_ENV !== "production";
    if (!isDevelopment && (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !process.env.APP_URL)) {
      return NextResponse.json(
        { ok: false, error: "Password recovery is temporarily unavailable. Please contact support." },
        { status: 503 },
      );
    }

    const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) return NextResponse.json(GENERIC_RESPONSE);

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await db.insert(passwordResetTokens).values({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const appUrl = process.env.APP_URL || new URL(request.url).origin;
    const resetUrl = new URL("/reset-password", appUrl);
    resetUrl.searchParams.set("token", token);

    if (isDevelopment) {
      return NextResponse.json({ ...GENERIC_RESPONSE, developmentResetUrl: resetUrl.toString() });
    }

    try {
      await sendPasswordResetEmail(user.email, resetUrl.toString());
    } catch {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
      return NextResponse.json(
        { ok: false, error: "We couldn't send a reset email. Please try again later." },
        { status: 503 },
      );
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to request a password reset." }, { status: 500 });
  }
}