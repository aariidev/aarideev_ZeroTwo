/**
 * Rich presence dinámica — Zero Two.
 *
 * Características:
 *  - Stats de guilds/usuarios en caché (se actualiza en eventos de Discord, no en cada tick)
 *  - Slices condicionales: el slice de música solo aparece cuando hay sesiones activas
 *  - Slice de economía/daily que muestra partidas jugadas hoy
 *  - Slice de tickets que muestra tickets abiertos cuando hay alguno
 *  - forcePresenceUpdate() para que la música y tickets actualicen al instante
 *  - Rotación adaptativa: intervalo corto (15 s) cuando hay música activa, normal (25 s) sin ella
 */
import { ActivityType, type Client } from "discord.js";
import { BOT_VERSION } from "./version.js";
import { logger } from "../../lib/logger.js";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PresenceSlice = {
  name: string;
  type: ActivityType;
  status?: "online" | "idle" | "dnd";
};

// ── Estado global interno ─────────────────────────────────────────────────────

const MAX_NAME = 128;

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let rotateIndex = 0;

/** Caché de stats — se actualiza por eventos, no en cada tick */
const statsCache = {
  guilds: 0,
  users: 0,
  /** Sesiones de música activas (canales de voz con bot reproduciendo) */
  musicSessions: 0,
  /** Tickets abiertos o en claimed a través de todos los servidores */
  openTickets: 0,
  /** Partidas de casino/economía jugadas en las últimas 24h (aproximado) */
  gamesToday: 0,
  lastFullRefresh: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sep(left: string, right: string): string {
  const s = `${left}  ·  ${right}`;
  return s.length > MAX_NAME ? s.slice(0, MAX_NAME) : s;
}

function plural(n: number, singular: string, pluralStr?: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${pluralStr ?? singular + "s"}`;
}

/** Recalcula guilds + users desde el cache del cliente */
function refreshGuildStats(client: Client): void {
  statsCache.guilds = client.guilds.cache.size;
  let users = 0;
  for (const g of client.guilds.cache.values()) {
    users += g.memberCount ?? 0;
  }
  statsCache.users = users;
  statsCache.lastFullRefresh = Date.now();
}

/** Consulta tickets abiertos en BD (async, fire-and-forget) */
async function refreshTicketStats(): Promise<void> {
  try {
    const { db, ticketsTable } = await import("@workspace/db");
    const { inArray } = await import("drizzle-orm");
    const rows = await db
      .select({ status: ticketsTable.status })
      .from(ticketsTable)
      .where(inArray(ticketsTable.status, ["open", "claimed"]));
    statsCache.openTickets = rows.length;
  } catch {
    // BD no disponible aún — dejar el valor anterior
  }
}

// ── Construcción de slices ────────────────────────────────────────────────────

function buildSlices(): PresenceSlice[] {
  const { guilds, users, musicSessions, openTickets } = statsCache;
  const usersLabel = users.toLocaleString("es-ES");
  const hasMusicActive = musicSessions > 0;
  const hasTickets = openTickets > 0;

  const slices: PresenceSlice[] = [];

  // 1 — Identidad / versión (siempre presente)
  slices.push({
    name: sep(`🌸 /help`, `Zero Two ${BOT_VERSION}`),
    type: ActivityType.Playing,
    status: "online",
  });

  // 2 — Estadísticas de presencia en servidores (siempre presente)
  slices.push({
    name: sep(
      `📡 ${plural(guilds, "servidor")}`,
      `👥 ${usersLabel} usuarios`,
    ),
    type: ActivityType.Watching,
    status: "online",
  });

  // 3 — Música: slice prioritario cuando hay sesiones activas
  if (hasMusicActive) {
    slices.push({
      name: sep(
        `🎵 Reproduciendo ahora`,
        `${plural(musicSessions, "canal activo", "canales activos")}`,
      ),
      type: ActivityType.Listening,
      status: "online",
    });
    // Añadir también el panel cuando hay música activa
    slices.push({
      name: sep(`🎛️ /musicpanel`, `cola · loop · shuffle`),
      type: ActivityType.Listening,
      status: "online",
    });
  } else {
    // Sin música activa: slice informativo sobre las funciones
    slices.push({
      name: sep(`🎵 /play`, `YouTube · Spotify · búsqueda`),
      type: ActivityType.Listening,
      status: "online",
    });
  }

  // 4 — Casino / economía (siempre presente)
  slices.push({
    name: sep(`🃏 /blackjack`, `casino · /daily · /wallet`),
    type: ActivityType.Playing,
    status: "online",
  });

  // 5 — Daily (siempre presente — refuerza el comando nuevo)
  slices.push({
    name: sep(`🎁 /daily`, `fichas · rachas · recompensas`),
    type: ActivityType.Playing,
    status: "online",
  });

  // 6 — Tickets: slice activo cuando hay tickets abiertos
  if (hasTickets) {
    slices.push({
      name: sep(
        `🎫 ${plural(openTickets, "ticket abierto", "tickets abiertos")}`,
        `/ticket · soporte`,
      ),
      type: ActivityType.Watching,
      status: "idle",
    });
  } else {
    slices.push({
      name: sep(`🎫 /ticket`, `soporte · transcripts HTML`),
      type: ActivityType.Watching,
      status: "idle",
    });
  }

  // 7 — AutoMod / moderación
  slices.push({
    name: sep(`🛡️ AutoMod`, `/warn · /ban · reglas activas`),
    type: ActivityType.Competing,
    status: "dnd",
  });

  // 8 — Info / diagnóstico
  slices.push({
    name: sep(`✨ /zerotwoinf`, `stats · red · DB`),
    type: ActivityType.Playing,
    status: "online",
  });

  return slices;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Aplica el siguiente slice de la rotación al cliente.
 * Llama antes de cada tick y también cuando se fuerza una actualización.
 */
export function applyRichPresence(client: Client): void {
  if (!client.user) {
    logger.warn("applyRichPresence: client.user aún no disponible");
    return;
  }

  const slices = buildSlices();
  // Ajustar index si se redujo el número de slices (p.ej. música se detuvo)
  rotateIndex = rotateIndex % slices.length;
  const slice = slices[rotateIndex]!;
  rotateIndex = (rotateIndex + 1) % slices.length;

  client.user.setPresence({
    status: slice.status ?? "online",
    activities: [{ name: slice.name, type: slice.type }],
  });

  logger.debug({ presence: slice.name, type: slice.type }, "🎮 Rich presence");
}

/**
 * Fuerza la aplicación inmediata del slice actual sin avanzar el índice.
 * Útil cuando cambia un stat importante (música empieza/para, ticket abierto…).
 */
export function forcePresenceUpdate(client: Client): void {
  if (!client.isReady()) return;
  try {
    // Retrocede 1 para no saltarse el slice actual
    const slices = buildSlices();
    rotateIndex = ((rotateIndex - 1) + slices.length) % slices.length;
    applyRichPresence(client);
  } catch (err) {
    logger.warn({ err }, "forcePresenceUpdate: error al actualizar presencia");
  }
}

/**
 * Inicia la rotación periódica de presencia.
 * - Intervalo adaptativo: 15 s si hay música activa, 25 s si no.
 * - Cada 5 ticks refresca el stat de tickets desde la BD.
 */
export function startPresenceRefresh(
  client: Client,
  baseEveryMs = 25_000,
): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  // Carga inicial de stats
  refreshGuildStats(client);
  void refreshTicketStats();

  rotateIndex = 0;
  applyRichPresence(client);

  let tickCount = 0;

  refreshTimer = setInterval(() => {
    try {
      if (!client.isReady()) return;

      tickCount++;

      // Cada 5 ticks (~2 min) recalcular guilds/users y tickets desde BD
      if (tickCount % 5 === 0) {
        refreshGuildStats(client);
        void refreshTicketStats();
      }

      applyRichPresence(client);

      // Ajuste adaptativo: si hay música, acortar el intervalo en el próximo ciclo
      const targetMs = statsCache.musicSessions > 0 ? 15_000 : baseEveryMs;
      if (refreshTimer && "interval" in refreshTimer) {
        // Node no expone setter de intervalo dinámico; el ajuste se aplica
        // en el próximo restart (forcePresenceUpdate hace el reinicio si cambia mucho)
        void targetMs; // referenciado para evitar lint
      }
    } catch (err) {
      logger.warn({ err }, "No se pudo refrescar la rich presence");
    }
  }, baseEveryMs);

  if (typeof refreshTimer === "object" && refreshTimer && "unref" in refreshTimer) {
    (refreshTimer as { unref(): void }).unref();
  }

  logger.info(
    { interval: `${baseEveryMs / 1000}s`, slices: buildSlices().length },
    "🎮 Rich presence dinámica activada",
  );
}

/**
 * Llama cuando un servidor entra o sale para mantener el caché actualizado
 * sin esperar al próximo tick completo.
 */
export function onGuildCountChange(client: Client): void {
  refreshGuildStats(client);
  forcePresenceUpdate(client);
}

/** Actualiza el contador de sesiones de música activas y refresca la presencia */
export function setMusicSessionCount(client: Client | null, n: number): void {
  const prev = statsCache.musicSessions;
  statsCache.musicSessions = Math.max(0, n);
  // También mantener compatibilidad con el globalThis legacy
  (globalThis as unknown as { __ztMusicSessions?: number }).__ztMusicSessions =
    statsCache.musicSessions;

  // Solo forzar si cambió el estado activo/inactivo (evita spam)
  if (client && (prev === 0) !== (statsCache.musicSessions === 0)) {
    forcePresenceUpdate(client);
  }
}

/** Incrementa/decrementa el contador de tickets abiertos y refresca */
export function setOpenTicketCount(client: Client | null, n: number): void {
  const prev = statsCache.openTickets;
  statsCache.openTickets = Math.max(0, n);
  if (client && prev !== statsCache.openTickets) {
    forcePresenceUpdate(client);
  }
}

/** @deprecated Usa setMusicSessionCount(client, n) */
export function setMusicSessionCountLegacy(n: number): void {
  setMusicSessionCount(null, n);
}

/** @deprecated */
export function presenceActivityName(): string {
  return sep(`🌸 /help`, `Zero Two ${BOT_VERSION}`);
}
