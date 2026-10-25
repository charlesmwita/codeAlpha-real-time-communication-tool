import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { emitEvent, findRoomByCode, getParticipantForUser } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ ok: true });
  }

  const mine = await getParticipantForUser(room.id, user.id);
  if (mine) {
    await db.delete(participants).where(eq(participants.id, mine.id));
    await emitEvent({
      roomId: room.id,
      type: "leave",
      fromParticipantId: mine.id,
      payload: { participantId: mine.id, userId: user.id, reason: "leave" },
    });
  }

  return NextResponse.json({ ok: true });
}
