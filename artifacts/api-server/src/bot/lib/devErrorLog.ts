import {
  AttachmentBuilder,
  Client,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type Interaction,
  type TextChannel,
} from "discord.js";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { logBotEvent } from "../../lib/botLogger.js";

const PINK = 0xff2d6b;
const DEV_LOG_KEY = "dev_log_channel_id";

function ownerIds(): string[] {
  return (process.env.OWNER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Channel for developer error reports.
 * Prefer app_settings table (HeidiSQL); fall back to DEV_LOG_CHANNEL_ID env.
 */
export async function getDevLogChannelId(): Promise<string | null> {
  try {
    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, DEV_LOG_KEY))
      .limit(1);
    if (rows[0]?.value?.trim()) return rows[0].value.trim();
  } catch {
    /* table may not exist yet */
  }
  const id = process.env.DEV_LOG_CHANNEL_ID?.trim();
  return id || null;
}

export async function setDevLogChannelId(channelId: string | null): Promise<void> {
  if (!channelId) {
    await db
      .delete(appSettingsTable)
      .where(eq(appSettingsTable.key, DEV_LOG_KEY));
    return;
  }
  await db
    .insert(appSettingsTable)
    .values({ key: DEV_LOG_KEY, value: channelId, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { value: channelId, updatedAt: new Date() },
    });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function errName(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) {
    return String((err as { name: string }).name);
  }
  return "Error";
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function errStack(err: unknown): string {
  if (err instanceof Error && err.stack) return err.stack;
  return errMessage(err);
}

/**
 * Build a rich "ERROR DEL BOT" embed (dev-facing) like the Lux-style report.
 */
export function buildDevErrorEmbed(
  client: Client,
  err: unknown,
  opts: {
    context: string;
    guildName?: string | null;
    guildId?: string | null;
    userTag?: string | null;
    userId?: string | null;
  },
): { embed: EmbedBuilder; files: AttachmentBuilder[] } {
  const stack = errStack(err);
  const files: AttachmentBuilder[] = [];

  const embed = new EmbedBuilder()
    .setColor(PINK)
    .setTitle("💥 ERROR DEL BOT")
    .setDescription("Se ha detectado un error en el sistema")
    .addFields(
      {
        name: "📌 Contexto",
        value: `\`\`\`\n${truncate(opts.context, 900)}\n\`\`\``,
      },
      {
        name: "⚠️ Error",
        value: `\`\`\`\n${truncate(errMessage(err), 900)}\n\`\`\``,
      },
    )
    .setTimestamp()
    .setFooter({
      text: `${client.user?.username ?? "Zero Two"} · Dev Error Log`,
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    });

  // Traceback: field if short, else attachment
  if (stack.length <= 900) {
    embed.addFields({
      name: "📄 Traceback",
      value: `\`\`\`js\n${stack}\n\`\`\``,
    });
  } else {
    files.push(
      new AttachmentBuilder(Buffer.from(stack, "utf8"), {
        name: `traceback-${Date.now()}.txt`,
      }),
    );
    embed.addFields({
      name: "📄 Traceback",
      value: "Adjunto como archivo (demasiado largo para el embed).",
    });
  }

  embed.addFields(
    {
      name: "🏠 Servidor",
      value: opts.guildId
        ? `${opts.guildName ?? "—"}\n\`${opts.guildId}\``
        : "DM / sin guild",
      inline: true,
    },
    {
      name: "🔧 Tipo de Error",
      value: `\`${errName(err)}\``,
      inline: true,
    },
  );

  if (opts.userId) {
    embed.addFields({
      name: "👤 Usuario",
      value: `${opts.userTag ?? "—"}\n\`${opts.userId}\``,
      inline: true,
    });
  }

  return { embed, files };
}

/**
 * Send error report to DEV_LOG_CHANNEL_ID if configured.
 * Always persists to bot_logs as error.
 */
export async function reportDevError(
  client: Client,
  err: unknown,
  opts: {
    context: string;
    guildName?: string | null;
    guildId?: string | null;
    userTag?: string | null;
    userId?: string | null;
  },
): Promise<void> {
  logBotEvent({
    level: "error",
    event: "system_error",
    details: {
      context: opts.context,
      error: errMessage(err),
      name: errName(err),
      stack: truncate(errStack(err), 2000),
    },
    guildId: opts.guildId,
    guildName: opts.guildName,
    userId: opts.userId,
    username: opts.userTag,
  });

  const channelId = await getDevLogChannelId();
  if (!channelId) return;

  try {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch || !ch.isTextBased()) {
      logger.warn({ channelId }, "DEV_LOG_CHANNEL_ID no es un canal de texto");
      return;
    }

    const { embed, files } = buildDevErrorEmbed(client, err, opts);
    await (ch as TextChannel).send({
      embeds: [embed],
      files: files.length ? files : undefined,
      // ping owners optionally
      content:
        ownerIds().length > 0
          ? ownerIds()
              .slice(0, 3)
              .map((id) => `<@${id}>`)
              .join(" ")
          : undefined,
      allowedMentions: { users: ownerIds().slice(0, 3) },
    });
  } catch (sendErr) {
    logger.error({ sendErr }, "No se pudo enviar dev error log al canal");
  }
}

export function contextFromInteraction(interaction: Interaction): {
  context: string;
  guildName: string | null;
  guildId: string | null;
  userTag: string;
  userId: string;
} {
  let context = "Interaction";
  if (interaction.isChatInputCommand()) {
    const i = interaction as ChatInputCommandInteraction;
    const sub = i.options.getSubcommand(false);
    context = sub
      ? `Slash Command: /${i.commandName} ${sub}`
      : `Slash Command: /${i.commandName}`;
  } else if (interaction.isButton()) {
    context = `Button: ${interaction.customId}`;
  } else if (interaction.isStringSelectMenu()) {
    context = `Select: ${interaction.customId}`;
  } else if (interaction.isModalSubmit()) {
    context = `Modal: ${interaction.customId}`;
  }

  return {
    context,
    guildName: interaction.guild?.name ?? null,
    guildId: interaction.guild?.id ?? null,
    userTag: interaction.user.tag,
    userId: interaction.user.id,
  };
}
