/**
 * Welcome / leave messages + optional autoroles.
 */
import {
  EmbedBuilder,
  type Client,
  type Guild,
  type GuildMember,
  type PartialGuildMember,
  type TextChannel,
  type User,
} from "discord.js";
import {
  db,
  guildWelcomeSettingsTable,
  type GuildWelcomeSettings,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { BOT_VERSION } from "./version.js";

const PINK = 0xff2d6b;
const SLATE = 0x94a3b8;

export const DEFAULT_WELCOME_MESSAGE =
  "Bienvenido/a {user} a **{server}** 🌸\nEres el miembro **#{memberCount}**. Cuenta creada {accountAge}.";

export const DEFAULT_LEAVE_MESSAGE =
  "**{username}** abandonó **{server}**. Ahora somos **{memberCount}**.";

export type WelcomeTemplateVars = {
  user: string; // mention
  username: string;
  server: string;
  memberCount: string;
  accountAge: string; // discord relative timestamp or text
  userId: string;
};

/** Pure — replace {placeholders} in templates (testeable). */
export function renderWelcomeTemplate(
  template: string,
  vars: WelcomeTemplateVars,
): string {
  const base = (template?.trim() ? template : DEFAULT_WELCOME_MESSAGE).trim();
  return base
    .replaceAll("{user}", vars.user)
    .replaceAll("{username}", vars.username)
    .replaceAll("{server}", vars.server)
    .replaceAll("{memberCount}", vars.memberCount)
    .replaceAll("{accountAge}", vars.accountAge)
    .replaceAll("{userid}", vars.userId)
    .replaceAll("{userId}", vars.userId)
    .slice(0, 4000);
}

/** Ensure embed description is never empty (Discord rejects ""). */
export function safeEmbedText(
  text: string | null | undefined,
  fallback = "—",
): string {
  const t = (text ?? "").trim();
  return t.length > 0 ? t.slice(0, 4096) : fallback;
}

export function buildWelcomeVars(
  member: { user: User; guild: Guild },
): WelcomeTemplateVars {
  const created = Math.floor(member.user.createdTimestamp / 1000);
  return {
    user: `<@${member.user.id}>`,
    username: member.user.username,
    server: member.guild.name,
    memberCount: String(member.guild.memberCount),
    accountAge: `<t:${created}:R>`,
    userId: member.user.id,
  };
}

export async function getWelcomeSettings(
  guildId: string,
): Promise<GuildWelcomeSettings> {
  const rows = await db
    .select()
    .from(guildWelcomeSettingsTable)
    .where(eq(guildWelcomeSettingsTable.guildId, guildId))
    .limit(1);
  if (rows[0]) return normalizeWelcomeRow(rows[0]);
  await db
    .insert(guildWelcomeSettingsTable)
    .values({
      guildId,
      welcomeMessage: DEFAULT_WELCOME_MESSAGE,
      leaveMessage: DEFAULT_LEAVE_MESSAGE,
    })
    .catch(() => null);
  const again = await db
    .select()
    .from(guildWelcomeSettingsTable)
    .where(eq(guildWelcomeSettingsTable.guildId, guildId))
    .limit(1);
  return normalizeWelcomeRow(
    again[0] ?? {
      guildId,
      enabled: true,
      channelId: null,
      leaveChannelId: null,
      welcomeMessage: DEFAULT_WELCOME_MESSAGE,
      leaveMessage: DEFAULT_LEAVE_MESSAGE,
      welcomeEmbed: true,
      leaveEmbed: true,
      autoroleIds: "[]",
      updatedAt: new Date(),
    },
  );
}

/** Fill empty message columns from older inserts without defaults. */
function normalizeWelcomeRow(
  row: GuildWelcomeSettings,
): GuildWelcomeSettings {
  return {
    ...row,
    welcomeMessage: row.welcomeMessage?.trim()
      ? row.welcomeMessage
      : DEFAULT_WELCOME_MESSAGE,
    leaveMessage: row.leaveMessage?.trim()
      ? row.leaveMessage
      : DEFAULT_LEAVE_MESSAGE,
  };
}

export async function updateWelcomeSettings(
  guildId: string,
  patch: Partial<{
    enabled: boolean;
    channelId: string | null;
    leaveChannelId: string | null;
    welcomeMessage: string;
    leaveMessage: string;
    welcomeEmbed: boolean;
    leaveEmbed: boolean;
    autoroleIds: string[];
  }>,
): Promise<GuildWelcomeSettings> {
  await getWelcomeSettings(guildId);
  const cur = await getWelcomeSettings(guildId);
  const nextWelcome =
    patch.welcomeMessage !== undefined
      ? patch.welcomeMessage.trim() || DEFAULT_WELCOME_MESSAGE
      : cur.welcomeMessage;
  const nextLeave =
    patch.leaveMessage !== undefined
      ? patch.leaveMessage.trim() || DEFAULT_LEAVE_MESSAGE
      : cur.leaveMessage;

  await db
    .update(guildWelcomeSettingsTable)
    .set({
      enabled: patch.enabled ?? cur.enabled,
      channelId:
        patch.channelId !== undefined ? patch.channelId : cur.channelId,
      leaveChannelId:
        patch.leaveChannelId !== undefined
          ? patch.leaveChannelId
          : cur.leaveChannelId,
      welcomeMessage: nextWelcome,
      leaveMessage: nextLeave,
      welcomeEmbed: patch.welcomeEmbed ?? cur.welcomeEmbed,
      leaveEmbed: patch.leaveEmbed ?? cur.leaveEmbed,
      autoroleIds:
        patch.autoroleIds !== undefined
          ? JSON.stringify(patch.autoroleIds)
          : cur.autoroleIds,
    })
    .where(eq(guildWelcomeSettingsTable.guildId, guildId));
  return getWelcomeSettings(guildId);
}

function parseRoleIds(raw: string): string[] {
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter((x): x is string => typeof x === "string" && /^\d+$/.test(x));
  } catch {
    return [];
  }
}

async function sendChannelMessage(
  client: Client,
  channelId: string,
  payload: { content?: string; embeds?: EmbedBuilder[] },
): Promise<void> {
  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (!ch?.isTextBased() || ch.isDMBased()) return;
  await (ch as TextChannel).send({
    content: payload.content,
    embeds: payload.embeds,
    allowedMentions: { parse: ["users"] },
  });
}

export async function handleWelcomeJoin(
  client: Client,
  member: GuildMember,
): Promise<void> {
  if (member.user.bot) return;
  const settings = await getWelcomeSettings(member.guild.id);
  if (!settings.enabled) return;

  // Autoroles
  const roles = parseRoleIds(settings.autoroleIds);
  if (roles.length) {
    const me = member.guild.members.me;
    const toAdd = roles.filter((id) => {
      const role = member.guild.roles.cache.get(id);
      if (!role || !me) return false;
      return me.roles.highest.position > role.position && !role.managed;
    });
    if (toAdd.length) {
      await member.roles
        .add(toAdd, "Zero Two welcome autorole")
        .catch((err) =>
          logger.warn({ err, guildId: member.guild.id }, "welcome:autorole"),
        );
    }
  }

  if (!settings.channelId) return;
  const vars = buildWelcomeVars(member);
  const text = renderWelcomeTemplate(settings.welcomeMessage, vars);

  if (settings.welcomeEmbed) {
    const emb = new EmbedBuilder()
      .setColor(PINK)
      .setAuthor({
        name: `Bienvenida · ${member.guild.name}`,
        iconURL: member.guild.iconURL({ size: 64 }) ?? undefined,
      })
      .setTitle(`🌸 ¡Hola, ${member.user.username}!`)
      .setDescription(safeEmbedText(text, DEFAULT_WELCOME_MESSAGE))
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: "📅 Cuenta",
          value: safeEmbedText(vars.accountAge, "—"),
          inline: true,
        },
        {
          name: "👥 Miembros",
          value: `\`${vars.memberCount}\``,
          inline: true,
        },
      )
      .setFooter({ text: `Zero Two ${BOT_VERSION}` })
      .setTimestamp();
    await sendChannelMessage(client, settings.channelId, { embeds: [emb] });
  } else {
    await sendChannelMessage(client, settings.channelId, {
      content: safeEmbedText(text, DEFAULT_WELCOME_MESSAGE),
    });
  }
}

export async function handleWelcomeLeave(
  client: Client,
  member: GuildMember | PartialGuildMember,
): Promise<void> {
  const user = member.user;
  if (!user || user.bot) return;
  const guild = member.guild;
  const settings = await getWelcomeSettings(guild.id);
  if (!settings.enabled) return;

  const channelId = settings.leaveChannelId || settings.channelId;
  if (!channelId) return;

  const vars: WelcomeTemplateVars = {
    user: `<@${user.id}>`,
    username: user.username ?? user.id,
    server: guild.name,
    memberCount: String(guild.memberCount),
    accountAge: user.createdTimestamp
      ? `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`
      : "—",
    userId: user.id,
  };
  const text = renderWelcomeTemplate(settings.leaveMessage, vars);

  if (settings.leaveEmbed) {
    const emb = new EmbedBuilder()
      .setColor(SLATE)
      .setAuthor({
        name: `Despedida · ${guild.name}`,
        iconURL: guild.iconURL({ size: 64 }) ?? undefined,
      })
      .setTitle("👋 Hasta luego")
      .setDescription(safeEmbedText(text, DEFAULT_LEAVE_MESSAGE))
      .setThumbnail(user.displayAvatarURL?.({ size: 256 }) ?? null)
      .setFooter({ text: `Zero Two ${BOT_VERSION}` })
      .setTimestamp();
    await sendChannelMessage(client, channelId, { embeds: [emb] });
  } else {
    await sendChannelMessage(client, channelId, {
      content: safeEmbedText(text, DEFAULT_LEAVE_MESSAGE),
    });
  }
}

export function registerWelcome(client: Client): void {
  client.on("guildMemberAdd", (member) => {
    void handleWelcomeJoin(client, member).catch((err) =>
      logger.warn({ err }, "welcome:join"),
    );
  });
  client.on("guildMemberRemove", (member) => {
    void handleWelcomeLeave(client, member).catch((err) =>
      logger.warn({ err }, "welcome:leave"),
    );
  });
  logger.info("🌸 Welcome / leave listeners activos");
}
