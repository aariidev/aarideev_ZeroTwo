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
    .setName("unban")
    .setDescription(
      "🔓 Revoca un ban estructural permitiendo el re-ingreso de una ID",
    )
    .addStringOption((opt) =>
      opt
        .setName("userid")
        .setDescription("ID única del parásito a amnistiar")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Razón del indulto"),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const userId = interaction.options.getString("userid", true).trim();
    const reason =
      interaction.options.getString("motivo") ??
      "Re-calibración de estatus aprobada.";

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({
        content:
          "❌ La ID provista no cumple con los parámetros cuánticos de Discord (17-20 dígitos).",
        ephemeral: true,
      });
    }

    try {
      const ban = await interaction.guild?.bans.fetch(userId).catch(() => null);
      if (!ban)
        return interaction.reply({
          content:
            "❌ Esa ID no figura en los registros de exclusión de este entorno.",
          ephemeral: true,
        });

      await interaction.guild?.bans.remove(userId, reason);

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: "Amnistía General // Protocolo de Retorno",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle("🔓 Orden de Ban Revocada con Éxito")
        .addFields(
          {
            name: "👤 Parásito Indultado",
            value: `${ban.user.tag} \`(${ban.user.id})\``,
            inline: true,
          },
          {
            name: "🛡️ Concedido por",
            value: `${interaction.user.tag}`,
            inline: true,
          },
          {
            name: "📝 Argumentación",
            value: `\`\`\`\n${reason}\n\`\`\``,
            inline: false,
          },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      await logBotEvent({
        level: "info",
        event: "unban",
        details: { reason },
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        userId: ban.user.id,
        username: ban.user.username,
      });
    } catch {
      await interaction.reply({
        content:
          "❌ Error interno al procesar la revocación en la API de Discord.",
        ephemeral: true,
      });
    }
  },
};

export default command;
