import { NextResponse } from "next/server";
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
    type?: string;
    toParticipantId?: string | null;
    payload?: Record<string, unknown>;
  };

  const type = (body.type ?? "").trim();
  if (!type) {
    return NextResponse.json({ ok: false, error: "Event type required." }, { status: 400 });
  }

  const event = await emitEvent({
    roomId: room.id,
    type,
    fromParticipantId: mine.id,
    toParticipantId: body.toParticipantId ?? null,
    payload: body.payload ?? {},
  });

  return NextResponse.json({ ok: true, id: event.id });
}
