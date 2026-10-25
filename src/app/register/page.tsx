import { AuthForm } from "@/components/AuthForm";
import { AuthPageShell } from "@/components/AuthPageShell";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next || "/dashboard";

  return (
    <AuthPageShell image="/images/whiteboard.jpg" caption="Talk, draw, and pass files without giving up the room.">
      <AuthForm mode="register" nextPath={nextPath} />
    </AuthPageShell>
  );
}
