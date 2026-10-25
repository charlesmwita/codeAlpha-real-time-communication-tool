import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { whiteboardStrokes } from "@/db/schema";
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

  const body = (await request.json()) as {
    tool?: string;
    color?: string;
    width?: number;
    points?: { x: number; y: number }[];
  };

  const points = Array.isArray(body.points) ? body.points.slice(0, 2000) : [];
  if (points.length < 1) {
    return NextResponse.json({ ok: false, error: "Stroke is empty." }, { status: 400 });
  }

  const [stroke] = await db
    .insert(whiteboardStrokes)
    .values({
      id: crypto.randomUUID(),
      roomId: room.id,
      userId: user.id,
      tool: body.tool || "pen",
      color: body.color || "#111111",
      width: Math.min(Math.max(body.width ?? 4, 1), 48),
      points,
    })
    .returning();

  const view = {
    id: stroke.id,
    userId: stroke.userId,
    tool: stroke.tool,
    color: stroke.color,
    width: stroke.width,
    points: stroke.points,
  };

  await emitEvent({
    roomId: room.id,
    type: "stroke",
    fromParticipantId: mine.id,
    payload: view,
  });

  return NextResponse.json({ ok: true, stroke: view });
}

export async function DELETE(
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
    return NextResponse.json({ ok: false, error: "Room not found." }, { status: 404 });
  }

  const mine = await getParticipantForUser(room.id, user.id);
  if (!mine) {
    return NextResponse.json({ ok: false, error: "Join the room first." }, { status: 403 });
  }

  await db.delete(whiteboardStrokes).where(eq(whiteboardStrokes.roomId, room.id));
  await emitEvent({
    roomId: room.id,
    type: "board-clear",
    fromParticipantId: mine.id,
    payload: {},
  });

  return NextResponse.json({ ok: true });
}
