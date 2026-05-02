import { Interaction, EmbedBuilder, Collection } from "discord.js";
import { logger } from "../../lib/logger.js";
import { BotClient } from "../types.js";
import { db } from "@workspace/db";
import { activityTable, commandStatsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export default async function onInteractionCreate(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const client = interaction.client as BotClient;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // Cooldown check
  if (!client.cooldowns.has(command.data.name)) {
    client.cooldowns.set(command.data.name, new Collection());
  }
  const timestamps = client.cooldowns.get(command.data.name)!;
  const cooldownMs = (command.cooldown ?? 3) * 1000;
  const now = Date.now();

  if (timestamps.has(interaction.user.id)) {
    const expiration = timestamps.get(interaction.user.id)! + cooldownMs;
    if (now < expiration) {
      const remaining = ((expiration - now) / 1000).toFixed(1);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setDescription(`⏱️ Espera **${remaining}s** antes de usar \`/${command.data.name}\` de nuevo.`)],
        ephemeral: true,
      });
    }
  }
  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownMs);

  let success = true;
  try {
    await command.execute(interaction, interaction.client);
  } catch (err) {
    success = false;
    logger.error({ err, command: interaction.commandName }, "Error ejecutando comando");
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Error")
      .setDescription("Hubo un error al ejecutar este comando.")
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
    }
  }

  // Log activity to DB
  try {
    await db.insert(activityTable).values({
      command: interaction.commandName,
      userId: interaction.user.id,
      username: interaction.user.username,
      guildId: interaction.guild?.id ?? "DM",
      guildName: interaction.guild?.name ?? "DM",
      success,
    });

    // Upsert command stats
    await db
      .insert(commandStatsTable)
      .values({ command: interaction.commandName, count: 1, lastUsed: new Date() })
      .onConflictDoUpdate({
        target: commandStatsTable.command,
        set: {
          count: sql`${commandStatsTable.count} + 1`,
          lastUsed: new Date(),
        },
      });
  } catch (dbErr) {
    logger.error({ err: dbErr }, "Error logging activity");
  }
}
