import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { findRoomByCode } from "@/lib/rooms";
import { MeetingApp } from "@/components/meeting/MeetingApp";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/room/${code}`);

  const room = await findRoomByCode(code);
  if (!room) notFound();

  return (
    <MeetingApp
      user={user}
      room={{
        id: room.id,
        code: room.code,
        name: room.name,
        hostId: room.hostId,
        isLocked: room.isLocked,
        createdAt: room.createdAt.toISOString(),
      }}
    />
  );
}
