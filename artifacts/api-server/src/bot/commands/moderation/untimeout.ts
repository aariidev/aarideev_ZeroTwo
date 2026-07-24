import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("✅ Quita el timeout antes de tiempo")
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Sujeto a restaurar")
        .setRequired(true),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member)
      return interaction.reply({
        content: "❌ Sujeto fuera de los cuadrantes del servidor.",
        ephemeral: true,
      });
    if (!member.isCommunicationDisabled())
      return interaction.reply({
        content: "❌ El sujeto no se encuentra bajo un aislamiento activo.",
        ephemeral: true,
      });

    try {
      await member.timeout(
        null,
        `Restaurado por directiva de ${interaction.user.tag}`,
      );

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: "Re-calibración Biométrica // Zero Two",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle("✅ Cuarentena Revocada Correctamente")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          {
            name: "👤 Parásito Reconectado",
            value: `${target.tag}`,
            inline: true,
          },
          {
            name: "🛡️ Autoridad del Alta",
            value: `${interaction.user.tag}`,
            inline: true,
          },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      await logBotEvent({
        level: "info",
        event: "untimeout",
        details: { reason: "Removido manualmente por supervisor" },
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        userId: target.id,
        username: target.username,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
    } catch {
      await interaction.reply({
        content: "❌ Error interno en la sincronización de estados de Discord.",
        ephemeral: true,
      });
    }
  },
};

export default command;
