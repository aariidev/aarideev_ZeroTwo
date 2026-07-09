import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { db, botConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

const LOG_KEY = (guildId: string) => `log_channel:${guildId}`;

export async function getLogChannelId(guildId: string): Promise<string | null> {
  try {
    const rows = await db
      .select()
      .from(botConfigTable)
      .where(eq(botConfigTable.key, LOG_KEY(guildId)))
      .limit(1);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setLogChannelId(
  guildId: string,
  channelId: string,
): Promise<void> {
  await db
    .insert(botConfigTable)
    .values({ key: LOG_KEY(guildId), value: channelId })
    .onConflictDoUpdate({
      target: botConfigTable.key,
      set: { value: channelId, updatedAt: new Date() },
    });
}

export async function removeLogChannel(guildId: string): Promise<void> {
  await db
    .delete(botConfigTable)
    .where(eq(botConfigTable.key, LOG_KEY(guildId)));
}

export async function sendModLog(
  client: Client,
  guildId: string,
  embed: EmbedBuilder,
): Promise<void> {
  try {
    const channelId = await getLogChannelId(guildId);
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId) as
      | TextChannel
      | undefined;
    if (!channel?.isTextBased()) return;

    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, "sendModLog: error enviando al canal de logs");
  }
}
