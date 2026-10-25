"use client";

import { useEffect, useRef } from "react";
import type { PublicUser, RoomSummary } from "@/lib/types";

export function Lobby({
  user,
  room,
  stream,
  camEnabled,
  micEnabled,
  fingerprint,
  error,
  pending,
  onToggleCam,
  onToggleMic,
  onJoin,
}: {
  user: PublicUser;
  room: RoomSummary;
  stream: MediaStream | null;
  camEnabled: boolean;
  micEnabled: boolean;
  fingerprint: string;
  error: string;
  pending: boolean;
  onToggleCam: () => void;
  onToggleMic: () => void;
  onJoin: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative overflow-hidden p-6 sm:p-10">
        <div className="video-tile aspect-video max-h-[70vh] w-full">
          {camEnabled ? (
            <video ref={videoRef} autoPlay muted playsInline className="scale-x-[-1]" />
          ) : (
            <div className="grid h-full place-items-center">
              <div
                className="grid h-28 w-28 place-items-center rounded-full text-4xl font-bold text-[var(--ink)]"
                style={{ background: `hsl(${user.avatarHue} 80% 62%)` }}
              >
                {user.name.slice(0, 1).toUpperCase()}
              </div>
            </div>
          )}
          <div className="absolute bottom-4 left-4 rounded-full bg-black/55 px-3 py-1 text-sm">{user.name}</div>
        </div>
        <div className="mt-5 flex gap-3">
          <button type="button" className={`icon-btn ${micEnabled ? "" : "off"}`} onClick={onToggleMic} aria-label="Microphone">
            <MicIcon off={!micEnabled} />
          </button>
          <button type="button" className={`icon-btn ${camEnabled ? "" : "off"}`} onClick={onToggleCam} aria-label="Camera">
            <CamIcon off={!camEnabled} />
          </button>
        </div>
      </section>
      <section className="flex flex-col justify-center border-t border-[var(--line)] p-8 lg:border-l lg:border-t-0">
        <p className="stamp text-[var(--lime)]">Ready room · AES-GCM</p>
        <h1 className="display mt-5 max-w-md text-5xl font-semibold leading-[0.92]">{room.name}</h1>
        <p className="mt-4 text-[var(--paper-dim)]">
          Room <span className="text-[var(--paper)]">{room.code}</span>. Media is encrypted in transit with WebRTC
          DTLS-SRTP. Chat and files are encrypted in your browser before they ever touch the server.
        </p>
        <p className="mt-5 text-xs uppercase tracking-[0.18em] text-[var(--paper-dim)]">
          Key fingerprint {fingerprint || "generating…"}
        </p>
        {error ? <p className="mt-4 text-sm text-[var(--coral)]">{error}</p> : null}
        <button type="button" className="btn btn-lime mt-8 w-fit" onClick={onJoin} disabled={pending}>
          {pending ? "Joining…" : "Join the room"}
        </button>
      </section>
    </div>
  );
}

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {off ? <path d="M4 4l16 16" /> : null}
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </svg>
  );
}

function CamIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {off ? <path d="M4 4l16 16" /> : null}
      <rect x="3" y="7" width="12" height="10" rx="2" />
      <path d="M15 10l6-3v10l-6-3" />
    </svg>
  );
}
