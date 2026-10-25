import { AuthPageShell } from "@/components/AuthPageShell";
import { PasswordRecoveryForm } from "@/components/PasswordRecoveryForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthPageShell image="/images/hero-bg.jpg" caption="The invite hash is the key. We never store it.">
      <PasswordRecoveryForm mode="reset" token={token} />
    </AuthPageShell>
  );
}