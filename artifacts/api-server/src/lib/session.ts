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

type CookieReqLike = {
  secure?: boolean;
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
  get?: (name: string) => string | undefined;
};

/**
 * Cookie options for Express `res.cookie`.
 * NOTE: Express `maxAge` is in **milliseconds** (not seconds).
 *
 * Secure is true when the *request* is HTTPS (incl. Dev Tunnel via
 * X-Forwarded-Proto), or COOKIE_SECURE=true. Localhost HTTP stays non-secure
 * so both local and tunnel work with the same server.
 */
export function sessionCookieOptions(
  maxAgeMs: number = MAX_AGE_MS,
  req?: CookieReqLike,
) {
  const isProd = process.env.NODE_ENV === "production";
  const flag = (process.env.COOKIE_SECURE ?? "").toLowerCase();
  const forceSecure = flag === "true" || flag === "1";
  const forceInsecure = flag === "false" || flag === "0";

  let requestHttps = false;
  if (req) {
    const xf = req.headers?.["x-forwarded-proto"];
    const proto = Array.isArray(xf) ? xf[0] : xf;
    requestHttps =
      Boolean(req.secure) ||
      proto === "https" ||
      req.protocol === "https" ||
      (typeof req.get === "function" &&
        (req.get("x-forwarded-proto") ?? "").split(",")[0]?.trim() === "https");
  }

  const secure = forceInsecure
    ? false
    : forceSecure || isProd || requestHttps;

  // SameSite=None requires Secure (cross-site API). Tunnel same-origin uses Lax.
  const crossSite =
    (process.env.COOKIE_SAMESITE ?? "").toLowerCase() === "none";
  const sameSite =
    crossSite && secure ? ("none" as const) : ("lax" as const);

  return {
    httpOnly: true,
    secure,
    sameSite,
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
