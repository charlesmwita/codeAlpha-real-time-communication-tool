import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { findRoomByCode, getParticipantForUser } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { code, id } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ ok: false, error: "Room not found." }, { status: 404 });
  }

  const mine = await getParticipantForUser(room.id, user.id);
  if (!mine) {
    return NextResponse.json({ ok: false, error: "Join the room first." }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.roomId, room.id)))
    .limit(1);
  const file = rows[0];
  if (!file) {
    return NextResponse.json({ ok: false, error: "File not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    file: {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      iv: file.iv,
      ciphertext: file.ciphertext,
    },
  });
}
