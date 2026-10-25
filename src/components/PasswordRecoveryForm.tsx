"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

type Mode = "request" | "reset";

export function PasswordRecoveryForm({ mode, token = "" }: { mode: Mode; token?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [developmentResetUrl, setDevelopmentResetUrl] = useState("");
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (mode === "reset" && password !== confirmPassword) {
      setError("Those passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(
        mode === "request" ? "/api/auth/forgot-password" : "/api/auth/reset-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "request" ? { email } : { token, password }),
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        error?: string;
        developmentResetUrl?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      if (mode === "request") {
        setMessage(data.message || "If an account exists for that email, reset instructions will be sent.");
        setDevelopmentResetUrl(data.developmentResetUrl || "");
      } else {
        setComplete(true);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  const isRequest = mode === "request";

  return (
    <div className="mx-auto w-full max-w-md">
      <Link href="/" className="mb-10 inline-flex">
        <Logo />
      </Link>
      <p className="stamp text-[var(--lime)]">Encrypted workspace</p>
      <h1 className="display mt-5 text-4xl font-semibold leading-none sm:text-5xl">
        {isRequest ? "Reset your password." : "Choose a new password."}
      </h1>
      <p className="mt-4 text-[var(--paper-dim)]">
        {isRequest
          ? "Enter the email address on your account and we’ll send a secure reset link."
          : "Your new password must be at least 8 characters long."}
      </p>

      {complete ? (
        <div className="mt-8">
          <p className="text-[var(--sea)]">Your password has been changed. Sign in with your new password.</p>
          <Link href="/login" className="btn btn-lime mt-6">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 grid gap-3">
          {isRequest ? (
            <input
              className="field"
              type="email"
              placeholder="Work email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          ) : (
            <>
              {!token ? <p className="text-sm text-[var(--coral)]">This reset link is invalid or has expired.</p> : null}
              <input
                className="field"
                type="password"
                placeholder="New password (8+ characters)"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <input
                className="field"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </>
          )}
          {message ? <p role="status" className="text-sm text-[var(--sea)]">{message}</p> : null}
          {developmentResetUrl ? (
            <Link href={developmentResetUrl} className="break-all text-sm text-[var(--lime)] underline">
              Open development reset link
            </Link>
          ) : null}
          {error ? <p role="alert" className="text-sm text-[var(--coral)]">{error}</p> : null}
          <button
            className="btn btn-lime mt-2"
            disabled={pending || (!isRequest && !token)}
            type="submit"
          >
            {pending ? "Please wait…" : isRequest ? "Send reset link" : "Save new password"}
          </button>
        </form>
      )}

      {!complete ? (
        <p className="mt-6 text-sm text-[var(--paper-dim)]">
          Remembered it?{" "}
          <Link href="/login" className="text-[var(--lime)]">
            Back to sign in
          </Link>
        </p>
      ) : null}
    </div>
  );
}