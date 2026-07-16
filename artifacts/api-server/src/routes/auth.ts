import { Router, type Request, type Response } from "express";
import {
  COOKIE_NAME,
  avatarUrl,
  createSessionPayload,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionUser,
} from "../lib/session.js";
import { logger } from "../lib/logger.js";
import { getBotPublicInfo } from "./bot.js";

const router = Router();

function ownerIds(): string[] {
  return (process.env.OWNER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function allowIds(): string[] {
  return (process.env.DASHBOARD_ALLOWED_IDS ?? process.env.OWNER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function roleFor(userId: string): "owner" | "admin" {
  return ownerIds().includes(userId) ? "owner" : "admin";
}

/** In-memory OAuth state (backup if browser drops the short-lived cookie) */
const pendingOAuthStates = new Map<string, number>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function pruneOAuthStates() {
  const now = Date.now();
  for (const [k, exp] of pendingOAuthStates) {
    if (exp < now) pendingOAuthStates.delete(k);
  }
}

function clientId(): string {
  return process.env.CLIENT_ID ?? process.env.DISCORD_CLIENT_ID ?? "";
}

function clientSecret(): string {
  return process.env.CLIENT_SECRET ?? process.env.DISCORD_CLIENT_SECRET ?? "";
}

/** Public dashboard origin for post-login redirect */
function dashboardOrigin(_req?: Request): string {
  return (process.env.DASHBOARD_URL ?? "http://localhost:5173").replace(
    /\/+$/,
    "",
  );
}

/**
 * OAuth redirect_uri — MUST match Discord Developer Portal → OAuth2 → Redirects
 * exactly (scheme, host, port, path, no trailing slash).
 *
 * Default hits the API directly on :8080 (avoids Vite proxy quirks).
 */
function redirectUri(_req?: Request): string {
  if (process.env.DISCORD_REDIRECT_URI?.trim()) {
    return process.env.DISCORD_REDIRECT_URI.trim().replace(/\/+$/, "");
  }
  const api =
    process.env.API_PUBLIC_URL?.replace(/\/+$/, "") ?? "http://localhost:8080";
  return `${api}/api/auth/discord/callback`;
}

// ── GET /auth/discord — start OAuth ──────────────────────────────────────────

router.get("/discord", (req: Request, res: Response) => {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) {
    return res.status(503).json({
      error:
        "Discord OAuth no configurado. Añade CLIENT_SECRET (y CLIENT_ID) al .env.",
      code: "OAUTH_NOT_CONFIGURED",
    });
  }

  pruneOAuthStates();
  const state = Buffer.from(
    JSON.stringify({ t: Date.now(), n: Math.random().toString(36).slice(2) }),
  ).toString("base64url");

  // Express maxAge is milliseconds — 10 minutes
  res.cookie("zt_oauth_state", state, {
    ...sessionCookieOptions(OAUTH_STATE_TTL_MS),
    httpOnly: true,
  });
  pendingOAuthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);

  const redir = redirectUri(req);
  logger.info({ redirect_uri: redir, clientId: id }, "Starting Discord OAuth");

  const params = new URLSearchParams({
    client_id: id,
    response_type: "code",
    redirect_uri: redir,
    // guilds → detect servers you own/manage for dashboard config
    scope: "identify guilds",
    state,
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

// ── GET /auth/discord/callback ───────────────────────────────────────────────

router.get("/discord/callback", async (req: Request, res: Response) => {
  const dash = dashboardOrigin(req);
  try {
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    const cookieState = req.cookies?.zt_oauth_state as string | undefined;

    pruneOAuthStates();
    const memoryOk =
      Boolean(state) &&
      pendingOAuthStates.has(state) &&
      (pendingOAuthStates.get(state) ?? 0) > Date.now();
    const cookieOk = Boolean(state && cookieState && state === cookieState);

    if (!code) {
      return res.redirect(`${dash}/login?error=missing_code`);
    }
    if (!state || (!cookieOk && !memoryOk)) {
      logger.warn(
        {
          hasState: Boolean(state),
          hasCookie: Boolean(cookieState),
          cookieOk,
          memoryOk,
        },
        "OAuth state validation failed",
      );
      return res.redirect(`${dash}/login?error=invalid_state`);
    }

    pendingOAuthStates.delete(state);
    res.clearCookie("zt_oauth_state", { path: "/" });

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId(),
        client_secret: clientSecret(),
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(req),
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      logger.error({ errText }, "Discord token exchange failed");
      return res.redirect(`${dash}/login?error=token_exchange`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      token_type: string;
    };

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return res.redirect(`${dash}/login?error=user_fetch`);
    }

    const discordUser = (await userRes.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar: string | null;
      discriminator: string;
    };

    // Optional allow-list (comma-separated Discord user IDs)
    const allow = allowIds();

    if (allow.length > 0 && !allow.includes(discordUser.id)) {
      logger.warn(
        { userId: discordUser.id },
        "Dashboard login denied — user not in allow-list",
      );
      return res.redirect(`${dash}/login?error=not_allowed`);
    }

    const user: SessionUser = {
      id: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name ?? null,
      avatar: discordUser.avatar,
      discriminator: discordUser.discriminator ?? "0",
    };

    const payload = createSessionPayload(user, tokenData.access_token);
    const signed = signSession(payload);

    res.cookie(COOKIE_NAME, signed, sessionCookieOptions());
    // Flag welcome toast on first land
    res.redirect(`${dash}/?welcome=1`);
  } catch (err) {
    logger.error({ err }, "OAuth callback error");
    res.redirect(`${dash}/login?error=server`);
  }
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/me", (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  const session = verifySession(token);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }

  const user = session.user;
  const role = roleFor(user.id);
  const tag =
    user.discriminator && user.discriminator !== "0"
      ? `${user.username}#${user.discriminator}`
      : user.username;

  res.status(200).json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      globalName: user.globalName,
      discriminator: user.discriminator,
      avatarUrl: avatarUrl(user),
      tag,
      role,
      isOwner: role === "owner",
    },
    session: {
      expiresAt: new Date(session.exp).toISOString(),
      expiresInMs: Math.max(0, session.exp - Date.now()),
    },
  });
});

// ── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.status(200).json({ ok: true });
});

// ── GET /auth/status (public) ────────────────────────────────────────────────

router.get("/status", (_req: Request, res: Response) => {
  const bot = getBotPublicInfo();
  res.status(200).json({
    oauthConfigured: Boolean(clientId() && clientSecret()),
    clientId: clientId() || null,
    bot,
  });
});

export default router;
