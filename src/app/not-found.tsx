import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md">
        <Logo />
        <h1 className="display mt-8 text-5xl font-semibold">That room went dark.</h1>
        <p className="mt-4 text-[var(--paper-dim)]">
          We could not find this page or meeting code. Double-check the invite, or open a new room from your dashboard.
        </p>
        <Link href="/dashboard" className="btn btn-lime mt-8">
          Back to Quorum
        </Link>
      </div>
    </div>
  );
}
