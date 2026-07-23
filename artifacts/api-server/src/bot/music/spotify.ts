/**
 * Spotify resolver — sin Web API OAuth (y sin depender de play-dl).
 *
 * Contexto 2025/2026: open.spotify.com ya no embebe __NEXT_DATA__ con pistas
 * (SPA vacía). La Web API con client_credentials a menudo devuelve playlists
 * sin `tracks` y 403 en /tracks (quota extendida).
 *
 * Estrategia:
 *   - track individual → oEmbed
 *   - playlist/álbum  → scrape de open.spotify.com/embed/{type}/{id}
 *     (sigue incluyendo __NEXT_DATA__ con entity.trackList[])
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

// ── Siempre disponible mientras haya internet ─────────────────────────────────
export function isSpotifyConfigured(): boolean {
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/i,
  );
  if (m) {
    return {
      type: m[1]!.toLowerCase() as "track" | "album" | "playlist",
      id: m[2]!,
    };
  }
  return null;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const MAX_TRACKS = 50;

async function fetchSpotifyPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Spotify page HTTP ${res.status} para ${url}`);
  }
  return res.text();
}

/**
 * Extrae el objeto JSON embebido en <script id="__NEXT_DATA__">.
 */
function extractNextData(html: string): unknown {
  const match = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // ignorar
    }
  }
  return null;
}

function uriToSpotifyUrl(uri: string | undefined): string {
  if (!uri || typeof uri !== "string") return "";
  const m = uri.match(/^spotify:(track|album|playlist):([a-zA-Z0-9]+)$/i);
  if (!m) return "";
  return `https://open.spotify.com/${m[1]!.toLowerCase()}/${m[2]}`;
}

function pushItem(
  items: SpotifyResolvedItem[],
  opts: {
    name: string;
    artists: string;
    durationMs?: number;
    spotifyUrl?: string;
    thumbnail?: string | null;
  },
): boolean {
  const name = opts.name.trim();
  if (!name) return false;
  const artists = (opts.artists ?? "").trim();
  items.push({
    name,
    artists,
    searchQuery: `${name} ${artists}`.trim(),
    thumbnail: opts.thumbnail ?? null,
    durationSec: Math.floor((opts.durationMs ?? 0) / 1000),
    spotifyUrl: opts.spotifyUrl ?? "",
  });
  return items.length >= MAX_TRACKS;
}

/**
 * Formato actual del embed: entity.trackList[] con title/subtitle/duration/uri.
 */
function tracksFromEmbedEntity(data: unknown): SpotifyResolvedItem[] {
  const items: SpotifyResolvedItem[] = [];

  const walk = (obj: unknown, depth = 0): void => {
    if (items.length >= MAX_TRACKS || depth > 14 || !obj || typeof obj !== "object") {
      return;
    }

    if (Array.isArray(obj)) {
      for (const row of obj) {
        if (items.length >= MAX_TRACKS) return;
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;

        // embed trackList item
        const title =
          typeof r["title"] === "string"
            ? r["title"]
            : typeof r["name"] === "string"
              ? r["name"]
              : null;
        const entityType = r["entityType"];
        const uri = typeof r["uri"] === "string" ? r["uri"] : "";
        const looksLikeTrack =
          entityType === "track" ||
          (typeof uri === "string" && uri.startsWith("spotify:track:")) ||
          (title &&
            (typeof r["subtitle"] === "string" ||
              typeof r["duration"] === "number") &&
            !r["trackList"]);

        if (title && looksLikeTrack) {
          const subtitle =
            typeof r["subtitle"] === "string" ? r["subtitle"] : "";
          const durationMs =
            typeof r["duration"] === "number"
              ? r["duration"]
              : typeof r["duration_ms"] === "number"
                ? r["duration_ms"]
                : 0;
          if (
            pushItem(items, {
              name: title,
              artists: subtitle,
              durationMs,
              spotifyUrl: uriToSpotifyUrl(uri),
            })
          ) {
            return;
          }
          continue;
        }

        walk(row, depth + 1);
      }
      return;
    }

    const o = obj as Record<string, unknown>;

    // Atajo: entity.trackList del embed
    if (Array.isArray(o["trackList"])) {
      walk(o["trackList"], depth + 1);
      if (items.length > 0) return;
    }

    for (const val of Object.values(o)) {
      if (items.length >= MAX_TRACKS) return;
      if (val && typeof val === "object") walk(val, depth + 1);
    }
  };

  walk(data);
  return items;
}

/**
 * Formato legacy Web API embebido: items[].track { name, artists, duration_ms }.
 */
function tracksFromLegacyItems(data: unknown): SpotifyResolvedItem[] {
  const items: SpotifyResolvedItem[] = [];

  const tryPaths = (obj: unknown, depth = 0): SpotifyResolvedItem[] => {
    if (depth > 12 || !obj || typeof obj !== "object") return [];
    const o = obj as Record<string, unknown>;

    if (Array.isArray(o["items"])) {
      for (const row of o["items"] as unknown[]) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const trackNode =
          (r["track"] as Record<string, unknown> | undefined) ??
          (r as Record<string, unknown>);
        const name =
          typeof trackNode["name"] === "string" ? trackNode["name"] : null;
        if (!name) continue;

        const artistsRaw = trackNode["artists"];
        const artists = Array.isArray(artistsRaw)
          ? (artistsRaw as { name?: string }[])
              .map((a) => a.name)
              .filter(Boolean)
              .join(", ")
          : typeof artistsRaw === "string"
            ? artistsRaw
            : "";

        const durationMs =
          typeof trackNode["duration_ms"] === "number"
            ? trackNode["duration_ms"]
            : 0;

        const extUrls = trackNode["external_urls"] as
          | { spotify?: string }
          | undefined;
        const spotifyUrl =
          extUrls?.spotify ??
          uriToSpotifyUrl(
            typeof trackNode["uri"] === "string" ? trackNode["uri"] : undefined,
          );

        const albumNode = trackNode["album"] as
          | { images?: { url?: string }[] }
          | undefined;
        const thumbnail =
          albumNode?.images?.[0]?.url ??
          (trackNode["images"] as { url?: string }[] | undefined)?.[0]?.url ??
          null;

        if (
          pushItem(items, {
            name,
            artists,
            durationMs,
            spotifyUrl,
            thumbnail,
          })
        ) {
          return items;
        }
      }
      if (items.length > 0) return items;
    }

    for (const val of Object.values(o)) {
      if (val && typeof val === "object") {
        const found = tryPaths(val, depth + 1);
        if (found.length > 0) return found;
      }
    }
    return [];
  };

  return tryPaths(data);
}

function tracksFromNextData(data: unknown): SpotifyResolvedItem[] {
  const embed = tracksFromEmbedEntity(data);
  if (embed.length > 0) return embed;
  return tracksFromLegacyItems(data);
}

function metaContent(html: string, property: string): string | null {
  // property/content en cualquier orden
  const re1 = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
    "i",
  );
  return html.match(re1)?.[1]?.trim() || html.match(re2)?.[1]?.trim() || null;
}

// ── Resolver de oEmbed (tracks individuales) ──────────────────────────────────

export async function resolveViaOEmbed(
  url: string,
): Promise<{ title: string; thumbnail: string | null }> {
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  const res = await fetch(oembedUrl, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`oEmbed HTTP ${res.status}`);
  const data = (await res.json()) as {
    title?: string;
    thumbnail_url?: string;
  };
  if (!data.title) throw new Error("oEmbed: sin título");
  return { title: data.title, thumbnail: data.thumbnail_url ?? null };
}

// ── Resolver principal ────────────────────────────────────────────────────────

/**
 * Convierte una URL de Spotify en lista de tracks con metadatos.
 * Para playlists/álbumes: parsea la página embed pública (sin API key).
 * Para tracks individuales: usa oEmbed.
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

  // Track individual — oEmbed es suficiente y más rápido
  if (parsed.type === "track") {
    try {
      const { title, thumbnail } = await resolveViaOEmbed(url);
      return [
        {
          name: title,
          artists: "",
          searchQuery: title,
          thumbnail,
          durationSec: 0,
          spotifyUrl: url,
        },
      ];
    } catch (err) {
      logger.warn({ err }, "spotify: oEmbed track falló");
      throw new Error(`No se pudo resolver el track de Spotify: ${url}`);
    }
  }

  // Playlist o álbum — el embed sigue trayendo trackList en __NEXT_DATA__
  // (la web player principal ya no embebe las pistas en el HTML inicial).
  const pageCandidates = [
    `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`,
    `https://open.spotify.com/${parsed.type}/${parsed.id}`,
  ];

  let lastHtml = "";
  let lastError: unknown = null;

  for (const pageUrl of pageCandidates) {
    logger.info({ pageUrl }, "spotify: scraping página pública");
    let html: string;
    try {
      html = await fetchSpotifyPage(pageUrl);
      lastHtml = html;
    } catch (err) {
      lastError = err;
      logger.warn({ err, pageUrl }, "spotify: fallo al cargar página");
      continue;
    }

    const nextData = extractNextData(html);
    if (nextData) {
      const items = tracksFromNextData(nextData);
      if (items.length > 0) {
        logger.info(
          { n: items.length, type: parsed.type, pageUrl },
          "spotify: tracks extraídos de __NEXT_DATA__",
        );
        return items;
      }
    }
  }

  // Fallback: og:title (una sola búsqueda en YouTube con el nombre de la lista)
  logger.warn(
    { type: parsed.type, id: parsed.id, lastError: String(lastError ?? "") },
    "spotify: __NEXT_DATA__ vacío, intentando meta fallback",
  );

  const html = lastHtml;
  if (html) {
    const title =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title") ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      null;
    const ogImage =
      metaContent(html, "og:image") || metaContent(html, "twitter:image");

    // El embed a veces deja title vacío ("Spotify - Web Player") — no usar basura
    if (
      title &&
      !/^spotify(\s*-\s*web player)?$/i.test(title) &&
      title.length > 1
    ) {
      logger.info({ title }, "spotify: usando og:title como fallback");
      return [
        {
          name: title,
          artists: "",
          searchQuery: title,
          thumbnail: ogImage,
          durationSec: 0,
          spotifyUrl: url,
        },
      ];
    }
  }

  throw new Error(
    `No se pudieron leer las pistas de la ${parsed.type === "album" ? "álbum" : "playlist"}. ` +
      `Comprueba que es pública en Spotify.`,
  );
}
