import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { participants, roomEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { findRoomByCode, getParticipantForUser, listLiveParticipants, pruneStaleParticipants } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) {
    return NextResponse.json({ ok: false, error: "Room not found." }, { status: 404 });
  }

  const mine = await getParticipantForUser(room.id, user.id);
  if (!mine) {
    return NextResponse.json({ ok: false, error: "Join the room first." }, { status: 403 });
  }

  await db
    .update(participants)
    .set({ lastSeenAt: new Date() })
    .where(eq(participants.id, mine.id));

  await pruneStaleParticipants(room.id);

  const url = new URL(request.url);
  const after = Number(url.searchParams.get("after") ?? "0") || 0;

  const rows = await db
    .select()
    .from(roomEvents)
    .where(and(eq(roomEvents.roomId, room.id), gt(roomEvents.id, after)))
    .orderBy(roomEvents.id)
    .limit(200);

  const events = rows
    .filter((event) => {
      if (event.fromParticipantId === mine.id) return false;
      if (event.toParticipantId && event.toParticipantId !== mine.id) return false;
      return true;
    })
    .map((event) => ({
      id: event.id,
      type: event.type,
      fromParticipantId: event.fromParticipantId,
      toParticipantId: event.toParticipantId,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    }));

  const lastEventId = rows.length > 0 ? rows[rows.length - 1].id : after;
  const live = await listLiveParticipants(room.id);

  return NextResponse.json({
    ok: true,
    lastEventId,
    events,
    participants: live,
    room: {
      id: room.id,
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      isLocked: room.isLocked,
      createdAt: room.createdAt.toISOString(),
    },
  });
}
