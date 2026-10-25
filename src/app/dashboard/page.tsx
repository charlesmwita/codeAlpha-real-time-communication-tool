import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const hosted = await db
    .select()
    .from(rooms)
    .where(eq(rooms.hostId, user.id))
    .orderBy(desc(rooms.createdAt));

  return (
    <DashboardClient
      user={user}
      rooms={hosted.map((room) => ({
        ...room,
        createdAt: room.createdAt.toISOString(),
      }))}
    />
  );
}
