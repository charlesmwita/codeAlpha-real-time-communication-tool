import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateRoomCode } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const hosted = await db
    .select()
    .from(rooms)
    .where(eq(rooms.hostId, user.id))
    .orderBy(desc(rooms.createdAt));

  return NextResponse.json({
    ok: true,
    rooms: hosted.map((room) => ({
      ...room,
      createdAt: room.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string };
  const name = (body.name ?? "").trim() || `${user.name.split(" ")[0]}'s room`;

  let room = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateRoomCode();
    try {
      const [created] = await db
        .insert(rooms)
        .values({
          id: crypto.randomUUID(),
          code,
          name,
          hostId: user.id,
        })
        .returning();
      room = created;
      break;
    } catch {
      room = null;
    }
  }

  if (!room) {
    return NextResponse.json({ ok: false, error: "Could not create a room code." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    room: { ...room, createdAt: room.createdAt.toISOString() },
  });
}
