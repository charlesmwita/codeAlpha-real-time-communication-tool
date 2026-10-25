import { NextResponse } from "next/server";
import { db } from "@/db";
import { files } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { MAX_FILE_BYTES } from "@/lib/constants";
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
    name?: string;
    mimeType?: string;
    size?: number;
    iv?: string;
    ciphertext?: string;
  };

  const name = (body.name ?? "file").slice(0, 180);
  if (!body.iv || !body.ciphertext || !body.size) {
    return NextResponse.json({ ok: false, error: "Encrypted file payload required." }, { status: 400 });
  }
  if (body.size > MAX_FILE_BYTES) {
    return NextResponse.json({ ok: false, error: "Files are limited to 1.4 MB." }, { status: 400 });
  }

  const [file] = await db
    .insert(files)
    .values({
      id: crypto.randomUUID(),
      roomId: room.id,
      userId: user.id,
      name,
      mimeType: body.mimeType || "application/octet-stream",
      size: body.size,
      iv: body.iv,
      ciphertext: body.ciphertext,
    })
    .returning();

  const meta = {
    id: file.id,
    userId: user.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    createdAt: file.createdAt.toISOString(),
    uploaderName: user.name,
  };

  await emitEvent({
    roomId: room.id,
    type: "file",
    fromParticipantId: mine.id,
    payload: meta,
  });

  return NextResponse.json({ ok: true, file: meta });
}
