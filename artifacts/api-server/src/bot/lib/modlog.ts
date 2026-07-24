import {
  AuditLogEvent,
  Client,
  EmbedBuilder,
  Guild,
  TextChannel,
  type GuildAuditLogsEntry,
  type User,
} from "discord.js";
import { db, botConfigTable, guildLogSettingsTable } from "@workspace/db";
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
  "member_boost",
  // Servidor
  "channel_create",
  "channel_delete",
  "channel_update",
  "role_create",
  "role_delete",
  "role_update",
  "invite_create",
  "invite_delete",
  "thread_create",
  "thread_delete",
  "emoji_create",
  "emoji_delete",
  // Voz
  "voice_join",
  "voice_leave",
  "voice_move",
  "voice_server_mute",
  "voice_server_deaf",
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
  member_boost: {
    label: "Boost Nitro",
    category: "members",
    description: "Inicio o fin de boost del servidor",
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
  channel_update: {
    label: "Canal editado",
    category: "server",
    description: "Nombre, tema o tipo de canal",
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
  role_update: {
    label: "Rol editado",
    category: "server",
    description: "Nombre, color o permisos de un rol",
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
  thread_create: {
    label: "Hilo creado",
    category: "server",
    description: "Nuevo hilo público o privado",
  },
  thread_delete: {
    label: "Hilo eliminado",
    category: "server",
    description: "Hilo borrado",
  },
  emoji_create: {
    label: "Emoji creado",
    category: "server",
    description: "Emoji personalizado añadido",
  },
  emoji_delete: {
    label: "Emoji eliminado",
    category: "server",
    description: "Emoji personalizado borrado",
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
  voice_server_mute: {
    label: "Mute de servidor",
    category: "voice",
    description: "Mute/unmute forzado por staff",
  },
  voice_server_deaf: {
    label: "Sordo de servidor",
    category: "voice",
    description: "Deaf/undeaf forzado por staff",
  },
};

/** Colors used across embeds (category accent) */
export const LOG_COLORS: Record<LogEventKey, number> = {
  ban: 0xff2d6b,
  unban: 0x22c55e,
  kick: 0xef4444,
  timeout: 0xf97316,
  untimeout: 0x84cc16,
  message_delete: 0xf59e0b,
  message_edit: 0x3b82f6,
  message_bulk_delete: 0xdc2626,
  member_join: 0x00f5d4,
  member_leave: 0x94a3b8,
  member_roles: 0xa78bfa,
  member_nickname: 0x38bdf8,
  member_boost: 0xf472b6,
  channel_create: 0x2dd4bf,
  channel_delete: 0x0d9488,
  channel_update: 0x14b8a6,
  role_create: 0xc084fc,
  role_delete: 0xa855f7,
  role_update: 0xd8b4fe,
  invite_create: 0xfbbf24,
  invite_delete: 0xd97706,
  thread_create: 0x67e8f9,
  thread_delete: 0x06b6d4,
  emoji_create: 0xfde047,
  emoji_delete: 0xca8a04,
  voice_join: 0x22d3ee,
  voice_leave: 0x0891b2,
  voice_move: 0x67e8f9,
  voice_server_mute: 0xf43f5e,
  voice_server_deaf: 0xe11d48,
};

export const LOG_EMOJI: Record<LogEventKey, string> = {
  ban: "🔨",
  unban: "✅",
  kick: "👢",
  timeout: "⏳",
  untimeout: "🔓",
  message_delete: "🗑️",
  message_edit: "✏️",
  message_bulk_delete: "🧹",
  member_join: "📥",
  member_leave: "📤",
  member_roles: "🎭",
  member_nickname: "🏷️",
  member_boost: "💎",
  channel_create: "📁",
  channel_delete: "📂",
  channel_update: "📝",
  role_create: "✨",
  role_delete: "💢",
  role_update: "🎨",
  invite_create: "🔗",
  invite_delete: "⛓️‍💥",
  thread_create: "🧵",
  thread_delete: "✂️",
  emoji_create: "😀",
  emoji_delete: "😶",
  voice_join: "🎙️",
  voice_leave: "🔇",
  voice_move: "🔀",
  voice_server_mute: "🔇",
  voice_server_deaf: "🙉",
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
    events: [
      "member_join",
      "member_leave",
      "member_roles",
      "member_nickname",
      "member_boost",
    ],
  },
  {
    id: "server",
    label: "Servidor",
    events: [
      "channel_create",
      "channel_delete",
      "channel_update",
      "role_create",
      "role_delete",
      "role_update",
      "invite_create",
      "invite_delete",
      "thread_create",
      "thread_delete",
      "emoji_create",
      "emoji_delete",
    ],
  },
  {
    id: "voice",
    label: "Voz",
    events: [
      "voice_join",
      "voice_leave",
      "voice_move",
      "voice_server_mute",
      "voice_server_deaf",
    ],
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
    "untimeout",
    "message_delete",
    "message_edit",
    "message_bulk_delete",
    "member_join",
    "member_leave",
    "member_roles",
    "member_boost",
    "channel_create",
    "channel_delete",
    "role_create",
    "role_delete",
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

function rowToSettings(row: typeof guildLogSettingsTable.$inferSelect): GuildLogSettings {
  let events: unknown = defaultLogEvents();
  let ignoreChannels: unknown = [];
  try {
    events = JSON.parse(row.events);
  } catch {
    /* default */
  }
  try {
    ignoreChannels = JSON.parse(row.ignoreChannels);
  } catch {
    /* default */
  }
  return sanitizeSettings({
    channelId: row.channelId,
    events: events as LogEventKey[],
    ignoreBots: row.ignoreBots,
    ignoreWebhooks: row.ignoreWebhooks,
    ignoreChannels: ignoreChannels as string[],
    joinAlertDays: row.joinAlertDays,
    includeAttachments: row.includeAttachments,
    pingRoleId: row.pingRoleId,
  });
}

export async function getGuildLogSettings(
  guildId: string,
): Promise<GuildLogSettings> {
  try {
    // Primary: dedicated table (HeidiSQL-friendly columns)
    const rows = await db
      .select()
      .from(guildLogSettingsTable)
      .where(eq(guildLogSettingsTable.guildId, guildId))
      .limit(1);
    if (rows[0]) return rowToSettings(rows[0]);

    // Read-only legacy fallback from bot_config.
    // Do NOT write on GET — migrations on read caused hangs / 504 under pool pressure.
    const raw = await getConfigValue(SETTINGS_KEY(guildId));
    if (raw) {
      try {
        return sanitizeSettings(JSON.parse(raw) as Partial<GuildLogSettings>);
      } catch {
        /* fall through */
      }
    }

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
    return sanitizeSettings({ channelId, events });
  } catch (err) {
    logger.warn({ err, guildId }, "getGuildLogSettings fallback");
    return defaultGuildLogSettings();
  }
}

export async function setGuildLogSettings(
  guildId: string,
  settings: GuildLogSettings,
): Promise<GuildLogSettings> {
  const clean = sanitizeSettings(settings);
  await db
    .insert(guildLogSettingsTable)
    .values({
      guildId,
      channelId: clean.channelId,
      events: JSON.stringify(clean.events),
      ignoreBots: clean.ignoreBots,
      ignoreWebhooks: clean.ignoreWebhooks,
      ignoreChannels: JSON.stringify(clean.ignoreChannels),
      joinAlertDays: clean.joinAlertDays,
      includeAttachments: clean.includeAttachments,
      pingRoleId: clean.pingRoleId,
      updatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        channelId: clean.channelId,
        events: JSON.stringify(clean.events),
        ignoreBots: clean.ignoreBots,
        ignoreWebhooks: clean.ignoreWebhooks,
        ignoreChannels: JSON.stringify(clean.ignoreChannels),
        joinAlertDays: clean.joinAlertDays,
        includeAttachments: clean.includeAttachments,
        pingRoleId: clean.pingRoleId,
        updatedAt: new Date(),
      },
    });
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

const CATEGORY_LABEL: Record<LogEventCategory, string> = {
  moderation: "Moderación",
  messages: "Mensajes",
  members: "Miembros",
  server: "Servidor",
  voice: "Voz",
};

/**
 * Base embed style for server monitoring logs.
 * Prefer passing `event` for consistent colors/emojis.
 */
export function baseLogEmbed(
  client: Client,
  title: string,
  color: number,
  opts?: {
    description?: string;
    guildName?: string;
    event?: LogEventKey;
    guildIcon?: string | null;
  },
): EmbedBuilder {
  const event = opts?.event;
  const emoji = event ? LOG_EMOJI[event] : "📡";
  const cat = event ? LOG_EVENT_META[event].category : null;
  const resolvedColor = event ? LOG_COLORS[event] : color;
  const prettyTitle = title.match(/^[^\w\s]/)
    ? title
    : `${emoji} ${title}`;

  const emb = new EmbedBuilder()
    .setColor(resolvedColor)
    .setAuthor({
      name: cat
        ? `Zero Two Logs · ${CATEGORY_LABEL[cat]}`
        : "Zero Two · Central de Logs",
      iconURL: client.user?.displayAvatarURL({ size: 64 }) ?? undefined,
    })
    .setTitle(prettyTitle.slice(0, 256))
    .setTimestamp()
    .setFooter({
      text: [
        opts?.guildName ?? "Zero Two",
        event ? LOG_EVENT_META[event].label : "Logs",
        event ? `id:${event}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      iconURL:
        opts?.guildIcon ??
        client.user?.displayAvatarURL({ size: 32 }) ??
        undefined,
    });

  const bits: string[] = [];
  if (cat) {
    bits.push(`\`${CATEGORY_LABEL[cat]}\``);
  }
  if (opts?.description) bits.push(opts.description);
  if (bits.length) emb.setDescription(bits.join("\n"));

  return emb;
}

/** Pretty inline field for “antes → después” diffs */
export function diffField(before: string, after: string): string {
  const b = truncate(before || "—", 200);
  const a = truncate(after || "—", 200);
  return `**Antes:** ${b}\n**Después:** ${a}`;
}

/** Tiny separator field for visual structure */
export function spacerField() {
  return { name: "\u200b", value: "\u200b", inline: false } as const;
}

export function userField(
  user: User | { id: string; tag?: string; username?: string; bot?: boolean },
) {
  const tag =
    "tag" in user && user.tag
      ? user.tag
      : "username" in user && user.username
        ? user.username
        : user.id;
  const bot = "bot" in user && user.bot ? " · 🤖 bot" : "";
  return `<@${user.id}>\n\`${tag}\` · \`${user.id}\`${bot}`;
}

export function codeBlock(text: string, max = 900): string {
  const clean = (text || "").replace(/```/g, "'''").trim() || "—";
  const body = clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
  return `\`\`\`\n${body}\n\`\`\``;
}

export function quoteBlock(text: string, max = 900): string {
  const clean = (text || "").trim();
  if (!clean) return "*(vacío)*";
  const body = clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
  return body
    .split("\n")
    .map((l) => `> ${l || "\u200b"}`)
    .join("\n");
}

/** Track audit-log message-delete counts so rapid deletes map correctly */
const msgDeleteAuditUsed = new Map<string, { used: number; expires: number }>();

function pruneMsgDeleteTracker() {
  const now = Date.now();
  for (const [k, v] of msgDeleteAuditUsed) {
    if (v.expires < now) msgDeleteAuditUsed.delete(k);
  }
}

export type MessageDeleteActor = {
  /** mod | self | bot | unknown */
  kind: "mod" | "self" | "bot" | "unknown";
  executor: User | null;
  reason: string | null;
  label: string;
};

/**
 * Resolve who deleted a message.
 * Discord MessageDelete audit: target = author of deleted msg, extra.channel = channel.
 * Self-deletes usually produce NO audit entry.
 */
export async function findMessageDeleteActor(
  guild: Guild,
  opts: {
    authorId?: string | null;
    channelId: string;
    isBotAuthor?: boolean;
  },
): Promise<MessageDeleteActor> {
  pruneMsgDeleteTracker();
  try {
    // Audit logs lag a bit after the gateway event
    await new Promise((r) => setTimeout(r, 950));

    const logs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MessageDelete,
      limit: 10,
    });
    const now = Date.now();

    type Extra = { channel?: { id?: string }; count?: number };
    let best: GuildAuditLogsEntry | null = null;
    let bestScore = -1;

    for (const entry of logs.entries.values()) {
      if (now - entry.createdTimestamp > 15_000) continue;
      const extra = entry.extra as Extra | undefined;
      const channelId = extra?.channel?.id;
      if (channelId && channelId !== opts.channelId) continue;

      // targetId = author of the deleted message(s)
      if (
        opts.authorId &&
        entry.targetId &&
        entry.targetId !== opts.authorId
      ) {
        continue;
      }

      const total = Math.max(1, Number(extra?.count ?? 1));
      const key = `${guild.id}:${entry.id}`;
      const prev = msgDeleteAuditUsed.get(key);
      const used = prev && prev.expires > now ? prev.used : 0;
      if (used >= total) continue;

      // Prefer exact author match + channel + fresher entries
      let score = 10;
      if (opts.authorId && entry.targetId === opts.authorId) score += 50;
      if (channelId === opts.channelId) score += 30;
      score += Math.max(0, 15 - Math.floor((now - entry.createdTimestamp) / 1000));
      if (entry.executor) score += 5;

      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    if (best?.executor) {
      const extra = best.extra as Extra | undefined;
      const total = Math.max(1, Number(extra?.count ?? 1));
      const key = `${guild.id}:${best.id}`;
      const prev = msgDeleteAuditUsed.get(key);
      const used = prev && prev.expires > now ? prev.used : 0;
      msgDeleteAuditUsed.set(key, {
        used: used + 1,
        expires: now + 30_000,
      });

      const ex = best.executor;
      // Same person as author → self (or bot self)
      if (opts.authorId && ex.id === opts.authorId) {
        return {
          kind: opts.isBotAuthor ? "bot" : "self",
          executor: ex,
          reason: best.reason,
          label: opts.isBotAuthor
            ? "🤖 El bot autor borró su propio mensaje"
            : "↩️ El autor borró su propio mensaje",
        };
      }

      return {
        kind: ex.bot ? "bot" : "mod",
        executor: ex,
        reason: best.reason,
        label: ex.bot
          ? "🤖 Borrado por un bot (moderación / automod)"
          : "🛡️ Borrado por un moderador",
      };
    }

    // No matching audit → almost always self-delete
    if (opts.authorId) {
      return {
        kind: opts.isBotAuthor ? "bot" : "self",
        executor: null,
        reason: null,
        label: opts.isBotAuthor
          ? "🤖 Posible auto-borrado del bot (sin audit log)"
          : "↩️ Probablemente el autor (Discord no genera audit al auto-borrar)",
      };
    }

    return {
      kind: "unknown",
      executor: null,
      reason: null,
      label: "❓ No se pudo determinar (mensaje no estaba en caché)",
    };
  } catch {
    return {
      kind: "unknown",
      executor: null,
      reason: null,
      label: "❓ Sin permiso View Audit Log o error al leer audit",
    };
  }
}

export async function findBulkDeleteActor(
  guild: Guild,
  channelId: string,
  count: number,
): Promise<MessageDeleteActor> {
  try {
    await new Promise((r) => setTimeout(r, 900));
    const logs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MessageBulkDelete,
      limit: 6,
    });
    const now = Date.now();
    const entry =
      [...logs.entries.values()].find((e) => {
        if (now - e.createdTimestamp > 12_000) return false;
        const extra = e.extra as { channel?: { id?: string }; count?: number };
        if (extra?.channel?.id && extra.channel.id !== channelId) return false;
        // count may match bulk size
        if (
          typeof extra?.count === "number" &&
          Math.abs(extra.count - count) > 2
        ) {
          return false;
        }
        return Boolean(e.executor);
      }) ?? null;

    if (entry?.executor) {
      return {
        kind: entry.executor.bot ? "bot" : "mod",
        executor: entry.executor,
        reason: entry.reason,
        label: entry.executor.bot
          ? "🤖 Borrado masivo por un bot"
          : "🛡️ Borrado masivo por un moderador",
      };
    }
    return {
      kind: "unknown",
      executor: null,
      reason: null,
      label: "❓ Autor del purge desconocido",
    };
  } catch {
    return {
      kind: "unknown",
      executor: null,
      reason: null,
      label: "❓ Sin acceso a audit log",
    };
  }
}

export async function findAuditExecutor(
  guild: Guild,
  type: AuditLogEvent,
  targetId?: string,
  maxAgeMs = 10_000,
): Promise<{
  executor: User | null;
  reason: string | null;
  entry: GuildAuditLogsEntry | null;
}> {
  try {
    await new Promise((r) => setTimeout(r, 750));

    const logs = await guild.fetchAuditLogs({ type, limit: 8 });
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

export function messageJumpLink(
  guildId: string,
  channelId: string,
  messageId: string,
): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}
