import crypto from "node:crypto";

export interface SessionUser {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  discriminator: string;
}

export interface SessionPayload {
  user: SessionUser;
  accessToken: string;
  /** unix ms */
  exp: number;
}

const COOKIE_NAME = "zt_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is required for auth sessions");
  return s;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export function signSession(payload: SessionPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expected = b64url(
    crypto.createHmac("sha256", secret()).update(body).digest(),
  );

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as SessionPayload;
    if (!payload?.user?.id || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionPayload(
  user: SessionUser,
  accessToken: string,
): SessionPayload {
  return {
    user,
    accessToken,
    exp: Date.now() + MAX_AGE_MS,
  };
}

/**
 * Cookie options for Express `res.cookie`.
 * NOTE: Express `maxAge` is in **milliseconds** (not seconds).
 */
export function sessionCookieOptions(maxAgeMs: number = MAX_AGE_MS) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeMs,
  };
}

export { COOKIE_NAME, MAX_AGE_MS };

export function avatarUrl(user: SessionUser, size = 128): string | null {
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
  }
  // default avatar
  const idx =
    user.discriminator && user.discriminator !== "0"
      ? Number(user.discriminator) % 5
      : Number(BigInt(user.id) >> 22n) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}
