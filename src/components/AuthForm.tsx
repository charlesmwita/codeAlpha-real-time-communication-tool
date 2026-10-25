"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";

type Mode = "login" | "register";

export function AuthForm({ mode, nextPath }: { mode: Mode; nextPath: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.push(nextPath || "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Link href="/" className="mb-10 inline-flex">
        <Logo />
      </Link>
      <p className="stamp text-[var(--lime)]">Encrypted workspace</p>
      <h1 className="display mt-5 text-4xl font-semibold leading-none sm:text-5xl">
        {mode === "login" ? "Welcome back." : "Take a seat."}
      </h1>
      <p className="mt-4 text-[var(--paper-dim)]">
        {mode === "login"
          ? "Sign in to host a room or jump into one already running."
          : "Create an account to host encrypted video rooms with a live board and files."}
      </p>
      <form onSubmit={onSubmit} className="mt-8 grid gap-3">
        {mode === "register" ? (
          <input
            className="field"
            placeholder="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        ) : null}
        <input
          className="field"
          type="email"
          placeholder="Work email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="field"
          type="password"
          placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
        {mode === "login" ? (
          <Link href="/forgot-password" className="justify-self-end text-sm text-[var(--lime)]">
            Forgot password?
          </Link>
        ) : null}
        {error ? <p className="text-sm text-[var(--coral)]">{error}</p> : null}
        <button className="btn btn-lime mt-2" disabled={pending} type="submit">
          {pending ? "Please wait…" : mode === "login" ? "Enter Quorum" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--paper-dim)]">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="text-[var(--lime)]">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have a seat?{" "}
            <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="text-[var(--lime)]">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
