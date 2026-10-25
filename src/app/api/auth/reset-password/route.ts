import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { hashToken } from "@/lib/auth";
import { hashPassword } from "@/lib/passwords";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; password?: string };
    const token = body.token ?? "";
    const password = body.password ?? "";

    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ ok: false, error: "This reset link is invalid or has expired." }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const userId = await db.transaction(async (tx) => {
      const [reset] = await tx
        .delete(passwordResetTokens)
        .where(and(eq(passwordResetTokens.tokenHash, hashToken(token)), gt(passwordResetTokens.expiresAt, new Date())))
        .returning({ userId: passwordResetTokens.userId });
      if (!reset) return null;

      await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, reset.userId));
      await tx.delete(sessions).where(eq(sessions.userId, reset.userId));
      return reset.userId;
    });

    if (!userId) {
      return NextResponse.json({ ok: false, error: "This reset link is invalid or has expired." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to reset your password." }, { status: 500 });
  }
}