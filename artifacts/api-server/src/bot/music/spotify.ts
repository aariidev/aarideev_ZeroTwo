/**
 * Spotify resolver — sin Web API OAuth.
 *
 * Para tracks individuales: oEmbed (sin auth).
 * Para playlists/álbumes: parsea el JSON __NEXT_DATA__ embebido en la página
 * HTML pública de open.spotify.com — igual que hacen Jockie y otros bots.
 * No requiere refresh_token ni Premium, funciona para cualquier playlist pública.
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

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

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
 * Extrae el objeto JSON embebido en <script id="__NEXT_DATA__"> de la página
 * pública de Spotify. Funciona para playlists y álbumes.
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

/**
 * Extrae tracks del JSON __NEXT_DATA__ de una página de playlist.
 * La estructura de Spotify cambia de vez en cuando; probamos varias rutas.
 */
function tracksFromNextData(data: unknown): SpotifyResolvedItem[] {
  const items: SpotifyResolvedItem[] = [];

  // Ruta típica: props.pageProps.state.data.playlist.tracks.items[]
  const tryPaths = (obj: unknown, depth = 0): SpotifyResolvedItem[] => {
    if (depth > 12 || !obj || typeof obj !== "object") return [];
    const o = obj as Record<string, unknown>;

    // Detectar array de items de playlist/álbum
    if (Array.isArray(o["items"])) {
      for (const row of o["items"] as unknown[]) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        // playlist item: { track: { name, artists, duration_ms, ... } }
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
        const spotifyUrl = extUrls?.spotify ?? "";

        const albumNode = trackNode["album"] as
          | { images?: { url?: string }[] }
          | undefined;
        const thumbnail =
          albumNode?.images?.[0]?.url ??
          (trackNode["images"] as { url?: string }[] | undefined)?.[0]?.url ??
          null;

        items.push({
          name,
          artists,
          searchQuery: `${name} ${artists}`.trim(),
          thumbnail,
          durationSec: Math.floor(durationMs / 1000),
          spotifyUrl,
        });
        if (items.length >= 50) return items;
      }
      if (items.length > 0) return items;
    }

    // Recurrir en todos los valores del objeto
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
 * Para playlists/álbumes: parsea la página HTML pública (sin API key).
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

  // Playlist o álbum — parsear la página HTML pública
  const pageUrl = `https://open.spotify.com/${parsed.type}/${parsed.id}`;
  logger.info({ pageUrl }, "spotify: scraping página pública");

  let html: string;
  try {
    html = await fetchSpotifyPage(pageUrl);
  } catch (err) {
    throw new Error(
      `No se pudo cargar la ${parsed.type === "album" ? "álbum" : "playlist"} de Spotify. ` +
        `¿Es privada? Solo se pueden cargar ${parsed.type === "album" ? "álbumes" : "playlists"} públicas.`,
    );
  }

  // Intentar __NEXT_DATA__ primero
  const nextData = extractNextData(html);
  if (nextData) {
    const items = tracksFromNextData(nextData);
    if (items.length > 0) {
      logger.info(
        { n: items.length, type: parsed.type },
        "spotify: tracks extraídos de __NEXT_DATA__",
      );
      return items;
    }
  }

  // Fallback: buscar JSON-LD o meta tags para el título y hacer búsqueda única
  logger.warn(
    { type: parsed.type, id: parsed.id },
    "spotify: __NEXT_DATA__ vacío, intentando meta fallback",
  );

  // Intentar extraer nombre de la playlist del og:title
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const title = ogTitle?.[1]?.trim();

  if (title) {
    logger.info({ title }, "spotify: usando og:title como fallback");
    return [
      {
        name: title,
        artists: "",
        searchQuery: title,
        thumbnail: ogImage?.[1] ?? null,
        durationSec: 0,
        spotifyUrl: url,
      },
    ];
  }

  throw new Error(
    `No se pudieron leer las pistas de la ${parsed.type === "album" ? "álbum" : "playlist"}. ` +
      `Comprueba que es pública en Spotify.`,
  );
}
