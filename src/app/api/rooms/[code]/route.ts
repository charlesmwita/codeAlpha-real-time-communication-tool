import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { findRoomByCode } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function GET(
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

  return NextResponse.json({
    ok: true,
    room: { ...room, createdAt: room.createdAt.toISOString() },
  });
}

export async function PATCH(
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
  if (room.hostId !== user.id) {
    return NextResponse.json({ ok: false, error: "Only the host can update this room." }, { status: 403 });
  }

  const body = (await request.json()) as { isLocked?: boolean; name?: string };
  const [updated] = await db
    .update(rooms)
    .set({
      isLocked: body.isLocked ?? room.isLocked,
      name: body.name?.trim() || room.name,
    })
    .where(eq(rooms.id, room.id))
    .returning();

  return NextResponse.json({
    ok: true,
    room: { ...updated, createdAt: updated.createdAt.toISOString() },
  });
}
