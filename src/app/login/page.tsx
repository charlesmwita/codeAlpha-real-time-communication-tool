import { AuthForm } from "@/components/AuthForm";
import { AuthPageShell } from "@/components/AuthPageShell";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next || "/dashboard";

  return (
    <AuthPageShell image="/images/hero-bg.jpg" caption="The invite hash is the key. We never store it.">
      <AuthForm mode="login" nextPath={nextPath} />
    </AuthPageShell>
  );
}
