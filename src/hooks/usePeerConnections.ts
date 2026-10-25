"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomEvent } from "@/lib/types";

const iceServers: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

export function usePeerConnections(
  localStream: MediaStream | null,
  sendSignal: (type: string, toParticipantId: string, payload: Record<string, unknown>) => void,
) {
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const sendRef = useRef(sendSignal);
  const streamRef = useRef(localStream);

  useEffect(() => {
    sendRef.current = sendSignal;
    streamRef.current = localStream;
  }, [localStream, sendSignal]);

  const closePeer = useCallback((id: string) => {
    const pc = pcs.current.get(id);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      pcs.current.delete(id);
    }
    pendingIce.current.delete(id);
    setStreams((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const flushIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIce.current.get(peerId) ?? [];
    pendingIce.current.delete(peerId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const ensurePc = useCallback((peerId: string) => {
    const existing = pcs.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(iceServers);
    const local = streamRef.current;
    if (local) {
      local.getTracks().forEach((track) => {
        pc.addTrack(track, local);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRef.current("ice", peerId, { candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      setStreams((prev) => ({ ...prev, [peerId]: stream }));
    };

    pcs.current.set(peerId, pc);
    return pc;
  }, []);

  const callPeer = useCallback(
    async (peerId: string) => {
      const pc = ensurePc(peerId);
      if (pc.localDescription) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendRef.current("offer", peerId, { sdp: pc.localDescription });
    },
    [ensurePc],
  );

  const handleSignal = useCallback(
    async (event: RoomEvent) => {
      const from = event.fromParticipantId;
      if (!from) return;

      if (event.type === "leave") {
        closePeer((event.payload.participantId as string) || from);
        return;
      }

      if (event.type === "offer" && event.payload.sdp) {
        const pc = ensurePc(from);
        await pc.setRemoteDescription(event.payload.sdp as RTCSessionDescriptionInit);
        await flushIce(from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendRef.current("answer", from, { sdp: pc.localDescription });
        return;
      }

      if (event.type === "answer" && event.payload.sdp) {
        const pc = pcs.current.get(from);
        if (!pc) return;
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription(event.payload.sdp as RTCSessionDescriptionInit);
          await flushIce(from, pc);
        }
        return;
      }

      if (event.type === "ice" && event.payload.candidate) {
        const pc = pcs.current.get(from) ?? ensurePc(from);
        const candidate = event.payload.candidate as RTCIceCandidateInit;
        if (!pc.remoteDescription) {
          const list = pendingIce.current.get(from) ?? [];
          list.push(candidate);
          pendingIce.current.set(from, list);
        } else {
          try {
            await pc.addIceCandidate(candidate);
          } catch {
            /* ignore */
          }
        }
      }
    },
    [closePeer, ensurePc, flushIce],
  );

  const replaceVideoTrack = useCallback(async (track: MediaStreamTrack) => {
    const jobs = [...pcs.current.values()].map(async (pc) => {
      const sender = pc.getSenders().find((item) => item.track?.kind === "video");
      if (sender) await sender.replaceTrack(track);
    });
    await Promise.all(jobs);
  }, []);

  const closeAll = useCallback(() => {
    for (const id of [...pcs.current.keys()]) closePeer(id);
  }, [closePeer]);

  useEffect(() => {
    const connections = pcs.current;
    return () => {
      for (const pc of connections.values()) pc.close();
      connections.clear();
    };
  }, []);

  return { streams, callPeer, handleSignal, closePeer, replaceVideoTrack, closeAll };
}
