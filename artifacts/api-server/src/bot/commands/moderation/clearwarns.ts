import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { db, warnsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clearwarns")
    .setDescription(
      "🗑️ Limpia y formatea a cero el expediente de incidencias de un parásito",
    )
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Objetivo a indultar")
        .setRequired(true),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const guildId = interaction.guild?.id ?? "";

    const deleted = await db
      .delete(warnsTable)
      .where(
        and(eq(warnsTable.userId, target.id), eq(warnsTable.guildId, guildId)),
      )
      .returning();

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Purga de Expedientes Sanitarios // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🗑️ Amnistía de Advertencias Completada")
      .setThumbnail(target.displayAvatarURL())
      .setDescription(
        `Se han erradicado **${deleted.length}** advertencias de la ficha de identificación de ${target.tag}.`,
      )
      .addFields(
        {
          name: "👤 Sujeto Re-habilitado",
          value: `${target.username} \`(${target.id})\``,
          inline: true,
        },
        {
          name: "🛡️ Mod de Gestión",
          value: `${interaction.user.tag}`,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    await logBotEvent({
      level: "info",
      event: "purge",
      details: {
        action: "clearwarns",
        clearedCount: deleted.length,
        affectedUser: target.id,
      },
      guildId,
      guildName: interaction.guild?.name,
    });
  },
};

export default command;
