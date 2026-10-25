import { AuthPageShell } from "@/components/AuthPageShell";
import { PasswordRecoveryForm } from "@/components/PasswordRecoveryForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell image="/images/hero-bg.jpg" caption="The invite hash is the key. We never store it.">
      <PasswordRecoveryForm mode="request" />
    </AuthPageShell>
  );
}