/**
 * Rich presence dinámica — Zero Two (modo Darling).
 *
 * - Now playing real + actualización al instante
 * - Con música: rotación centrada en la pista (casi solo música)
 * - Sin música: marketing con tono Darling + stats
 * - Intervalo adaptativo: 12 s música / 22 s reposo
 * - Preview público para /presence
 */
import { ActivityType, type Client } from "discord.js";
import { BOT_VERSION } from "./version.js";
import { logger } from "../../lib/logger.js";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PresenceSlice = {
  name: string;
  type: ActivityType;
  state?: string;
  status?: "online" | "idle" | "dnd";
  weight?: number;
  /** Etiqueta corta para /presence */
  label?: string;
};

export type MusicPresenceSnap = {
  sessions: number;
  nowPlayingTitle: string | null;
  nowPlayingGuild: string | null;
  paused: boolean;
};

export type PresencePreviewItem = {
  index: number;
  label: string;
  name: string;
  state?: string;
  typeLabel: string;
  type: ActivityType;
  status: string;
  weight: number;
  isCurrent: boolean;
};

export type PresencePreview = {
  mode: "music" | "idle";
  intervalSec: number;
  rotationLength: number;
  currentIndex: number;
  slices: PresencePreviewItem[];
  stats: {
    guilds: number;
    users: number;
    musicSessions: number;
    openTickets: number;
    nowPlayingTitle: string | null;
    nowPlayingGuild: string | null;
    musicPaused: boolean;
    uptime: string;
    ping: number | null;
    version: string;
  };
};

// ── Estado global interno ─────────────────────────────────────────────────────

const MAX_NAME = 128;
const MAX_STATE = 128;
const INTERVAL_IDLE_MS = 22_000;
const INTERVAL_MUSIC_MS = 12_000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let rotateIndex = 0;
let startedAt = Date.now();
let baseEveryMs = INTERVAL_IDLE_MS;
let tickCount = 0;

const statsCache = {
  guilds: 0,
  users: 0,
  musicSessions: 0,
  openTickets: 0,
  nowPlayingTitle: null as string | null,
  nowPlayingGuild: null as string | null,
  musicPaused: false,
  lastFullRefresh: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, max);
  return `${s.slice(0, max - 1)}…`;
}

function sep(left: string, right: string): string {
  return clip(`${left}  ·  ${right}`, MAX_NAME);
}

function plural(n: number, singular: string, pluralStr?: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${pluralStr ?? singular + "s"}`;
}

function formatUptime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86_400);
  const h = Math.floor((totalSec % 86_400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

function formatUsers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("es-ES");
}

function activityTypeLabel(type: ActivityType): string {
  switch (type) {
    case ActivityType.Playing:
      return "Playing";
    case ActivityType.Streaming:
      return "Streaming";
    case ActivityType.Listening:
      return "Listening";
    case ActivityType.Watching:
      return "Watching";
    case ActivityType.Competing:
      return "Competing";
    case ActivityType.Custom:
      return "Custom";
    default:
      return `Type ${type}`;
  }
}

function refreshGuildStats(client: Client): void {
  statsCache.guilds = client.guilds.cache.size;
  let users = 0;
  for (const g of client.guilds.cache.values()) {
    users += g.memberCount ?? 0;
  }
  statsCache.users = users;
  statsCache.lastFullRefresh = Date.now();
}

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
    /* BD no disponible */
  }
}

function wsPing(client: Client): number | null {
  const p = client.ws.ping;
  return Number.isFinite(p) && p >= 0 ? Math.round(p) : null;
}

// ── Construcción de slices ────────────────────────────────────────────────────

function buildMusicSlices(): PresenceSlice[] {
  const {
    musicSessions,
    nowPlayingTitle,
    nowPlayingGuild,
    musicPaused,
    openTickets,
  } = statsCache;
  const slices: PresenceSlice[] = [];
  const guildBit = nowPlayingGuild
    ? clip(nowPlayingGuild, 28)
    : plural(musicSessions, "canal", "canales");

  if (nowPlayingTitle) {
    const title = clip(nowPlayingTitle, 90);
    slices.push({
      label: "Now playing",
      name: musicPaused ? clip(`⏸ ${title}`, MAX_NAME) : title,
      type: ActivityType.Listening,
      state: musicPaused
        ? sep("pausa contigo", guildBit)
        : sep("para ti, Darling", guildBit),
      status: musicPaused ? "idle" : "online",
      weight: 4,
    });

    // Frases cortas con la canción (sin repetir el título entero)
    const short = clip(nowPlayingTitle, 48);
    slices.push({
      label: "Darling vibe",
      name: musicPaused
        ? sep(`🌸 esperando`, short)
        : sep(`💕 contigo`, short),
      type: ActivityType.Listening,
      state: musicPaused
        ? "Cuando quieras, reanudamos…"
        : "Zero Two en el canal de voz",
      status: musicPaused ? "idle" : "online",
      weight: 2,
    });
  } else {
    slices.push({
      label: "Sesiones activas",
      name: sep(
        `🎵 DJ Zero Two`,
        plural(musicSessions, "canal activo", "canales activos"),
      ),
      type: ActivityType.Listening,
      state: "Hay ritmo en el nexo, Darling",
      status: "online",
      weight: 3,
    });
  }

  slices.push({
    label: "Panel",
    name: sep(`🎛️ /musicpanel`, `cola · loop · shuffle`),
    type: ActivityType.Listening,
    state: "Controla la fiesta sin salir del chat",
    status: "online",
    weight: 1,
  });

  slices.push({
    label: "Custom music",
    name: "Custom Status",
    type: ActivityType.Custom,
    state: clip(
      musicPaused
        ? `⏸ En pausa · /musicpanel`
        : nowPlayingTitle
          ? `🎵 ${clip(nowPlayingTitle, 80)}`
          : `🎵 En vivo · ${plural(musicSessions, "sesión", "sesiones")}`,
      MAX_STATE,
    ),
    status: musicPaused ? "idle" : "online",
    weight: 1,
  });

  // Tickets urgentes aún se asoman (bajo peso) si hay soporte abierto
  if (openTickets > 0) {
    slices.push({
      label: "Tickets (alerta)",
      name: sep(
        `🎫 ${plural(openTickets, "ticket abierto", "tickets abiertos")}`,
        `te esperan`,
      ),
      type: ActivityType.Watching,
      state: "Soporte en curso — no te olvido, Darling",
      status: "idle",
      weight: 1,
    });
  }

  return slices;
}

function buildIdleSlices(client?: Client | null): PresenceSlice[] {
  const { guilds, users, openTickets } = statsCache;
  const hasTickets = openTickets > 0;
  const ping = client ? wsPing(client) : null;
  const uptime = formatUptime(Date.now() - startedAt);
  const slices: PresenceSlice[] = [];

  slices.push({
    label: "Identidad",
    name: sep(`🌸 Zero Two`, BOT_VERSION),
    type: ActivityType.Playing,
    state: "Hola Darling — prueba /help",
    status: "online",
    weight: 2,
  });

  slices.push({
    label: "Custom status",
    name: "Custom Status",
    type: ActivityType.Custom,
    state: clip(`🌸 /help · contigo en el nexo · ${BOT_VERSION}`, MAX_STATE),
    status: "online",
    weight: 2,
  });

  slices.push({
    label: "Música promo",
    name: sep(`🎵 /play`, `YouTube · Spotify · search`),
    type: ActivityType.Listening,
    state: "Pon un tema y bailemos, Darling",
    status: "online",
    weight: 2,
  });

  slices.push({
    label: "Stats",
    name: sep(
      `📡 ${plural(guilds, "servidor")}`,
      `👥 ${formatUsers(users)} usuarios`,
    ),
    type: ActivityType.Watching,
    state:
      ping != null
        ? `latencia ${ping} ms · up ${uptime}`
        : `despierta hace ${uptime}`,
    status: "online",
    weight: 1,
  });

  slices.push({
    label: "Blackjack",
    name: sep(`🃏 /blackjack`, `casino · daily · wallet`),
    type: ActivityType.Playing,
    state: "¿Doblas o te rindes, Darling?",
    status: "online",
    weight: 1,
  });

  slices.push({
    label: "Daily",
    name: sep(`🎁 /daily`, `fichas · rachas`),
    type: ActivityType.Playing,
    state: "Tu recompensa te está esperando",
    status: "online",
    weight: 1,
  });

  if (hasTickets) {
    slices.push({
      label: "Tickets activos",
      name: sep(
        `🎫 ${plural(openTickets, "ticket abierto", "tickets abiertos")}`,
        `/ticket`,
      ),
      type: ActivityType.Watching,
      state: "Alguien necesita ayuda en el nexo",
      status: "idle",
      weight: 2,
    });
  } else {
    slices.push({
      label: "Tickets",
      name: sep(`🎫 /ticket`, `soporte · transcripts`),
      type: ActivityType.Watching,
      state: "Si te pierdes, abre un ticket",
      status: "idle",
      weight: 1,
    });
  }

  slices.push({
    label: "AutoMod",
    name: sep(`🛡️ AutoMod`, `/warn · /ban · reglas`),
    type: ActivityType.Competing,
    state: "Protegiendo a mis partners",
    status: "dnd",
    weight: 1,
  });

  slices.push({
    label: "Info",
    name: sep(`✨ /zerotwoinf`, `stats · red · DB`),
    type: ActivityType.Playing,
    state:
      ping != null
        ? `mi pulso: ${ping} ms · /presence`
        : `up ${uptime} · /presence`,
    status: "online",
    weight: 1,
  });

  slices.push({
    label: "Presence tip",
    name: sep(`🎮 /presence`, `preview de mi estado`),
    type: ActivityType.Watching,
    state: "Mira cómo roto mi rich presence",
    status: "online",
    weight: 1,
  });

  return slices;
}

function buildSlices(client?: Client | null): PresenceSlice[] {
  if (statsCache.musicSessions > 0) {
    return buildMusicSlices();
  }
  return buildIdleSlices(client);
}

function expandRotation(slices: PresenceSlice[]): PresenceSlice[] {
  const out: PresenceSlice[] = [];
  for (const s of slices) {
    const w = Math.max(1, Math.min(5, s.weight ?? 1));
    for (let i = 0; i < w; i++) out.push(s);
  }
  return out.length ? out : slices;
}

function toActivityPayload(slice: PresenceSlice): {
  name: string;
  type: ActivityType;
  state?: string;
} {
  const activity: {
    name: string;
    type: ActivityType;
    state?: string;
  } = {
    name: clip(slice.name, MAX_NAME),
    type: slice.type,
  };

  if (slice.state) {
    activity.state = clip(slice.state, MAX_STATE);
  }

  if (slice.type === ActivityType.Custom) {
    activity.name = "Custom Status";
    activity.state = clip(slice.state ?? slice.name, MAX_STATE);
  }

  return activity;
}

// ── API pública ───────────────────────────────────────────────────────────────

export function applyRichPresence(client: Client, advance = true): void {
  if (!client.user) {
    logger.warn("applyRichPresence: client.user aún no disponible");
    return;
  }

  const rotation = expandRotation(buildSlices(client));
  if (rotation.length === 0) return;

  rotateIndex =
    ((rotateIndex % rotation.length) + rotation.length) % rotation.length;
  const slice = rotation[rotateIndex]!;
  if (advance) {
    rotateIndex = (rotateIndex + 1) % rotation.length;
  }

  const activity = toActivityPayload(slice);

  client.user.setPresence({
    status: slice.status ?? "online",
    activities: [activity],
  });

  logger.debug(
    { presence: activity.name, state: activity.state, type: slice.type },
    "🎮 Rich presence",
  );
}

export function forcePresenceUpdate(client: Client): void {
  if (!client.isReady()) return;
  try {
    applyRichPresence(client, false);
  } catch (err) {
    logger.warn({ err }, "forcePresenceUpdate: error al actualizar presencia");
  }
}

/**
 * Snapshot legible para /presence (no avanza la rotación).
 */
export function getPresencePreview(client?: Client | null): PresencePreview {
  const mode: "music" | "idle" =
    statsCache.musicSessions > 0 ? "music" : "idle";
  const unique = buildSlices(client);
  const rotation = expandRotation(unique);
  const safeIdx =
    rotation.length === 0
      ? 0
      : ((rotateIndex % rotation.length) + rotation.length) % rotation.length;

  // Marcar el slice actual en la lista única (por name+type+state)
  const current = rotation[safeIdx];
  const slices: PresencePreviewItem[] = unique.map((s, i) => {
    const isCurrent = Boolean(
      current &&
        s.name === current.name &&
        s.type === current.type &&
        (s.state ?? "") === (current.state ?? ""),
    );
    return {
      index: i + 1,
      label: s.label ?? `Slice ${i + 1}`,
      name:
        s.type === ActivityType.Custom
          ? (s.state ?? s.name)
          : s.name,
      state: s.state,
      typeLabel: activityTypeLabel(s.type),
      type: s.type,
      status: s.status ?? "online",
      weight: s.weight ?? 1,
      isCurrent,
    };
  });

  return {
    mode,
    intervalSec: Math.round(
      (mode === "music" ? INTERVAL_MUSIC_MS : baseEveryMs) / 1000,
    ),
    rotationLength: rotation.length,
    currentIndex: safeIdx,
    slices,
    stats: {
      guilds: statsCache.guilds,
      users: statsCache.users,
      musicSessions: statsCache.musicSessions,
      openTickets: statsCache.openTickets,
      nowPlayingTitle: statsCache.nowPlayingTitle,
      nowPlayingGuild: statsCache.nowPlayingGuild,
      musicPaused: statsCache.musicPaused,
      uptime: formatUptime(Date.now() - startedAt),
      ping: client ? wsPing(client) : null,
      version: BOT_VERSION,
    },
  };
}

/**
 * Avanza un paso la rotación y aplica (útil para botón “siguiente” en /presence).
 */
export function stepPresence(client: Client): PresencePreview {
  applyRichPresence(client, true);
  return getPresencePreview(client);
}

function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleNextTick(client: Client): void {
  clearRefreshTimer();
  const targetMs =
    statsCache.musicSessions > 0 ? INTERVAL_MUSIC_MS : baseEveryMs;

  refreshTimer = setTimeout(() => {
    try {
      if (!client.isReady()) {
        scheduleNextTick(client);
        return;
      }

      tickCount++;
      if (tickCount % 5 === 0) {
        refreshGuildStats(client);
        void refreshTicketStats();
      }

      void pullMusicSnapshot(client);
      applyRichPresence(client, true);
    } catch (err) {
      logger.warn({ err }, "No se pudo refrescar la rich presence");
    } finally {
      scheduleNextTick(client);
    }
  }, targetMs);

  if (
    typeof refreshTimer === "object" &&
    refreshTimer &&
    "unref" in refreshTimer
  ) {
    (refreshTimer as { unref(): void }).unref();
  }
}

async function pullMusicSnapshot(client: Client): Promise<void> {
  try {
    const { musicManager } = await import("../music/manager.js");
    const snap = musicManager.presenceSnapshot(client);
    statsCache.musicSessions = snap.sessions;
    statsCache.nowPlayingTitle = snap.nowPlayingTitle;
    statsCache.nowPlayingGuild = snap.nowPlayingGuild;
    statsCache.musicPaused = snap.paused;
  } catch {
    /* music optional */
  }
}

export function startPresenceRefresh(
  client: Client,
  everyMs = INTERVAL_IDLE_MS,
): void {
  baseEveryMs = everyMs;
  startedAt = Date.now();
  tickCount = 0;
  clearRefreshTimer();

  refreshGuildStats(client);
  void refreshTicketStats();
  void pullMusicSnapshot(client);

  rotateIndex = 0;
  applyRichPresence(client, true);
  scheduleNextTick(client);

  logger.info(
    {
      idleInterval: `${baseEveryMs / 1000}s`,
      musicInterval: `${INTERVAL_MUSIC_MS / 1000}s`,
      mode: statsCache.musicSessions > 0 ? "music" : "idle",
      slices: buildSlices(client).length,
    },
    "🎮 Rich presence dinámica activada",
  );
}

export function onGuildCountChange(client: Client): void {
  refreshGuildStats(client);
  forcePresenceUpdate(client);
}

export function setMusicSessionCount(client: Client | null, n: number): void {
  const prev = statsCache.musicSessions;
  statsCache.musicSessions = Math.max(0, n);
  (globalThis as unknown as { __ztMusicSessions?: number }).__ztMusicSessions =
    statsCache.musicSessions;

  if (n === 0) {
    statsCache.nowPlayingTitle = null;
    statsCache.nowPlayingGuild = null;
    statsCache.musicPaused = false;
  }

  if (client && (prev === 0) !== (statsCache.musicSessions === 0)) {
    forcePresenceUpdate(client);
  }
}

export function setMusicPresenceFromSnapshot(
  client: Client | null,
  snap: MusicPresenceSnap,
): void {
  const prevActive = statsCache.musicSessions > 0;
  const prevTitle = statsCache.nowPlayingTitle;
  const prevPaused = statsCache.musicPaused;

  statsCache.musicSessions = Math.max(0, snap.sessions);
  statsCache.nowPlayingTitle = snap.nowPlayingTitle;
  statsCache.nowPlayingGuild = snap.nowPlayingGuild;
  statsCache.musicPaused = snap.paused;

  (globalThis as unknown as { __ztMusicSessions?: number }).__ztMusicSessions =
    statsCache.musicSessions;

  const nowActive = statsCache.musicSessions > 0;
  const changed =
    prevActive !== nowActive ||
    prevTitle !== statsCache.nowPlayingTitle ||
    prevPaused !== statsCache.musicPaused;

  if (client && changed) {
    forcePresenceUpdate(client);
  }
}

export function setOpenTicketCount(client: Client | null, n: number): void {
  const prev = statsCache.openTickets;
  statsCache.openTickets = Math.max(0, n);
  if (client && prev !== statsCache.openTickets) {
    forcePresenceUpdate(client);
  }
}

/** @deprecated */
export function setMusicSessionCountLegacy(n: number): void {
  setMusicSessionCount(null, n);
}

/** @deprecated */
export function presenceActivityName(): string {
  return sep(`🌸 Zero Two`, BOT_VERSION);
}
