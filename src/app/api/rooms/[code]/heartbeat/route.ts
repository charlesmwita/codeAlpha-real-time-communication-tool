import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { participants } from "@/db/schema";
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
    camEnabled?: boolean;
    micEnabled?: boolean;
    screenSharing?: boolean;
    handRaised?: boolean;
  };

  const next = {
    camEnabled: body.camEnabled ?? mine.camEnabled,
    micEnabled: body.micEnabled ?? mine.micEnabled,
    screenSharing: body.screenSharing ?? mine.screenSharing,
    handRaised: body.handRaised ?? mine.handRaised,
    lastSeenAt: new Date(),
  };

  await db.update(participants).set(next).where(eq(participants.id, mine.id));

  const changed =
    next.camEnabled !== mine.camEnabled ||
    next.micEnabled !== mine.micEnabled ||
    next.screenSharing !== mine.screenSharing ||
    next.handRaised !== mine.handRaised;

  if (changed) {
    await emitEvent({
      roomId: room.id,
      type: "media-state",
      fromParticipantId: mine.id,
      payload: {
        participantId: mine.id,
        camEnabled: next.camEnabled,
        micEnabled: next.micEnabled,
        screenSharing: next.screenSharing,
        handRaised: next.handRaised,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
