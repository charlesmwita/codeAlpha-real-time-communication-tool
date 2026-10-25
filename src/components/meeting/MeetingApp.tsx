"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Lobby } from "@/components/meeting/Lobby";
import { usePeerConnections } from "@/hooks/usePeerConnections";
import { HEARTBEAT_MS, MAX_FILE_BYTES, POLL_MS } from "@/lib/constants";
import {
  decryptBytes,
  decryptText,
  encryptBytes,
  encryptText,
  generateRoomKey,
  importRoomKey,
  keyFingerprint,
  persistRoomKey,
  readRoomKey,
} from "@/lib/crypto-client";
import { attachSpeakingDetector, getMediaStream } from "@/lib/media";
import type {
  ChatMessage,
  FileMeta,
  ParticipantView,
  PublicUser,
  RoomEvent,
  RoomSummary,
  Stroke,
} from "@/lib/types";

type Sidebar = "chat" | "people" | "files" | null;

const Whiteboard = dynamic(
  () => import("@/components/meeting/Whiteboard").then((module) => module.Whiteboard),
  { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-[var(--paper-dim)]">Loading board…</div> },
);

export function MeetingApp({ user, room }: { user: PublicUser; room: RoomSummary }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"lobby" | "in">("lobby");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [camEnabled, setCamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [sidebar, setSidebar] = useState<Sidebar>("chat");
  const [fingerprint, setFingerprint] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [me, setMe] = useState<ParticipantView | null>(null);
  const [people, setPeople] = useState<ParticipantView[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [draft, setDraft] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<{ id: string; emoji: string; peerId: string }[]>([]);
  const [copyState, setCopyState] = useState("Copy invite");
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const camEnabledRef = useRef(true);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const roomKeyRef = useRef<string>("");
  const afterRef = useRef(0);
  const meIdRef = useRef<string>("");
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const sendSignal = useCallback(
    (type: string, toParticipantId: string, payload: Record<string, unknown>) => {
      void fetch(`/api/rooms/${room.code}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, toParticipantId, payload }),
      });
    },
    [room.code],
  );

  const { streams, callPeer, handleSignal, closePeer, replaceVideoTrack, closeAll } = usePeerConnections(
    localStream,
    sendSignal,
  );

  useEffect(() => {
    localStreamRef.current = localStream;
    camEnabledRef.current = camEnabled;
  }, [camEnabled, localStream]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    void (async () => {
      stream = await getMediaStream();
      cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
      setLocalStream(stream);
      const video = stream.getVideoTracks()[0];
      const audio = stream.getAudioTracks()[0];
      if (video) video.enabled = true;
      if (audio) audio.enabled = true;
    })();
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      screenTrackRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const code = room.code;
    let key = readRoomKey(code);
    if (!key) {
      key = generateRoomKey();
      persistRoomKey(code, key);
    }
    roomKeyRef.current = key;
    if (!window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}#${key}`);
    }
    void importRoomKey(key).then((cryptoKey) => {
      cryptoKeyRef.current = cryptoKey;
    });
    void keyFingerprint(key).then(setFingerprint);
  }, [room.code]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, phase, screenSharing]);

  useEffect(() => {
    if (!localStream) return;
    return attachSpeakingDetector(localStream, (isSpeaking) => {
      setSpeaking((prev) => ({ ...prev, local: isSpeaking }));
    });
  }, [localStream]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    for (const [peerId, stream] of Object.entries(streams)) {
      const stop = attachSpeakingDetector(stream, (isSpeaking) => {
        setSpeaking((prev) => ({ ...prev, [peerId]: isSpeaking }));
      });
      cleanups.push(stop);
    }
    return () => cleanups.forEach((stop) => stop());
  }, [streams]);

  const decryptMessage = useCallback(async (message: ChatMessage) => {
    const key = cryptoKeyRef.current;
    if (!key) return { ...message, plaintext: undefined };
    try {
      const plaintext = await decryptText(key, message.iv, message.ciphertext);
      return { ...message, plaintext };
    } catch {
      return { ...message, plaintext: undefined };
    }
  }, []);

  const join = useCallback(async () => {
    if (!localStream) return;
    setPending(true);
    setError("");
    try {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = camEnabled;
      });
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = micEnabled;
      });
      const response = await fetch(`/api/rooms/${room.code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camEnabled, micEnabled }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        me: ParticipantView;
        participants: ParticipantView[];
        messages: ChatMessage[];
        files: FileMeta[];
        strokes: Stroke[];
      };
      if (!response.ok || !data.ok) {
        setError(data.error || "Could not join.");
        return;
      }
      setMe(data.me);
      meIdRef.current = data.me.id;
      setPeople(data.participants);
      setFiles(data.files);
      setStrokes(data.strokes);
      const decrypted = await Promise.all(data.messages.map(decryptMessage));
      setMessages(decrypted);
      setPhase("in");
      const others = data.participants.filter((person) => person.id !== data.me.id);
      for (const person of others) {
        if (data.me.id < person.id) {
          await callPeer(person.id);
        }
      }
    } catch {
      setError("Could not join the room.");
    } finally {
      setPending(false);
    }
  }, [callPeer, camEnabled, decryptMessage, localStream, micEnabled, room.code]);

  const leave = useCallback(async () => {
    closeAll();
    await fetch(`/api/rooms/${room.code}/leave`, { method: "POST" });
    localStream?.getTracks().forEach((track) => track.stop());
    screenTrackRef.current?.stop();
    router.push("/dashboard");
  }, [closeAll, localStream, room.code, router]);

  useEffect(() => {
    if (phase !== "in") return;
    const onUnload = () => {
      navigator.sendBeacon(`/api/rooms/${room.code}/leave`);
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [phase, room.code]);

  useEffect(() => {
    if (phase !== "in") return;
    let cancelled = false;

    async function loop() {
      while (!cancelled) {
        try {
          const response = await fetch(`/api/rooms/${room.code}/sync?after=${afterRef.current}`);
          const data = (await response.json()) as {
            ok: boolean;
            lastEventId: number;
            events: RoomEvent[];
            participants: ParticipantView[];
          };
          if (data.ok) {
            afterRef.current = data.lastEventId;
            setPeople(data.participants);
            for (const event of data.events) {
              await handleSignal(event);
              if (event.type === "join") {
                const incoming = event.payload.participant as ParticipantView | undefined;
                if (incoming && meIdRef.current && meIdRef.current < incoming.id) {
                  await callPeer(incoming.id);
                }
              }
              if (event.type === "leave") {
                const id = (event.payload.participantId as string) || event.fromParticipantId;
                if (id) closePeer(id);
              }
              if (event.type === "chat") {
                const incoming = event.payload as unknown as ChatMessage;
                const decoded = await decryptMessage(incoming);
                setMessages((prev) => [...prev, decoded]);
              }
              if (event.type === "file") {
                setFiles((prev) => [event.payload as unknown as FileMeta, ...prev]);
              }
              if (event.type === "stroke") {
                setStrokes((prev) => [...prev, event.payload as unknown as Stroke]);
              }
              if (event.type === "board-clear") {
                setStrokes([]);
              }
              if (event.type === "reaction") {
                const id = crypto.randomUUID();
                const emoji = String(event.payload.emoji ?? "✨");
                const peerId = event.fromParticipantId || "remote";
                setReactions((prev) => [...prev, { id, emoji, peerId }]);
                setTimeout(() => {
                  setReactions((prev) => prev.filter((item) => item.id !== id));
                }, 1400);
              }
            }
          }
        } catch {
          /* retry */
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    }

    void loop();
    return () => {
      cancelled = true;
    };
  }, [callPeer, closePeer, decryptMessage, handleSignal, phase, room.code]);

  useEffect(() => {
    if (phase !== "in") return;
    const timer = window.setInterval(() => {
      void fetch(`/api/rooms/${room.code}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camEnabled, micEnabled, screenSharing, handRaised }),
      });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [camEnabled, handRaised, micEnabled, phase, room.code, screenSharing]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function toggleMic() {
    const next = !micEnabled;
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicEnabled(next);
  }

  function toggleCam() {
    const next = !camEnabled;
    if (!screenSharing) {
      localStream?.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
    }
    setCamEnabled(next);
  }

  const stopScreenShare = useCallback(async () => {
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    const camera = cameraTrackRef.current;
    const stream = localStreamRef.current;
    if (camera && stream) {
      const current = stream.getVideoTracks()[0];
      if (current && current !== camera) {
        stream.removeTrack(current);
        stream.addTrack(camera);
      }
      camera.enabled = camEnabledRef.current;
      await replaceVideoTrack(camera);
    }
    setScreenSharing(false);
  }, [replaceVideoTrack]);

  async function toggleScreen() {
    if (screenSharing) {
      await stopScreenShare();
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = screen.getVideoTracks()[0];
      screenTrackRef.current = track;
      const stream = localStreamRef.current;
      if (stream) {
        const current = stream.getVideoTracks()[0];
        if (current) stream.removeTrack(current);
        stream.addTrack(track);
      }
      await replaceVideoTrack(track);
      setScreenSharing(true);
      track.onended = () => {
        void stopScreenShare();
      };
    } catch {
      /* user cancelled */
    }
  }

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    const key = cryptoKeyRef.current;
    if (!text || !key) return;
    const encrypted = await encryptText(key, text);
    const response = await fetch(`/api/rooms/${room.code}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encrypted),
    });
    const data = (await response.json()) as { ok: boolean; message: ChatMessage };
    if (data.ok) {
      setMessages((prev) => [...prev, { ...data.message, plaintext: text }]);
      setDraft("");
    }
  }

  async function uploadFile(file: File) {
    const key = cryptoKeyRef.current;
    if (!key) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("Files are limited to 1.4 MB.");
      return;
    }
    const buffer = await file.arrayBuffer();
    const encrypted = await encryptBytes(key, buffer);
    const response = await fetch(`/api/rooms/${room.code}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        ...encrypted,
      }),
    });
    const data = (await response.json()) as { ok: boolean; file?: FileMeta; error?: string };
    if (data.ok && data.file) {
      setFiles((prev) => [data.file!, ...prev]);
    } else if (data.error) {
      setError(data.error);
    }
  }

  async function downloadFile(file: FileMeta) {
    const key = cryptoKeyRef.current;
    if (!key) return;
    const response = await fetch(`/api/rooms/${room.code}/files/${file.id}`);
    const data = (await response.json()) as {
      ok: boolean;
      file?: { iv: string; ciphertext: string; name: string; mimeType: string };
    };
    if (!data.ok || !data.file) return;
    try {
      const bytes = await decryptBytes(key, data.file.iv, data.file.ciphertext);
      const copy = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(copy).set(bytes);
      const blob = new Blob([copy], { type: data.file.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.file.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not decrypt that file. Check the invite key.");
    }
  }

  async function addStroke(stroke: Omit<Stroke, "id" | "userId">) {
    const response = await fetch(`/api/rooms/${room.code}/whiteboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stroke),
    });
    const data = (await response.json()) as { ok: boolean; stroke?: Stroke };
    if (data.ok && data.stroke) {
      setStrokes((prev) => [...prev, data.stroke!]);
    }
  }

  async function clearBoard() {
    await fetch(`/api/rooms/${room.code}/whiteboard`, { method: "DELETE" });
    setStrokes([]);
  }

  async function sendReaction(emoji: string) {
    const id = crypto.randomUUID();
    setReactions((prev) => [...prev, { id, emoji, peerId: "local" }]);
    setTimeout(() => setReactions((prev) => prev.filter((item) => item.id !== id)), 1400);
    await fetch(`/api/rooms/${room.code}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "reaction", payload: { emoji } }),
    });
  }

  async function copyInvite() {
    const key = roomKeyRef.current;
    const url = `${window.location.origin}/room/${room.code}#${key}`;
    await navigator.clipboard.writeText(url);
    setCopyState("Copied");
    setTimeout(() => setCopyState("Copy invite"), 1500);
  }

  const elapsed = useMemo(() => {
    const total = Math.floor((now - startedAt) / 1000);
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [now, startedAt]);

  const others = people.filter((person) => person.id !== me?.id);
  const presenter = people.find((person) => person.screenSharing);
  const tiles = me
    ? [
        {
          id: "local",
          name: `${user.name} (you)`,
          hue: user.avatarHue,
          stream: localStream,
          cam: screenSharing || camEnabled,
          mic: micEnabled,
          screen: screenSharing,
          hand: handRaised,
          mirrored: !screenSharing,
        },
        ...others.map((person) => ({
          id: person.id,
          name: person.name,
          hue: person.avatarHue,
          stream: streams[person.id] ?? null,
          cam: person.camEnabled || person.screenSharing,
          mic: person.micEnabled,
          screen: person.screenSharing,
          hand: person.handRaised,
          mirrored: false,
        })),
      ]
    : [];

  if (phase === "lobby") {
    return (
      <Lobby
        user={user}
        room={room}
        stream={localStream}
        camEnabled={camEnabled}
        micEnabled={micEnabled}
        fingerprint={fingerprint}
        error={error}
        pending={pending}
        onToggleCam={toggleCam}
        onToggleMic={toggleMic}
        onJoin={join}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div>
          <p className="display text-lg font-semibold">{room.name}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--paper-dim)]">
            {room.code} · {elapsed} · {fingerprint}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="stamp text-[var(--lime)] hidden sm:inline-flex">E2E chat + files</span>
          <button type="button" className="btn btn-ghost py-2 text-sm" onClick={copyInvite}>
            {copyState}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 px-3 pb-28 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="flex min-h-0 flex-col gap-3">
          {boardOpen ? (
            <div className="min-h-[55vh] flex-1">
              <Whiteboard strokes={strokes} onStroke={addStroke} onClear={clearBoard} />
            </div>
          ) : (
            <div
              className={`grid min-h-[55vh] flex-1 gap-3 ${
                tiles.length === 1
                  ? "grid-cols-1"
                  : tiles.length === 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              }`}
            >
              {presenter ? (
                <div className="md:col-span-2 xl:col-span-3">
                  <VideoCard
                    tile={tiles.find((item) => item.id === presenter.id) ?? tiles[0]}
                    speaking={Boolean(speaking[presenter.id === me?.id ? "local" : presenter.id])}
                    reactions={reactions.filter((item) => item.peerId === presenter.id || (presenter.id === me?.id && item.peerId === "local"))}
                  />
                </div>
              ) : null}
              {tiles
                .filter((tile) => (presenter ? tile.id !== presenter.id : true))
                .map((tile) => (
                  <VideoCard
                    key={tile.id}
                    tile={tile}
                    speaking={Boolean(speaking[tile.id === "local" ? "local" : tile.id])}
                    reactions={reactions.filter((item) => item.peerId === tile.id || (tile.id === "local" && item.peerId === "local"))}
                  />
                ))}
            </div>
          )}
        </main>

        {sidebar ? (
          <aside className="panel hidden min-h-0 flex-col overflow-hidden lg:flex">
            <div className="flex gap-1 border-b border-[var(--line)] p-2">
              {(["chat", "people", "files"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSidebar(tab)}
                  className={`flex-1 rounded-full py-2 text-xs font-bold capitalize ${
                    sidebar === tab ? "bg-[var(--lime)] text-[var(--ink)]" : "text-[var(--paper-dim)]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {sidebar === "chat" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((message) => (
                    <div key={message.id}>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--paper-dim)]">
                        {message.name}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">
                        {message.plaintext ?? "Unable to decrypt. Use the full invite link."}
                      </p>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendChat} className="border-t border-[var(--line)] p-3">
                  <input
                    className="field"
                    placeholder="Encrypted message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                </form>
              </div>
            ) : null}
            {sidebar === "people" ? (
              <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-4">
                {people.map((person) => (
                  <div key={person.id} className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-[var(--ink)]"
                        style={{ background: `hsl(${person.avatarHue} 80% 62%)` }}
                      >
                        {person.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">
                          {person.name}
                          {person.userId === user.id ? " (you)" : ""}
                          {person.userId === room.hostId ? " · host" : ""}
                        </p>
                        <p className="text-xs text-[var(--paper-dim)]">
                          {person.micEnabled ? "mic on" : "muted"} · {person.camEnabled ? "cam on" : "cam off"}
                          {person.handRaised ? " · hand" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {sidebar === "files" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <label className="m-4 cursor-pointer rounded-2xl border border-dashed border-[var(--line-strong)] px-4 py-6 text-center text-sm">
                  Drop or choose a file (1.4 MB, encrypted in browser)
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadFile(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-4 pb-4">
                  {files.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => void downloadFile(file)}
                      className="block w-full rounded-2xl bg-black/20 px-3 py-3 text-left"
                    >
                      <p className="truncate text-sm font-semibold">{file.name}</p>
                      <p className="text-xs text-[var(--paper-dim)]">
                        {file.uploaderName} · {Math.ceil(file.size / 1024)} KB
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-3">
        <div className="control-dock">
          <button type="button" className={`icon-btn ${micEnabled ? "" : "off"}`} onClick={toggleMic} aria-label="Mute">
            <IconMic off={!micEnabled} />
          </button>
          <button type="button" className={`icon-btn ${camEnabled ? "" : "off"}`} onClick={toggleCam} aria-label="Camera">
            <IconCam off={!camEnabled} />
          </button>
          <button type="button" className={`icon-btn ${screenSharing ? "active" : ""}`} onClick={() => void toggleScreen()} aria-label="Share screen">
            <IconScreen />
          </button>
          <button type="button" className={`icon-btn ${boardOpen ? "active" : ""}`} onClick={() => setBoardOpen((value) => !value)} aria-label="Whiteboard">
            <IconBoard />
          </button>
          <button type="button" className={`icon-btn ${handRaised ? "active" : ""}`} onClick={() => setHandRaised((value) => !value)} aria-label="Raise hand">
            <IconHand />
          </button>
          <button type="button" className="icon-btn" onClick={() => void sendReaction("✨")} aria-label="React">
            ✦
          </button>
          <button type="button" className={`icon-btn ${sidebar === "chat" ? "active" : ""}`} onClick={() => setSidebar((value) => (value === "chat" ? null : "chat"))} aria-label="Chat">
            <IconChat />
          </button>
          <button type="button" className="icon-btn danger" onClick={() => void leave()} aria-label="Leave">
            <IconLeave />
          </button>
        </div>
      </div>
      {error ? (
        <p className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[var(--coral)] px-4 py-2 text-sm text-white">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function VideoCard({
  tile,
  speaking,
  reactions,
}: {
  tile: {
    id: string;
    name: string;
    hue: number;
    stream: MediaStream | null;
    cam: boolean;
    mic: boolean;
    screen: boolean;
    hand: boolean;
    mirrored: boolean;
  };
  speaking: boolean;
  reactions: { id: string; emoji: string }[];
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = tile.stream;
  }, [tile.stream]);

  return (
    <article className={`video-tile min-h-[220px] ${speaking ? "speaking" : ""}`}>
      {tile.cam && tile.stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={tile.id === "local"}
          className={tile.mirrored ? "scale-x-[-1]" : ""}
        />
      ) : (
        <div className="grid h-full min-h-[220px] place-items-center">
          <div
            className="grid h-24 w-24 place-items-center rounded-full text-3xl font-bold text-[var(--ink)]"
            style={{ background: `hsl(${tile.hue} 80% 62%)` }}
          >
            {tile.name.slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
        <span className="rounded-full bg-black/55 px-3 py-1 text-sm">
          {tile.name}
          {tile.screen ? " · sharing" : ""}
          {tile.hand ? " ✋" : ""}
        </span>
        {!tile.mic ? <span className="rounded-full bg-[var(--coral)] px-2 py-1 text-[10px] font-bold">MUTED</span> : null}
      </div>
      <div className="pointer-events-none absolute inset-0">
        {reactions.map((item) => (
          <span key={item.id} className="reaction-burst absolute bottom-16 left-1/2 text-4xl">
            {item.emoji}
          </span>
        ))}
      </div>
    </article>
  );
}

function IconMic({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {off ? <path d="M4 4l16 16" /> : null}
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </svg>
  );
}
function IconCam({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {off ? <path d="M4 4l16 16" /> : null}
      <rect x="3" y="7" width="12" height="10" rx="2" />
      <path d="M15 10l6-3v10l-6-3" />
    </svg>
  );
}
function IconScreen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
function IconBoard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 14c2-4 4-6 5-6s2 3 5 6" />
    </svg>
  );
}
function IconHand() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 11V5a1 1 0 0 1 2 0v6M10 10V4a1 1 0 0 1 2 0v6M12 11V6a1 1 0 0 1 2 0v5M14 12V8a1 1 0 0 1 2 0v8a5 5 0 0 1-10 0v-3" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 6h14v10H8l-3 3z" />
    </svg>
  );
}
function IconLeave() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M15 5h4v14h-4M10 12h8M10 12l-3-3M10 12l-3 3" />
    </svg>
  );
}
