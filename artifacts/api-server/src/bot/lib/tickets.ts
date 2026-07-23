import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
  type TextChannel,
} from "discord.js";
import {
  db,
  botConfigTable,
  ticketsTable,
  guildTicketSettingsTable,
} from "@workspace/db";
import { and, eq, desc, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClosePolicy = "both" | "staff_only" | "owner_only";
export type ClaimPolicy = "staff_only" | "anyone";

export interface TicketCategory {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** Extra role IDs that can see this category's tickets (on top of staff). */
  staffRoleIds?: string[];
}

export const DEFAULT_CATEGORIES: TicketCategory[] = [
  { id: "soporte",   label: "Soporte",   emoji: "🛠️", description: "Ayuda general" },
  { id: "reporte",   label: "Reporte",   emoji: "🚨", description: "Reportar un usuario" },
  { id: "apelacion", label: "Apelación", emoji: "📋", description: "Apelar una sanción" },
  { id: "otro",      label: "Otro",      emoji: "💬", description: "Cualquier otra consulta" },
];

/** @deprecated use GuildTicketConfig.categories instead */
export const TICKET_CATEGORIES = DEFAULT_CATEGORIES;
export type TicketCategoryId = string;

export interface GuildTicketConfig {
  /** Discord category channel where ticket channels are created. */
  categoryId: string | null;
  /** Primary staff role ID (legacy compat — included in staffRoleIds). */
  staffRoleId: string | null;
  /** All staff role IDs. Anyone with one of these counts as staff. */
  staffRoleIds: string[];
  /** Channel for open/close logs + transcripts. */
  logChannelId: string | null;
  /** Max open tickets per user (1–5). */
  maxOpen: number;
  /** Delete channel N seconds after close (0 = keep). */
  deleteAfterCloseSec: number;
  /** Panel embed title. */
  panelTitle: string;
  /** Panel embed description. */
  panelDescription: string;
  /**
   * Who can close tickets.
   * "both"       — owner OR staff (default)
   * "staff_only" — only staff
   * "owner_only" — only the ticket owner
   */
  closePolicy: ClosePolicy;
  /**
   * Who can claim tickets.
   * "staff_only" — only staff (default)
   * "anyone"     — any member in the channel
   */
  claimPolicy: ClaimPolicy;
  /**
   * Template for ticket channel name.
   * Vars: {username} {userid4} {category} {number}
   */
  channelNameFormat: string;
  /** Welcome message inside the ticket. Vars: {user} {category} {subject} */
  welcomeMessage: string;
  /** Custom categories. Empty array = use DEFAULT_CATEGORIES. */
  categories: TicketCategory[];
}

export function defaultTicketConfig(): GuildTicketConfig {
  return {
    categoryId: null,
    staffRoleId: null,
    staffRoleIds: [],
    logChannelId: null,
    maxOpen: 1,
    deleteAfterCloseSec: 10,
    panelTitle: "🎫 Centro de Tickets",
    panelDescription:
      "¿Necesitas ayuda? Abre un ticket y el staff te atenderá en un canal privado.\n\n" +
      "Selecciona una categoría abajo para empezar.",
    closePolicy: "both",
    claimPolicy: "staff_only",
    channelNameFormat: "ticket-{username}-{userid4}",
    welcomeMessage: "",
    categories: [],
  };
}

/** Returns the effective category list (custom or default). */
export function resolveCategories(cfg: GuildTicketConfig): TicketCategory[] {
  return cfg.categories.length > 0 ? cfg.categories : DEFAULT_CATEGORIES;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

const CONFIG_KEY = (guildId: string) => `ticket_config:${guildId}`;

function safeJsonArray<T>(raw: string | null | undefined, fallback: T[]): T[] {
  if (!raw || raw.trim() === "[]" || raw.trim() === "") return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function rowToTicketConfig(
  row: typeof guildTicketSettingsTable.$inferSelect,
): GuildTicketConfig {
  const base = defaultTicketConfig();

  const staffRoleIds = safeJsonArray<string>(row.staffRoleIds, []);
  // Keep primary staffRoleId in sync with list
  const staffRoleId = row.staffRoleId ?? staffRoleIds[0] ?? null;
  // Ensure primary is always in the list
  const mergedRoleIds = staffRoleId && !staffRoleIds.includes(staffRoleId)
    ? [staffRoleId, ...staffRoleIds]
    : staffRoleIds;

  return {
    categoryId: row.categoryId ?? null,
    staffRoleId,
    staffRoleIds: mergedRoleIds,
    logChannelId: row.logChannelId ?? null,
    maxOpen: row.maxOpen ?? base.maxOpen,
    deleteAfterCloseSec: row.deleteAfterCloseSec ?? base.deleteAfterCloseSec,
    panelTitle: row.panelTitle || base.panelTitle,
    panelDescription: row.panelDescription || base.panelDescription,
    closePolicy: (row.closePolicy as ClosePolicy) || base.closePolicy,
    claimPolicy: (row.claimPolicy as ClaimPolicy) || base.claimPolicy,
    channelNameFormat: row.channelNameFormat || base.channelNameFormat,
    welcomeMessage: row.welcomeMessage || base.welcomeMessage,
    categories: safeJsonArray<TicketCategory>(row.customCategories, []),
  };
}

async function getLegacyConfigValue(key: string): Promise<string | null> {
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

export async function getTicketConfig(guildId: string): Promise<GuildTicketConfig> {
  try {
    const rows = await db
      .select()
      .from(guildTicketSettingsTable)
      .where(eq(guildTicketSettingsTable.guildId, guildId))
      .limit(1);
    if (rows[0]) return rowToTicketConfig(rows[0]);

    // Legacy fallback
    const raw = await getLegacyConfigValue(CONFIG_KEY(guildId));
    if (raw) {
      try {
        return { ...defaultTicketConfig(), ...(JSON.parse(raw) as Partial<GuildTicketConfig>) };
      } catch { /* fall through */ }
    }
    return defaultTicketConfig();
  } catch (err) {
    logger.warn({ err, guildId }, "getTicketConfig fallback");
    return defaultTicketConfig();
  }
}

export async function setTicketConfig(
  guildId: string,
  partial: Partial<GuildTicketConfig>,
): Promise<GuildTicketConfig> {
  const current = await getTicketConfig(guildId);
  const next: GuildTicketConfig = {
    ...current,
    ...partial,
    maxOpen: Math.min(5, Math.max(1, partial.maxOpen ?? current.maxOpen)),
    deleteAfterCloseSec: Math.min(300, Math.max(0, partial.deleteAfterCloseSec ?? current.deleteAfterCloseSec)),
  };

  // Keep primary staffRoleId in sync with list
  if (next.staffRoleIds.length > 0 && !next.staffRoleId) {
    next.staffRoleId = next.staffRoleIds[0] ?? null;
  }
  if (next.staffRoleId && !next.staffRoleIds.includes(next.staffRoleId)) {
    next.staffRoleIds = [next.staffRoleId, ...next.staffRoleIds];
  }

  const values = {
    guildId,
    categoryId: next.categoryId,
    staffRoleId: next.staffRoleId,
    staffRoleIds: JSON.stringify(next.staffRoleIds),
    logChannelId: next.logChannelId,
    maxOpen: next.maxOpen,
    deleteAfterCloseSec: next.deleteAfterCloseSec,
    panelTitle: next.panelTitle,
    panelDescription: next.panelDescription,
    closePolicy: next.closePolicy,
    claimPolicy: next.claimPolicy,
    channelNameFormat: next.channelNameFormat,
    welcomeMessage: next.welcomeMessage,
    customCategories: JSON.stringify(next.categories),
    updatedAt: new Date(),
  };

  await db
    .insert(guildTicketSettingsTable)
    .values(values)
    .onDuplicateKeyUpdate({ set: values });

  return next;
}

// ── Permission helpers ────────────────────────────────────────────────────────

export function isStaff(member: GuildMember, config: GuildTicketConfig): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  for (const roleId of config.staffRoleIds) {
    if (member.roles.cache.has(roleId)) return true;
  }
  return false;
}

/** Check if member can close a ticket given its owner ID. */
export function canCloseTicket(
  member: GuildMember,
  config: GuildTicketConfig,
  ticketOwnerId: string,
): boolean {
  const staff = isStaff(member, config);
  const owner = member.id === ticketOwnerId;
  switch (config.closePolicy) {
    case "staff_only":  return staff;
    case "owner_only":  return owner || member.permissions.has(PermissionFlagsBits.Administrator);
    case "both":
    default:            return staff || owner;
  }
}

/** Check if member can claim a ticket. */
export function canClaimTicket(member: GuildMember, config: GuildTicketConfig): boolean {
  if (config.claimPolicy === "anyone") return true;
  return isStaff(member, config);
}

// ── Channel name formatting ───────────────────────────────────────────────────

let _ticketCounter = 0;

export function formatChannelName(
  format: string,
  member: GuildMember,
  category: string,
): string {
  _ticketCounter++;
  const safe = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "user";

  return format
    .replace(/\{username\}/g, safe(member.user.username))
    .replace(/\{userid4\}/g, member.user.id.slice(-4))
    .replace(/\{category\}/g, safe(category))
    .replace(/\{number\}/g, String(_ticketCounter).padStart(4, "0"))
    .slice(0, 100);
}

// ── Ticket CRUD ───────────────────────────────────────────────────────────────

export async function countOpenTickets(guildId: string, userId: string): Promise<number> {
  const rows = await db
    .select()
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.guildId, guildId),
        eq(ticketsTable.userId, userId),
        inArray(ticketsTable.status, ["open", "claimed"]),
      ),
    );
  return rows.length;
}

export async function getTicketByChannel(channelId: string) {
  const rows = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.channelId, channelId))
    .orderBy(desc(ticketsTable.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createTicketRecord(data: {
  guildId: string;
  channelId: string;
  userId: string;
  username: string;
  category: string;
  subject?: string | null;
}) {
  const result = await db.insert(ticketsTable).values({
    guildId: data.guildId,
    channelId: data.channelId,
    userId: data.userId,
    username: data.username,
    category: data.category,
    subject: data.subject ?? null,
    status: "open",
  }).$returningId();

  const id = result[0]?.id;
  if (id == null) return null;
  const rows = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id)).limit(1);

  void import("./presence.js")
    .then(({ setOpenTicketCount }) => {
      void countOpenTicketsGlobal().then((n) => setOpenTicketCount(null, n));
    })
    .catch(() => null);

  return rows[0] ?? null;
}

export async function claimTicket(channelId: string, staffId: string, staffName: string) {
  await db
    .update(ticketsTable)
    .set({ claimedBy: staffId, claimedByName: staffName, status: "claimed" })
    .where(eq(ticketsTable.channelId, channelId));
}

export async function closeTicketRecord(
  channelId: string,
  closerId: string,
  closerName: string,
  reason?: string | null,
) {
  await db
    .update(ticketsTable)
    .set({
      status: "closed",
      closedBy: closerId,
      closedByName: closerName,
      closeReason: reason ?? null,
      closedAt: new Date(),
    })
    .where(eq(ticketsTable.channelId, channelId));

  void import("./presence.js")
    .then(({ setOpenTicketCount }) => {
      void countOpenTicketsGlobal().then((n) => setOpenTicketCount(null, n));
    })
    .catch(() => null);
}

// ── Channel creation ──────────────────────────────────────────────────────────

export async function createTicketChannel(
  guild: Guild,
  member: GuildMember,
  config: GuildTicketConfig,
  category: string,
  subject?: string | null,
): Promise<TextChannel> {
  if (!config.categoryId) throw new Error("NO_CATEGORY");

  const parent = guild.channels.cache.get(config.categoryId) as CategoryChannel | undefined;
  if (!parent || parent.type !== ChannelType.GuildCategory) throw new Error("INVALID_CATEGORY");

  const channelName = formatChannelName(config.channelNameFormat, member, category);

  // Find per-category extra roles
  const cats = resolveCategories(config);
  const catDef = cats.find((c) => c.id === category);
  const extraRoleIds = catDef?.staffRoleIds ?? [];

  const overwrites: OverwriteResolvable[] = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: guild.members.me!.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  const staffAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ManageMessages,
  ];

  for (const roleId of config.staffRoleIds) {
    overwrites.push({ id: roleId, allow: staffAllow });
  }
  for (const roleId of extraRoleIds) {
    if (!config.staffRoleIds.includes(roleId)) {
      overwrites.push({ id: roleId, allow: staffAllow });
    }
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic: `Ticket de ${member.user.tag} · ${category}${subject ? ` · ${subject}` : ""}`,
    permissionOverwrites: overwrites,
    reason: `Ticket abierto por ${member.user.tag}`,
  });

  await createTicketRecord({
    guildId: guild.id,
    channelId: channel.id,
    userId: member.id,
    username: member.user.username,
    category,
    subject,
  });

  return channel as TextChannel;
}

// ── Welcome message ───────────────────────────────────────────────────────────

export function buildWelcomeMessage(
  template: string,
  member: GuildMember,
  category: string,
  subject: string,
): string {
  if (!template.trim()) return "";
  return template
    .replace(/\{user\}/g, `${member}`)
    .replace(/\{category\}/g, category)
    .replace(/\{subject\}/g, subject || "—");
}

// ── Transcript ────────────────────────────────────────────────────────────────

export async function buildTranscript(channel: TextChannel, limit = 80): Promise<string> {
  try {
    const messages = await channel.messages.fetch({ limit });
    const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const lines = sorted.map((m) => {
      const time = m.createdAt.toISOString();
      const author = `${m.author.tag} (${m.author.id})`;
      const content = m.content || (m.attachments.size ? "[adjunto]" : "[embed]");
      const files = m.attachments.size > 0
        ? ` | files: ${[...m.attachments.values()].map((a) => a.url).join(" ")}`
        : "";
      return `[${time}] ${author}: ${content}${files}`;
    });
    return lines.join("\n") || "(sin mensajes)";
  } catch (err) {
    logger.warn({ err }, "tickets: transcript failed");
    return "(no se pudo generar el transcript)";
  }
}

// ── Global count ──────────────────────────────────────────────────────────────

export async function countOpenTicketsGlobal(): Promise<number> {
  try {
    const rows = await db
      .select({ status: ticketsTable.status })
      .from(ticketsTable)
      .where(inArray(ticketsTable.status, ["open", "claimed"]));
    return rows.length;
  } catch {
    return 0;
  }
}
