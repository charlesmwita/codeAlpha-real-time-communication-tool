import type { ReactNode } from "react";
import Image from "next/image";

export function AuthPageShell({
  image,
  caption,
  children,
}: {
  image: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <Image src={image} alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <p className="absolute bottom-10 left-10 max-w-sm text-2xl leading-tight text-[var(--paper)]">{caption}</p>
      </div>
      <div className="flex items-center px-6 py-16 sm:px-12">{children}</div>
    </div>
  );
}