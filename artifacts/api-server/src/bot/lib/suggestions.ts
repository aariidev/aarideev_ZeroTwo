/**
 * Sistema de sugerencias por guild.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type TextChannel,
} from "discord.js";
import {
  db,
  guildSuggestionSettingsTable,
  suggestionsTable,
  type GuildSuggestionSettings,
  type Suggestion,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { BOT_VERSION } from "./version.js";

const PINK = 0xff2d6b;
const GREEN = 0x22c55e;
const AMBER = 0xf59e0b;
const GRAY = 0x64748b;

export type SuggestionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "implemented";

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  pending: "⏳ Pendiente",
  approved: "✅ Aprobada",
  rejected: "❌ Rechazada",
  implemented: "🚀 Implementada",
};

const STATUS_COLOR: Record<SuggestionStatus, number> = {
  pending: PINK,
  approved: GREEN,
  rejected: GRAY,
  implemented: 0x22d3ee,
};

export async function getSuggestionSettings(
  guildId: string,
): Promise<GuildSuggestionSettings | null> {
  const rows = await db
    .select()
    .from(guildSuggestionSettingsTable)
    .where(eq(guildSuggestionSettingsTable.guildId, guildId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertSuggestionSettings(
  guildId: string,
  patch: Partial<{
    channelId: string | null;
    logChannelId: string | null;
    enabled: boolean;
  }>,
): Promise<GuildSuggestionSettings> {
  const existing = await getSuggestionSettings(guildId);
  if (!existing) {
    await db.insert(guildSuggestionSettingsTable).values({
      guildId,
      channelId: patch.channelId ?? null,
      logChannelId: patch.logChannelId ?? null,
      enabled: patch.enabled ?? true,
    });
  } else {
    await db
      .update(guildSuggestionSettingsTable)
      .set({
        channelId:
          patch.channelId !== undefined ? patch.channelId : existing.channelId,
        logChannelId:
          patch.logChannelId !== undefined
            ? patch.logChannelId
            : existing.logChannelId,
        enabled:
          patch.enabled !== undefined ? patch.enabled : existing.enabled,
      })
      .where(eq(guildSuggestionSettingsTable.guildId, guildId));
  }
  return (await getSuggestionSettings(guildId))!;
}

export function suggestionButtons(id: number, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`sug:approve:${id}`)
      .setLabel("Aprobar")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`sug:reject:${id}`)
      .setLabel("Rechazar")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`sug:done:${id}`)
      .setLabel("Implementada")
      .setEmoji("🚀")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

export function buildSuggestionEmbed(
  s: Pick<
    Suggestion,
    "id" | "username" | "userId" | "content" | "status" | "reviewedBy" | "reviewNote"
  >,
  client: Client,
): EmbedBuilder {
  const status = (s.status as SuggestionStatus) || "pending";
  const emb = new EmbedBuilder()
    .setColor(STATUS_COLOR[status] ?? PINK)
    .setAuthor({
      name: "Zero Two · Sugerencias",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle(`💡 Sugerencia #${s.id}`)
    .setDescription(s.content.slice(0, 4000))
    .addFields(
      {
        name: "Autor",
        value: `<@${s.userId}> (\`${s.username}\`)`,
        inline: true,
      },
      {
        name: "Estado",
        value: STATUS_LABEL[status] ?? status,
        inline: true,
      },
    )
    .setFooter({ text: `Zero Two ${BOT_VERSION} · #${s.id}` })
    .setTimestamp();

  if (s.reviewedBy) {
    emb.addFields({
      name: "Revisado por",
      value: `<@${s.reviewedBy}>${s.reviewNote ? `\n_${s.reviewNote}_` : ""}`,
      inline: false,
    });
  }
  return emb;
}

export async function createSuggestion(input: {
  guildId: string;
  userId: string;
  username: string;
  content: string;
  client: Client;
}): Promise<{ ok: true; suggestion: Suggestion } | { ok: false; reason: string }> {
  const settings = await getSuggestionSettings(input.guildId);
  if (!settings?.enabled) {
    return { ok: false, reason: "El sistema de sugerencias está desactivado." };
  }
  if (!settings.channelId) {
    return {
      ok: false,
      reason: "No hay canal configurado. Un admin debe usar `/sugerencias set`.",
    };
  }

  const content = input.content.trim().slice(0, 1500);
  if (content.length < 8) {
    return { ok: false, reason: "La sugerencia es demasiado corta (mín. 8 caracteres)." };
  }

  const ids = await db
    .insert(suggestionsTable)
    .values({
      guildId: input.guildId,
      userId: input.userId,
      username: input.username.slice(0, 100),
      content,
      status: "pending",
    })
    .$returningId();

  const insertId = ids[0]?.id;
  if (insertId == null) {
    return { ok: false, reason: "No se pudo crear la sugerencia en BD." };
  }

  const rows = await db
    .select()
    .from(suggestionsTable)
    .where(eq(suggestionsTable.id, insertId))
    .limit(1);
  const suggestion = rows[0]!;

  try {
    const ch = await input.client.channels.fetch(settings.channelId);
    if (!ch || !ch.isTextBased() || ch.isDMBased()) {
      return { ok: false, reason: "Canal de sugerencias inválido." };
    }
    const textCh = ch as TextChannel;
    const msg = await textCh.send({
      embeds: [buildSuggestionEmbed(suggestion, input.client)],
      components: [suggestionButtons(suggestion.id)],
    });
    try {
      await msg.react("👍");
      await msg.react("👎");
    } catch {
      /* optional */
    }

    await db
      .update(suggestionsTable)
      .set({ messageId: msg.id, channelId: textCh.id })
      .where(eq(suggestionsTable.id, suggestion.id));

    suggestion.messageId = msg.id;
    suggestion.channelId = textCh.id;
  } catch (err) {
    logger.warn({ err, guildId: input.guildId }, "suggestions: post failed");
    return {
      ok: false,
      reason: "No pude publicar en el canal (¿permisos?).",
    };
  }

  return { ok: true, suggestion };
}

export async function reviewSuggestion(input: {
  id: number;
  guildId: string;
  status: SuggestionStatus;
  reviewerId: string;
  note?: string;
  client: Client;
}): Promise<{ ok: true; suggestion: Suggestion } | { ok: false; reason: string }> {
  const rows = await db
    .select()
    .from(suggestionsTable)
    .where(
      and(
        eq(suggestionsTable.id, input.id),
        eq(suggestionsTable.guildId, input.guildId),
      ),
    )
    .limit(1);
  const s = rows[0];
  if (!s) return { ok: false, reason: "Sugerencia no encontrada." };

  await db
    .update(suggestionsTable)
    .set({
      status: input.status,
      reviewedBy: input.reviewerId,
      reviewNote: input.note?.slice(0, 500) ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(suggestionsTable.id, input.id));

  const updated = (
    await db
      .select()
      .from(suggestionsTable)
      .where(eq(suggestionsTable.id, input.id))
      .limit(1)
  )[0]!;

  // Update message
  if (s.channelId && s.messageId) {
    try {
      const ch = await input.client.channels.fetch(s.channelId);
      if (ch?.isTextBased() && !ch.isDMBased()) {
        const msg = await (ch as TextChannel).messages
          .fetch(s.messageId)
          .catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [buildSuggestionEmbed(updated, input.client)],
            components: [
              suggestionButtons(updated.id, updated.status !== "pending"),
            ],
          });
        }
      }
    } catch (err) {
      logger.warn({ err }, "suggestions: edit message failed");
    }
  }

  // Log channel
  const settings = await getSuggestionSettings(input.guildId);
  if (settings?.logChannelId) {
    try {
      const logCh = await input.client.channels.fetch(settings.logChannelId);
      if (logCh?.isTextBased() && !logCh.isDMBased()) {
        await (logCh as TextChannel).send({
          embeds: [
            new EmbedBuilder()
              .setColor(STATUS_COLOR[input.status] ?? AMBER)
              .setTitle(`Sugerencia #${updated.id} · ${STATUS_LABEL[input.status]}`)
              .setDescription(updated.content.slice(0, 500))
              .addFields(
                { name: "Autor", value: `<@${updated.userId}>`, inline: true },
                {
                  name: "Staff",
                  value: `<@${input.reviewerId}>`,
                  inline: true,
                },
              )
              .setTimestamp(),
          ],
        });
      }
    } catch {
      /* optional */
    }
  }

  return { ok: true, suggestion: updated };
}

export async function listRecentSuggestions(
  guildId: string,
  limit = 10,
): Promise<Suggestion[]> {
  return db
    .select()
    .from(suggestionsTable)
    .where(eq(suggestionsTable.guildId, guildId))
    .orderBy(desc(suggestionsTable.id))
    .limit(limit);
}
