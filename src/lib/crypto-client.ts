function bytesToB64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function b64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToB64Url(bytes: Uint8Array) {
  return bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function b64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return b64ToBytes(padded + pad);
}

export function generateRoomKey() {
  return bytesToB64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function importRoomKey(key: string) {
  const raw = b64UrlToBytes(key);
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function keyFingerprint(key: string) {
  const digest = await crypto.subtle.digest("SHA-256", b64UrlToBytes(key));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 4)} ${hex.slice(4, 8)} ${hex.slice(8, 12)}`.toUpperCase();
}

export async function encryptText(key: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    iv: bytesToB64Url(iv),
    ciphertext: bytesToB64Url(new Uint8Array(cipher)),
  };
}

export async function decryptText(key: CryptoKey, iv: string, ciphertext: string) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64UrlToBytes(iv) },
    key,
    b64UrlToBytes(ciphertext),
  );
  return new TextDecoder().decode(plain);
}

export async function encryptBytes(key: CryptoKey, data: ArrayBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return {
    iv: bytesToB64Url(iv),
    ciphertext: bytesToB64Url(new Uint8Array(cipher)),
  };
}

export async function decryptBytes(key: CryptoKey, iv: string, ciphertext: string) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64UrlToBytes(iv) },
    key,
    b64UrlToBytes(ciphertext),
  );
  return new Uint8Array(plain);
}

export function persistRoomKey(code: string, key: string) {
  sessionStorage.setItem(`quorum_key_${code}`, key);
}

export function readRoomKey(code: string) {
  if (typeof window === "undefined") return null;
  const fromHash = window.location.hash.replace(/^#/, "").trim();
  if (fromHash) {
    persistRoomKey(code, fromHash);
    return fromHash;
  }
  return sessionStorage.getItem(`quorum_key_${code}`);
}
