/**
 * YouTube cookies + Spotify credentials for play-dl.
 *
 * .env:
 *   YOUTUBE_COOKIE=...                 # header Cookie (from browser)
 *   YOUTUBE_COOKIES_PATH=./cookies.txt # Netscape cookies.txt OR raw cookie string file
 *   SPOTIFY_CLIENT_ID=
 *   SPOTIFY_CLIENT_SECRET=
 *   SPOTIFY_REFRESH_TOKEN=             # from play.authorization() once
 *   SPOTIFY_MARKET=ES
 */
import fs from "node:fs";
import path from "node:path";
import play from "play-dl";
import { logger } from "../../lib/logger.js";

export type MusicProvidersStatus = {
  youtubeCookies: boolean;
  spotify: boolean;
  cookiesPath: string | null;
};

let initialized = false;
let status: MusicProvidersStatus = {
  youtubeCookies: false,
  spotify: false,
  cookiesPath: null,
};

/** Convert Netscape cookies.txt lines → Cookie header string */
function netscapeToCookieHeader(raw: string): string {
  const pairs: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    // Netscape: domain \t flag \t path \t secure \t expiry \t name \t value
    const cols = t.split("\t");
    if (cols.length >= 7) {
      const name = cols[5]?.trim();
      const value = cols[6]?.trim();
      if (name && value !== undefined) pairs.push(`${name}=${value}`);
      continue;
    }
    // Already "a=b; c=d" or single a=b
    if (t.includes("=") && !t.includes("\t")) {
      pairs.push(t.replace(/;$/, "").trim());
    }
  }
  // If the whole file is one cookie header line
  if (pairs.length === 0 && raw.includes("=")) {
    return raw.replace(/\r?\n/g, " ").trim();
  }
  return pairs.join("; ");
}

function loadYoutubeCookie(): string | null {
  const direct = process.env.YOUTUBE_COOKIE?.trim();
  if (direct) return direct;

  const cookiePath =
    process.env.YOUTUBE_COOKIES_PATH?.trim() ||
    process.env.YOUTUBE_COOKIE_PATH?.trim() ||
    "";

  const candidates = [
    cookiePath,
    path.join(process.cwd(), "cookies.txt"),
    path.join(process.cwd(), "..", "cookies.txt"),
    path.join(process.cwd(), "..", "..", "cookies.txt"),
    "H:\\Discord\\02\\cookies.txt",
    "H:\\Discord\\02\\artifacts\\api-server\\cookies.txt",
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      if (!raw.trim()) continue;
      status.cookiesPath = p;
      // Netscape or raw header
      if (raw.includes("\t") || raw.includes("# Netscape") || raw.includes("# HTTP Cookie")) {
        return netscapeToCookieHeader(raw);
      }
      return raw.replace(/\r?\n/g, " ").trim();
    } catch {
      /* try next */
    }
  }
  return null;
}

export function getMusicProvidersStatus(): MusicProvidersStatus {
  return { ...status };
}

/**
 * Call once at bot startup (before any /play).
 */
export async function initMusicProviders(): Promise<MusicProvidersStatus> {
  if (initialized) return status;
  initialized = true;

  const token: Parameters<typeof play.setToken>[0] = {};

  const ytCookie = loadYoutubeCookie();
  if (ytCookie) {
    token.youtube = { cookie: ytCookie };
    status.youtubeCookies = true;
    logger.info(
      { path: status.cookiesPath ?? "YOUTUBE_COOKIE env" },
      "🎵 YouTube cookies cargadas para play-dl",
    );
  } else {
    logger.warn(
      "🎵 Sin cookies de YouTube — añade YOUTUBE_COOKIE o cookies.txt (recomendado para evitar bloqueos)",
    );
  }

  // Custom UA helps rate limits
  token.useragent = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  ];

  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN?.trim();
  const market = (process.env.SPOTIFY_MARKET ?? "ES").trim() || "ES";

  logger.info(
    {
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      hasRefreshToken: Boolean(refreshToken),
      market,
    },
    "🎵 Spotify env check",
  );

  if (clientId && clientSecret && refreshToken) {
    token.spotify = {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      market,
    };
    status.spotify = true;
  } else if (clientId && clientSecret) {
    // play-dl types require refresh_token; some setups still work with empty after authorization()
    token.spotify = {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken || " ",
      market,
    };
    status.spotify = true;
    logger.warn(
      "🎵 Spotify: solo client_id/secret — para playlists/álbumes usa SPOTIFY_REFRESH_TOKEN (play-dl authorization)",
    );
  } else {
    logger.info(
      "🎵 Spotify: sin API keys — tracks usarán oEmbed + búsqueda YouTube; playlists necesitan SPOTIFY_CLIENT_ID/SECRET/REFRESH_TOKEN",
    );
  }

  try {
    await play.setToken(token);
    if (status.spotify) {
      // refresh if expired
      try {
        if (play.is_expired()) {
          await play.refreshToken();
          logger.info("🎵 Spotify token refrescado");
        }
      } catch (err) {
        logger.warn({ err }, "🎵 No se pudo refresh Spotify token");
        // keep spotify flag — oEmbed fallback still works for tracks
      }
    }
  } catch (err) {
    logger.error({ err }, "🎵 Error en play.setToken");
  }

  return status;
}
