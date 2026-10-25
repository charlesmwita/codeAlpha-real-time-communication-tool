export type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatarHue: number;
};

export type RoomSummary = {
  id: string;
  code: string;
  name: string;
  hostId: string;
  isLocked: boolean;
  createdAt: string;
};

export type ParticipantView = {
  id: string;
  userId: string;
  name: string;
  avatarHue: number;
  camEnabled: boolean;
  micEnabled: boolean;
  screenSharing: boolean;
  handRaised: boolean;
  lastSeenAt: string;
};

export type ChatMessage = {
  id: string;
  userId: string;
  name: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
  plaintext?: string;
};

export type FileMeta = {
  id: string;
  userId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploaderName: string;
};

export type Stroke = {
  id: string;
  userId: string;
  tool: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
};

export type RoomEvent = {
  id: number;
  type: string;
  fromParticipantId: string | null;
  toParticipantId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};
