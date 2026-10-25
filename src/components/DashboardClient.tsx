"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { generateRoomKey, persistRoomKey } from "@/lib/crypto-client";
import type { PublicUser, RoomSummary } from "@/lib/types";

export function DashboardClient({ user, rooms }: { user: PublicUser; rooms: RoomSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string; room?: RoomSummary };
      if (!data.ok || !data.room) {
        setError(data.error || "Could not create room.");
        return;
      }
      const key = generateRoomKey();
      persistRoomKey(data.room.code, key);
      router.push(`/room/${data.room.code}#${key}`);
    } catch {
      setError("Could not create room.");
    } finally {
      setPending(false);
    }
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    const next = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (next.length < 4) {
      setError("Enter a valid room code.");
      return;
    }
    router.push(`/room/${next}`);
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[var(--paper-dim)] sm:inline">{user.email}</span>
          <button type="button" className="btn btn-ghost py-2 text-sm" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 pb-20 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-[var(--line)] bg-[var(--bg-2)] p-8">
          <p className="stamp text-[var(--lime)]">Host</p>
          <h1 className="display mt-5 text-5xl font-semibold leading-[0.9]">Open a private room.</h1>
          <p className="mt-4 max-w-md text-[var(--paper-dim)]">
            Hi {user.name.split(" ")[0]}. Quorum gives you a mesh video call, a live board, and files that encrypt in the
            browser before they leave the machine.
          </p>
          <form onSubmit={createRoom} className="mt-8 grid gap-3">
            <input
              className="field"
              placeholder="Room name — Design critique, standup, studio…"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="btn btn-lime w-fit" disabled={pending} type="submit">
              {pending ? "Opening…" : "Create encrypted room"}
            </button>
          </form>
          {error ? <p className="mt-4 text-sm text-[var(--coral)]">{error}</p> : null}
        </section>

        <section className="rounded-[32px] border border-[var(--line)] p-8">
          <p className="stamp text-[var(--sea)]">Join</p>
          <h2 className="display mt-5 text-4xl font-semibold">Have a code?</h2>
          <form onSubmit={joinRoom} className="mt-6 grid gap-3">
            <input
              className="field uppercase tracking-[0.2em]"
              placeholder="ABC123"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <button className="btn btn-paper w-fit" type="submit">
              Jump in
            </button>
          </form>
          <p className="mt-6 text-sm text-[var(--paper-dim)]">
            Ask the host for the full invite link so your chat and files unlock with the same room key.
          </p>
        </section>

        <section className="lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="display text-3xl font-semibold">Your rooms</h2>
            <p className="text-sm text-[var(--paper-dim)]">{rooms.length} hosted</p>
          </div>
          {rooms.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[var(--line-strong)] px-6 py-16 text-[var(--paper-dim)]">
              No rooms yet. Create one and keep the invite — it carries the encryption key in the URL hash, which never
              hits the server.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((item) => (
                <Link
                  key={item.id}
                  href={`/room/${item.code}`}
                  className="rounded-[28px] border border-[var(--line)] bg-[var(--bg-2)] p-5 transition hover:-translate-y-0.5"
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--lime)]">{item.code}</p>
                  <h3 className="display mt-3 text-2xl font-semibold">{item.name}</h3>
                  <p className="mt-2 text-sm text-[var(--paper-dim)]">
                    {new Date(item.createdAt).toLocaleString()} {item.isLocked ? "· locked" : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
