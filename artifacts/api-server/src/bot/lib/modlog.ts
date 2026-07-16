import {
  AuditLogEvent,
  Client,
  EmbedBuilder,
  Guild,
  TextChannel,
  type GuildAuditLogsEntry,
  type User,
} from "discord.js";
import { db, botConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

const LOG_KEY = (guildId: string) => `log_channel:${guildId}`;
const EVENTS_KEY = (guildId: string) => `log_events:${guildId}`;
const SETTINGS_KEY = (guildId: string) => `log_settings:${guildId}`;

/** All supported server-log event keys */
export const LOG_EVENT_KEYS = [
  // Moderación
  "ban",
  "unban",
  "kick",
  "timeout",
  "untimeout",
  // Mensajes
  "message_delete",
  "message_edit",
  "message_bulk_delete",
  // Miembros
  "member_join",
  "member_leave",
  "member_roles",
  "member_nickname",
  // Servidor
  "channel_create",
  "channel_delete",
  "role_create",
  "role_delete",
  "invite_create",
  "invite_delete",
  // Voz
  "voice_join",
  "voice_leave",
  "voice_move",
] as const;

export type LogEventKey = (typeof LOG_EVENT_KEYS)[number];

export type LogEventCategory =
  | "moderation"
  | "messages"
  | "members"
  | "server"
  | "voice";

export const LOG_EVENT_META: Record<
  LogEventKey,
  { label: string; category: LogEventCategory; description: string }
> = {
  ban: {
    label: "Baneos",
    category: "moderation",
    description: "Cuando alguien es baneado",
  },
  unban: {
    label: "Desbaneos",
    category: "moderation",
    description: "Cuando se revoca un ban",
  },
  kick: {
    label: "Expulsiones",
    category: "moderation",
    description: "Kicks detectados vía audit log",
  },
  timeout: {
    label: "Timeouts",
    category: "moderation",
    description: "Aislamiento temporal de miembros",
  },
  untimeout: {
    label: "Fin de timeout",
    category: "moderation",
    description: "Cuando se quita un timeout",
  },
  message_delete: {
    label: "Mensajes borrados",
    category: "messages",
    description: "Un mensaje eliminado",
  },
  message_edit: {
    label: "Mensajes editados",
    category: "messages",
    description: "Antes / después del contenido",
  },
  message_bulk_delete: {
    label: "Borrado masivo",
    category: "messages",
    description: "Purge / bulk delete",
  },
  member_join: {
    label: "Entradas",
    category: "members",
    description: "Alguien se une al servidor",
  },
  member_leave: {
    label: "Salidas",
    category: "members",
    description: "Alguien abandona el servidor",
  },
  member_roles: {
    label: "Cambio de roles",
    category: "members",
    description: "Roles añadidos o quitados",
  },
  member_nickname: {
    label: "Apodos",
    category: "members",
    description: "Cambio de nickname",
  },
  channel_create: {
    label: "Canal creado",
    category: "server",
    description: "Nuevo canal de texto/voz/etc.",
  },
  channel_delete: {
    label: "Canal eliminado",
    category: "server",
    description: "Canal borrado",
  },
  role_create: {
    label: "Rol creado",
    category: "server",
    description: "Nuevo rol en el servidor",
  },
  role_delete: {
    label: "Rol eliminado",
    category: "server",
    description: "Rol borrado",
  },
  invite_create: {
    label: "Invitación creada",
    category: "server",
    description: "Nueva invite",
  },
  invite_delete: {
    label: "Invitación borrada",
    category: "server",
    description: "Invite eliminada o expirada",
  },
  voice_join: {
    label: "Entrada a voz",
    category: "voice",
    description: "Conexión a un canal de voz",
  },
  voice_leave: {
    label: "Salida de voz",
    category: "voice",
    description: "Desconexión de voz",
  },
  voice_move: {
    label: "Movimiento de voz",
    category: "voice",
    description: "Cambio de canal de voz",
  },
};

/** @deprecated use LOG_EVENT_META — kept for older imports */
export const LOG_EVENT_LABELS: Record<LogEventKey, string> = Object.fromEntries(
  LOG_EVENT_KEYS.map((k) => [k, LOG_EVENT_META[k].label]),
) as Record<LogEventKey, string>;

export const LOG_CATEGORIES: {
  id: LogEventCategory;
  label: string;
  events: LogEventKey[];
}[] = [
  {
    id: "moderation",
    label: "Moderación",
    events: ["ban", "unban", "kick", "timeout", "untimeout"],
  },
  {
    id: "messages",
    label: "Mensajes",
    events: ["message_delete", "message_edit", "message_bulk_delete"],
  },
  {
    id: "members",
    label: "Miembros",
    events: ["member_join", "member_leave", "member_roles", "member_nickname"],
  },
  {
    id: "server",
    label: "Servidor",
    events: [
      "channel_create",
      "channel_delete",
      "role_create",
      "role_delete",
      "invite_create",
      "invite_delete",
    ],
  },
  {
    id: "voice",
    label: "Voz",
    events: ["voice_join", "voice_leave", "voice_move"],
  },
];

export interface GuildLogSettings {
  channelId: string | null;
  events: LogEventKey[];
  /** No registrar acciones de bots */
  ignoreBots: boolean;
  /** No registrar webhooks */
  ignoreWebhooks: boolean;
  /** IDs de canales ignorados (delete/edit) */
  ignoreChannels: string[];
  /** Alertar joins con cuenta más nueva que N días (0 = off) */
  joinAlertDays: number;
  /** Incluir links de adjuntos en deletes */
  includeAttachments: boolean;
  /** Menciones @rol en cada log (opcional) */
  pingRoleId: string | null;
}

export function defaultLogEvents(): LogEventKey[] {
  // Sensible defaults — not every noisy event
  return [
    "ban",
    "unban",
    "kick",
    "timeout",
    "message_delete",
    "message_edit",
    "message_bulk_delete",
    "member_join",
    "member_leave",
  ];
}

export function defaultGuildLogSettings(): GuildLogSettings {
  return {
    channelId: null,
    events: defaultLogEvents(),
    ignoreBots: true,
    ignoreWebhooks: true,
    ignoreChannels: [],
    joinAlertDays: 7,
    includeAttachments: true,
    pingRoleId: null,
  };
}

function sanitizeEvents(events: unknown): LogEventKey[] {
  if (!Array.isArray(events)) return defaultLogEvents();
  const allowed = new Set<string>(LOG_EVENT_KEYS);
  const filtered = events.filter((k): k is LogEventKey =>
    typeof k === "string" ? allowed.has(k) : false,
  );
  return filtered.length ? filtered : defaultLogEvents();
}

function sanitizeSettings(raw: Partial<GuildLogSettings> | null): GuildLogSettings {
  const base = defaultGuildLogSettings();
  if (!raw) return base;
  return {
    channelId:
      typeof raw.channelId === "string" && raw.channelId
        ? raw.channelId
        : raw.channelId === null
          ? null
          : base.channelId,
    events: sanitizeEvents(raw.events),
    ignoreBots: raw.ignoreBots ?? base.ignoreBots,
    ignoreWebhooks: raw.ignoreWebhooks ?? base.ignoreWebhooks,
    ignoreChannels: Array.isArray(raw.ignoreChannels)
      ? raw.ignoreChannels.filter((x) => typeof x === "string")
      : base.ignoreChannels,
    joinAlertDays:
      typeof raw.joinAlertDays === "number" && raw.joinAlertDays >= 0
        ? Math.min(365, Math.floor(raw.joinAlertDays))
        : base.joinAlertDays,
    includeAttachments: raw.includeAttachments ?? base.includeAttachments,
    pingRoleId:
      typeof raw.pingRoleId === "string" && raw.pingRoleId
        ? raw.pingRoleId
        : raw.pingRoleId === null
          ? null
          : base.pingRoleId,
  };
}

async function getConfigValue(key: string): Promise<string | null> {
  try {
    const rows = await db
      .select()
      .from(botConfigTable)
      .where(eq(botConfigTable.key, key))
      .limit(1);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function setConfigValue(key: string, value: string): Promise<void> {
  await db
    .insert(botConfigTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: botConfigTable.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function getGuildLogSettings(
  guildId: string,
): Promise<GuildLogSettings> {
  try {
    const raw = await getConfigValue(SETTINGS_KEY(guildId));
    if (raw) {
      return sanitizeSettings(JSON.parse(raw) as Partial<GuildLogSettings>);
    }

    // Back-compat: migrate old keys
    const channelId = await getConfigValue(LOG_KEY(guildId));
    const eventsRaw = await getConfigValue(EVENTS_KEY(guildId));
    let events = defaultLogEvents();
    if (eventsRaw) {
      try {
        events = sanitizeEvents(JSON.parse(eventsRaw));
      } catch {
        /* keep default */
      }
    }
    const migrated = sanitizeSettings({
      channelId,
      events,
    });
    // Persist migration so future reads are fast
    await setGuildLogSettings(guildId, migrated);
    return migrated;
  } catch {
    return defaultGuildLogSettings();
  }
}

export async function setGuildLogSettings(
  guildId: string,
  settings: GuildLogSettings,
): Promise<GuildLogSettings> {
  const clean = sanitizeSettings(settings);
  await setConfigValue(SETTINGS_KEY(guildId), JSON.stringify(clean));
  // Keep legacy keys in sync for older code paths
  if (clean.channelId) {
    await setConfigValue(LOG_KEY(guildId), clean.channelId);
  } else {
    await db
      .delete(botConfigTable)
      .where(eq(botConfigTable.key, LOG_KEY(guildId)));
  }
  await setConfigValue(EVENTS_KEY(guildId), JSON.stringify(clean.events));
  return clean;
}

// ── Legacy helpers (used by /cfglogs and older call sites) ───────────────────

export async function getLogChannelId(guildId: string): Promise<string | null> {
  const s = await getGuildLogSettings(guildId);
  return s.channelId;
}

export async function setLogChannelId(
  guildId: string,
  channelId: string,
): Promise<void> {
  const s = await getGuildLogSettings(guildId);
  s.channelId = channelId;
  await setGuildLogSettings(guildId, s);
}

export async function removeLogChannel(guildId: string): Promise<void> {
  const s = await getGuildLogSettings(guildId);
  s.channelId = null;
  await setGuildLogSettings(guildId, s);
}

export async function getLogEvents(guildId: string): Promise<LogEventKey[]> {
  const s = await getGuildLogSettings(guildId);
  return s.events;
}

export async function setLogEvents(
  guildId: string,
  events: LogEventKey[],
): Promise<void> {
  const s = await getGuildLogSettings(guildId);
  s.events = sanitizeEvents(events);
  await setGuildLogSettings(guildId, s);
}

export async function isLogEventEnabled(
  guildId: string,
  event: LogEventKey,
): Promise<boolean> {
  const s = await getGuildLogSettings(guildId);
  return s.events.includes(event);
}

export interface SendModLogOptions {
  event?: LogEventKey;
  /** Author/user that triggered the log (for ignoreBots) */
  actorIsBot?: boolean;
  actorIsWebhook?: boolean;
  channelId?: string;
}

export async function sendModLog(
  client: Client,
  guildId: string,
  embed: EmbedBuilder,
  eventOrOpts?: LogEventKey | SendModLogOptions,
): Promise<void> {
  try {
    const opts: SendModLogOptions =
      typeof eventOrOpts === "string"
        ? { event: eventOrOpts }
        : (eventOrOpts ?? {});

    const settings = await getGuildLogSettings(guildId);
    if (!settings.channelId) return;

    if (opts.event && !settings.events.includes(opts.event)) return;
    if (settings.ignoreBots && opts.actorIsBot) return;
    if (settings.ignoreWebhooks && opts.actorIsWebhook) return;
    if (
      opts.channelId &&
      settings.ignoreChannels.includes(opts.channelId)
    ) {
      return;
    }

    const channel = client.channels.cache.get(settings.channelId) as
      | TextChannel
      | undefined;

    const resolved =
      channel ??
      ((await client.channels.fetch(settings.channelId).catch(() => null)) as
        | TextChannel
        | null);

    if (!resolved?.isTextBased()) return;

    const content = settings.pingRoleId
      ? `<@&${settings.pingRoleId}>`
      : undefined;

    await resolved.send({
      content,
      embeds: [embed],
      allowedMentions: settings.pingRoleId
        ? { roles: [settings.pingRoleId] }
        : { parse: [] },
    });
  } catch (err) {
    logger.error({ err }, "sendModLog: error enviando al canal de logs");
  }
}

/** Base embed style for server monitoring logs */
export function baseLogEmbed(
  client: Client,
  title: string,
  color: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: "Central de Logs // Zero Two",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle(title)
    .setTimestamp()
    .setFooter({
      text: "Sistema de Logs · Zero Two",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    });
}

export function userField(
  user: User | { id: string; tag?: string; username?: string },
) {
  const tag =
    "tag" in user && user.tag
      ? user.tag
      : "username" in user && user.username
        ? user.username
        : user.id;
  return `<@${user.id}> (\`${tag}\` · \`${user.id}\`)`;
}

export async function findAuditExecutor(
  guild: Guild,
  type: AuditLogEvent,
  targetId?: string,
  maxAgeMs = 8_000,
): Promise<{
  executor: User | null;
  reason: string | null;
  entry: GuildAuditLogsEntry | null;
}> {
  try {
    await new Promise((r) => setTimeout(r, 700));

    const logs = await guild.fetchAuditLogs({ type, limit: 6 });
    const now = Date.now();
    const entry =
      logs.entries.find((e) => {
        if (targetId && e.targetId !== targetId) return false;
        if (e.createdTimestamp && now - e.createdTimestamp > maxAgeMs)
          return false;
        return true;
      }) ?? null;

    return {
      executor: entry?.executor ?? null,
      reason: entry?.reason ?? null,
      entry,
    };
  } catch {
    return { executor: null, reason: null, entry: null };
  }
}

export function truncate(text: string, max = 900): string {
  if (!text) return "—";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}
