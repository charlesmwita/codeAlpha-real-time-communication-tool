import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { participants, roomEvents, rooms, users } from "@/db/schema";

export const STALE_MS = 14_000;

export type ParticipantView = {
  id: string;
  userId: string;
  name: string;
  avatarHue: number;
  camEnabled: boolean;
  micEnabled: boolean;
  screenSharing: boolean;
  handRaised: boolean;
  lastSeenAt: string;
};

export async function findRoomByCode(code: string) {
  const normalized = code.trim().toUpperCase();
  const rows = await db.select().from(rooms).where(eq(rooms.code, normalized)).limit(1);
  return rows[0] ?? null;
}

export async function emitEvent(input: {
  roomId: string;
  type: string;
  fromParticipantId?: string | null;
  toParticipantId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const [event] = await db
    .insert(roomEvents)
    .values({
      roomId: input.roomId,
      type: input.type,
      fromParticipantId: input.fromParticipantId ?? null,
      toParticipantId: input.toParticipantId ?? null,
      payload: input.payload ?? {},
    })
    .returning();
  return event;
}

export async function listLiveParticipants(roomId: string): Promise<ParticipantView[]> {
  const cutoff = new Date(Date.now() - STALE_MS);
  const rows = await db
    .select({
      id: participants.id,
      userId: participants.userId,
      name: users.name,
      avatarHue: users.avatarHue,
      camEnabled: participants.camEnabled,
      micEnabled: participants.micEnabled,
      screenSharing: participants.screenSharing,
      handRaised: participants.handRaised,
      lastSeenAt: participants.lastSeenAt,
    })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
    .where(eq(participants.roomId, roomId));

  return rows
    .filter((row) => row.lastSeenAt.getTime() >= cutoff.getTime())
    .map((row) => ({
      ...row,
      lastSeenAt: row.lastSeenAt.toISOString(),
    }));
}

export async function pruneStaleParticipants(roomId: string) {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await db
    .select()
    .from(participants)
    .where(and(eq(participants.roomId, roomId), lt(participants.lastSeenAt, cutoff)));

  for (const row of stale) {
    await db.delete(participants).where(eq(participants.id, row.id));
    await emitEvent({
      roomId,
      type: "leave",
      fromParticipantId: row.id,
      payload: { participantId: row.id, userId: row.userId, reason: "timeout" },
    });
  }
}

export async function getParticipantForUser(roomId: string, userId: string) {
  const rows = await db
    .select()
    .from(participants)
    .where(and(eq(participants.roomId, roomId), eq(participants.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
