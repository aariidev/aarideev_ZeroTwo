/**
 * Spotify Web API (refresh_token) → metadata for YouTube search.
 */
import { logger } from "../../lib/logger.js";

export type SpotifyResolvedItem = {
  name: string;
  artists: string;
  searchQuery: string;
  thumbnail: string | null;
  durationSec: number;
  spotifyUrl: string;
};

let cachedAccess: { token: string; expiresAt: number } | null = null;

function creds() {
  return {
    clientId: (process.env.SPOTIFY_CLIENT_ID ?? "").trim(),
    clientSecret: (process.env.SPOTIFY_CLIENT_SECRET ?? "").trim(),
    refreshToken: (process.env.SPOTIFY_REFRESH_TOKEN ?? "").trim(),
    market: (process.env.SPOTIFY_MARKET ?? "ES").trim() || "ES",
  };
}

export function isSpotifyConfigured(): boolean {
  const c = creds();
  return Boolean(c.clientId && c.clientSecret && c.refreshToken);
}

async function readJson(res: Response, label: string): Promise<unknown> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`${label}: respuesta vacía (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const preview = trimmed.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      `${label}: Spotify no devolvió JSON (HTTP ${res.status}): ${preview}`,
    );
  }
}

export async function getSpotifyAccessToken(): Promise<string> {
  const c = creds();
  if (!c.clientId || !c.clientSecret || !c.refreshToken) {
    throw new Error(
      "Faltan SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET o SPOTIFY_REFRESH_TOKEN en el .env (reinicia el bot).",
    );
  }

  if (cachedAccess && Date.now() < cachedAccess.expiresAt - 30_000) {
    return cachedAccess.token;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: c.refreshToken,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const json = (await readJson(res, "token")) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    const msg = json.error_description || json.error || `HTTP ${res.status}`;
    logger.error({ status: res.status, json }, "Spotify token refresh failed");
    throw new Error(
      `Spotify auth falló: ${msg}. Vuelve a ejecutar: node scripts/spotify-auth.mjs`,
    );
  }

  cachedAccess = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

function extractSpotifyId(
  url: string,
): { type: "track" | "album" | "playlist"; id: string } | null {
  const uri = url.match(/spotify:(track|album|playlist):([a-zA-Z0-9]+)/i);
  if (uri) {
    return {
      type: uri[1]!.toLowerCase() as "track" | "album" | "playlist",
      id: uri[2]!,
    };
  }
  const m = url.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/i,
  );
  if (m) {
    return {
      type: m[1]!.toLowerCase() as "track" | "album" | "playlist",
      id: m[2]!,
    };
  }
  return null;
}

type SpotTrack = {
  name?: string;
  artists?: { name?: string }[];
  duration_ms?: number;
  external_urls?: { spotify?: string };
  album?: { images?: { url?: string }[] };
  images?: { url?: string }[];
};

function itemFromTrack(t: SpotTrack, fallbackUrl: string): SpotifyResolvedItem {
  const name = t.name ?? "Unknown";
  const artists = (t.artists ?? [])
    .map((a) => a.name)
    .filter(Boolean)
    .join(", ");
  return {
    name,
    artists,
    searchQuery: `${name} ${artists}`.trim(),
    thumbnail:
      t.album?.images?.[0]?.url ?? t.images?.[0]?.url ?? null,
    durationSec: Math.floor((t.duration_ms ?? 0) / 1000),
    spotifyUrl: t.external_urls?.spotify ?? fallbackUrl,
  };
}

async function apiGet(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const json = await readJson(res, "api");
  if (!res.ok) {
    const err = json as { error?: { message?: string; status?: number } };
    throw new Error(
      err.error?.message ||
        `Spotify API HTTP ${res.status}`,
    );
  }
  return json;
}

/**
 * Resolve Spotify URL → list of track metadata (max 50).
 */
export async function resolveSpotifyItems(
  url: string,
): Promise<SpotifyResolvedItem[]> {
  const parsed = extractSpotifyId(url);
  if (!parsed) {
    throw new Error(
      "URL de Spotify no válida. Usa open.spotify.com/track|album|playlist/…",
    );
  }

  const token = await getSpotifyAccessToken();
  const market = encodeURIComponent(creds().market);
  const base = "https://api.spotify.com/v1";

  if (parsed.type === "track") {
    const t = (await apiGet(
      `${base}/tracks/${parsed.id}?market=${market}`,
      token,
    )) as SpotTrack;
    return [itemFromTrack(t, url)];
  }

  if (parsed.type === "album") {
    const album = (await apiGet(
      `${base}/albums/${parsed.id}?market=${market}`,
      token,
    )) as {
      images?: { url?: string }[];
      tracks?: { items?: SpotTrack[]; next?: string | null };
    };
    const thumb = album.images?.[0]?.url ?? null;
    const items: SpotifyResolvedItem[] = [];

    let next: string | null | undefined = null;
    let batch = album.tracks?.items ?? [];
    next = album.tracks?.next ?? null;

    if (!batch.length) {
      const page = (await apiGet(
        `${base}/albums/${parsed.id}/tracks?market=${market}&limit=50`,
        token,
      )) as { items: SpotTrack[]; next: string | null };
      batch = page.items ?? [];
      next = page.next;
    }

    const consume = (list: SpotTrack[]) => {
      for (const t of list) {
        if (!t?.name) continue;
        const item = itemFromTrack(t, url);
        if (thumb && !item.thumbnail) item.thumbnail = thumb;
        items.push(item);
        if (items.length >= 50) return false;
      }
      return true;
    };

    if (!consume(batch)) return items;

    while (next && items.length < 50) {
      const page = (await apiGet(next, token)) as {
        items: SpotTrack[];
        next: string | null;
      };
      if (!consume(page.items ?? [])) break;
      next = page.next;
    }

    if (!items.length) throw new Error("Álbum vacío o no accesible.");
    return items;
  }

  // playlist — use full next URLs from Spotify (don't rewrite paths)
  const items: SpotifyResolvedItem[] = [];
  let next: string | null =
    `${base}/playlists/${parsed.id}/tracks?market=${market}&limit=50&fields=items(track(name,artists(name),duration_ms,external_urls,album(images))),next`;

  while (next && items.length < 50) {
    const page = (await apiGet(next, token)) as {
      items?: { track?: SpotTrack | null }[];
      next?: string | null;
    };

    for (const row of page.items ?? []) {
      const t = row.track;
      if (!t || !t.name) continue; // local/unavailable tracks
      items.push(itemFromTrack(t, url));
      if (items.length >= 50) break;
    }

    next = page.next ?? null;
  }

  if (!items.length) {
    throw new Error(
      "Playlist vacía o no accesible. Si es privada, vuelve a autorizar con: node scripts/spotify-auth.mjs",
    );
  }
  return items;
}

