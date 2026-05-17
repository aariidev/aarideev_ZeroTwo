import { Interaction, EmbedBuilder, Collection } from "discord.js";
import { logger } from "../../lib/logger.js";
import { BotClient } from "../types.js";
import { db, activityTable, commandStatsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { devState } from "../../lib/devState.js";

export default async function onInteractionCreate(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const client = interaction.client as BotClient;
  const { commandName, user, guild } = interaction;

  const command = client.commands.get(commandName);
  if (!command) return;

  if (devState.maintenanceMode) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff2d6b)
          .setTitle("🔧 Calibración en Proceso // Mantenimiento")
          .setDescription(
            devState.maintenanceMessage ||
              "Cariño, el sistema se está optimizando en este momento. ¡Vuelve pronto! 💕",
          )
          .setFooter({ text: "ZeroTwo System · Laboratorio de Parásitos" })
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }

  if (!client.cooldowns.has(command.data.name)) {
    client.cooldowns.set(command.data.name, new Collection());
  }

  const timestamps = client.cooldowns.get(command.data.name)!;
  const cooldownMs = (command.cooldown ?? 3) * 1000;
  const now = Date.now();

  if (timestamps.has(user.id)) {
    const expirationTime = timestamps.get(user.id)!;

    if (now < expirationTime) {
      const relativeTimestamp = Math.floor(expirationTime / 1000);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription(
              `🛑 ¡Cálmate! Estás pilotando demasiado rápido. Podrás usar \`/${command.data.name}\` **<t:${relativeTimestamp}:R>**.`,
            ),
        ],
        ephemeral: true,
      });
    }
  }

  const expiration = now + cooldownMs;
  timestamps.set(user.id, expiration);
  setTimeout(() => timestamps.delete(user.id), cooldownMs);

  let success = true;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    success = false;
    logger.error(
      { err, command: commandName },
      `Error ejecutando comando: ${commandName}`,
    );

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🚨 Error de Sincronización")
      .setDescription(
        "Hubo un fallo en la conexión con el Franxx al ejecutar este comando.",
      )
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction
        .followUp({ embeds: [errorEmbed], ephemeral: true })
        .catch(() => null);
    } else {
      await interaction
        .reply({ embeds: [errorEmbed], ephemeral: true })
        .catch(() => null);
    }
  }

  try {
    await Promise.all([
      db.insert(activityTable).values({
        command: commandName,
        userId: user.id,
        username: user.username,
        guildId: guild?.id ?? "DM",
        guildName: guild?.name ?? "DM",
        success,
      }),
      db
        .insert(commandStatsTable)
        .values({
          command: commandName,
          count: 1,
          lastUsed: new Date(),
        })
        .onConflictDoUpdate({
          target: commandStatsTable.command,
          set: {
            count: sql`${commandStatsTable.count} + 1`,
            lastUsed: new Date(),
          },
        }),
    ]);
  } catch (dbErr) {
    logger.error(
      { err: dbErr },
      "Error al registrar la actividad en la base de datos",
    );
  }
}
