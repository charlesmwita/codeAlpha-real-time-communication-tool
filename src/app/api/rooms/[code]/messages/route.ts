import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { emitEvent, findRoomByCode, getParticipantForUser } from "@/lib/rooms";

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

  const mine = await getParticipantForUser(room.id, user.id);
  if (!mine) {
    return NextResponse.json({ ok: false, error: "Join the room first." }, { status: 403 });
  }

  const body = (await request.json()) as { iv?: string; ciphertext?: string };
  if (!body.iv || !body.ciphertext) {
    return NextResponse.json({ ok: false, error: "Encrypted payload required." }, { status: 400 });
  }

  const [message] = await db
    .insert(messages)
    .values({
      id: crypto.randomUUID(),
      roomId: room.id,
      userId: user.id,
      iv: body.iv,
      ciphertext: body.ciphertext,
    })
    .returning();

  await emitEvent({
    roomId: room.id,
    type: "chat",
    fromParticipantId: mine.id,
    payload: {
      id: message.id,
      userId: user.id,
      name: user.name,
      iv: message.iv,
      ciphertext: message.ciphertext,
      createdAt: message.createdAt.toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    message: {
      id: message.id,
      userId: user.id,
      name: user.name,
      iv: message.iv,
      ciphertext: message.ciphertext,
      createdAt: message.createdAt.toISOString(),
    },
  });
}
