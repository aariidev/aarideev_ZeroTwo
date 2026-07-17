import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type GuildMember,
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

const CONFIG_KEY = (guildId: string) => `ticket_config:${guildId}`;

export const TICKET_CATEGORIES = [
  { id: "soporte", label: "🛠️ Soporte", description: "Ayuda general" },
  { id: "reporte", label: "🚨 Reporte", description: "Reportar un usuario" },
  { id: "apelacion", label: "📋 Apelación", description: "Apelar una sanción" },
  { id: "otro", label: "💬 Otro", description: "Cualquier otra consulta" },
] as const;

export type TicketCategoryId = (typeof TICKET_CATEGORIES)[number]["id"];

export interface GuildTicketConfig {
  /** Category where ticket channels are created */
  categoryId: string | null;
  /** Staff role that can see all tickets */
  staffRoleId: string | null;
  /** Optional channel for open/close logs + transcripts */
  logChannelId: string | null;
  /** Max open tickets per user (1–5) */
  maxOpen: number;
  /** Delete channel N seconds after close (0 = keep) */
  deleteAfterCloseSec: number;
  panelTitle: string;
  panelDescription: string;
}

export function defaultTicketConfig(): GuildTicketConfig {
  return {
    categoryId: null,
    staffRoleId: null,
    logChannelId: null,
    maxOpen: 1,
    deleteAfterCloseSec: 10,
    panelTitle: "🎫 Centro de Tickets",
    panelDescription:
      "¿Necesitas ayuda? Abre un ticket y el staff te atenderá en un canal privado.\n\n" +
      "Selecciona una categoría abajo para empezar.",
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

function rowToTicketConfig(
  row: typeof guildTicketSettingsTable.$inferSelect,
): GuildTicketConfig {
  const base = defaultTicketConfig();
  return {
    categoryId: row.categoryId ?? null,
    staffRoleId: row.staffRoleId ?? null,
    logChannelId: row.logChannelId ?? null,
    maxOpen: row.maxOpen ?? base.maxOpen,
    deleteAfterCloseSec: row.deleteAfterCloseSec ?? base.deleteAfterCloseSec,
    panelTitle: row.panelTitle || base.panelTitle,
    panelDescription: row.panelDescription || base.panelDescription,
  };
}

export async function getTicketConfig(
  guildId: string,
): Promise<GuildTicketConfig> {
  try {
    const rows = await db
      .select()
      .from(guildTicketSettingsTable)
      .where(eq(guildTicketSettingsTable.guildId, guildId))
      .limit(1);
    if (rows[0]) return rowToTicketConfig(rows[0]);

    // Read-only legacy fallback — no write on GET (avoids hangs / 504)
    const raw = await getLegacyConfigValue(CONFIG_KEY(guildId));
    if (raw) {
      try {
        return {
          ...defaultTicketConfig(),
          ...(JSON.parse(raw) as Partial<GuildTicketConfig>),
        };
      } catch {
        /* fall through */
      }
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
    deleteAfterCloseSec: Math.min(
      300,
      Math.max(0, partial.deleteAfterCloseSec ?? current.deleteAfterCloseSec),
    ),
  };

  await db
    .insert(guildTicketSettingsTable)
    .values({
      guildId,
      categoryId: next.categoryId,
      staffRoleId: next.staffRoleId,
      logChannelId: next.logChannelId,
      maxOpen: next.maxOpen,
      deleteAfterCloseSec: next.deleteAfterCloseSec,
      panelTitle: next.panelTitle,
      panelDescription: next.panelDescription,
      updatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        categoryId: next.categoryId,
        staffRoleId: next.staffRoleId,
        logChannelId: next.logChannelId,
        maxOpen: next.maxOpen,
        deleteAfterCloseSec: next.deleteAfterCloseSec,
        panelTitle: next.panelTitle,
        panelDescription: next.panelDescription,
        updatedAt: new Date(),
      },
    });

  return next;
}

export async function countOpenTickets(
  guildId: string,
  userId: string,
): Promise<number> {
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
  const result = await db
    .insert(ticketsTable)
    .values({
      guildId: data.guildId,
      channelId: data.channelId,
      userId: data.userId,
      username: data.username,
      category: data.category,
      subject: data.subject ?? null,
      status: "open",
    })
    .$returningId();
  const id = result[0]?.id;
  if (id == null) return null;
  const rows = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function claimTicket(
  channelId: string,
  staffId: string,
  staffName: string,
) {
  await db
    .update(ticketsTable)
    .set({
      claimedBy: staffId,
      claimedByName: staffName,
      status: "claimed",
    })
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
}

export function isStaff(
  member: GuildMember,
  config: GuildTicketConfig,
): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (config.staffRoleId && member.roles.cache.has(config.staffRoleId))
    return true;
  return false;
}

export async function createTicketChannel(
  guild: Guild,
  member: GuildMember,
  config: GuildTicketConfig,
  category: string,
  subject?: string | null,
): Promise<TextChannel> {
  if (!config.categoryId) {
    throw new Error("NO_CATEGORY");
  }

  const parent = guild.channels.cache.get(config.categoryId) as
    | CategoryChannel
    | undefined;
  if (!parent || parent.type !== ChannelType.GuildCategory) {
    throw new Error("INVALID_CATEGORY");
  }

  const safeName = member.user.username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
  const suffix = member.user.id.slice(-4);
  const channelName = `ticket-${safeName || "user"}-${suffix}`.slice(0, 100);

  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
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

  if (config.staffRoleId) {
    overwrites.push({
      id: config.staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages,
      ],
    });
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

export async function buildTranscript(
  channel: TextChannel,
  limit = 80,
): Promise<string> {
  try {
    const messages = await channel.messages.fetch({ limit });
    const sorted = [...messages.values()].sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp,
    );
    const lines = sorted.map((m) => {
      const time = m.createdAt.toISOString();
      const author = `${m.author.tag} (${m.author.id})`;
      const content = m.content || (m.attachments.size ? "[adjunto]" : "[embed]");
      const files =
        m.attachments.size > 0
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
