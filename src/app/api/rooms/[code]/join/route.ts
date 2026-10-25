import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { files, messages, participants, users, whiteboardStrokes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { emitEvent, findRoomByCode, listLiveParticipants, pruneStaleParticipants } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function POST(
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

  await pruneStaleParticipants(room.id);

  if (room.isLocked && room.hostId !== user.id) {
    return NextResponse.json({ ok: false, error: "This room is locked by the host." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    camEnabled?: boolean;
    micEnabled?: boolean;
  };

  const existing = await db
    .select()
    .from(participants)
    .where(eq(participants.roomId, room.id));
  const mine = existing.find((row) => row.userId === user.id);
  if (mine) {
    await db.delete(participants).where(eq(participants.id, mine.id));
    await emitEvent({
      roomId: room.id,
      type: "leave",
      fromParticipantId: mine.id,
      payload: { participantId: mine.id, userId: user.id, reason: "replaced" },
    });
  }

  const [participant] = await db
    .insert(participants)
    .values({
      id: crypto.randomUUID(),
      roomId: room.id,
      userId: user.id,
      camEnabled: body.camEnabled ?? true,
      micEnabled: body.micEnabled ?? true,
    })
    .returning();

  const live = await listLiveParticipants(room.id);
  await emitEvent({
    roomId: room.id,
    type: "join",
    fromParticipantId: participant.id,
    payload: {
      participant: live.find((row) => row.id === participant.id),
    },
  });

  const [messageRows, fileRows, strokeRows] = await Promise.all([
    db
      .select({
        id: messages.id,
        userId: messages.userId,
        name: users.name,
        iv: messages.iv,
        ciphertext: messages.ciphertext,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.roomId, room.id))
      .orderBy(desc(messages.createdAt))
      .limit(80),
    db
      .select({
        id: files.id,
        userId: files.userId,
        name: files.name,
        mimeType: files.mimeType,
        size: files.size,
        createdAt: files.createdAt,
        uploaderName: users.name,
      })
      .from(files)
      .innerJoin(users, eq(files.userId, users.id))
      .where(eq(files.roomId, room.id))
      .orderBy(desc(files.createdAt))
      .limit(40),
    db.select().from(whiteboardStrokes).where(eq(whiteboardStrokes.roomId, room.id)),
  ]);

  return NextResponse.json({
    ok: true,
    room: { ...room, createdAt: room.createdAt.toISOString() },
    me: {
      id: participant.id,
      userId: user.id,
      name: user.name,
      avatarHue: user.avatarHue,
      camEnabled: participant.camEnabled,
      micEnabled: participant.micEnabled,
      screenSharing: participant.screenSharing,
      handRaised: participant.handRaised,
      lastSeenAt: participant.lastSeenAt.toISOString(),
    },
    participants: live,
    messages: messageRows
      .slice()
      .reverse()
      .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    files: fileRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    strokes: strokeRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      tool: row.tool,
      color: row.color,
      width: row.width,
      points: row.points,
    })),
  });
}
