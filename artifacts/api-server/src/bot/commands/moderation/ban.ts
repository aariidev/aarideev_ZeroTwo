import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";
import { sendModLog } from "../../lib/modlog.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription(
      "🔨 Termina de forma definitiva la conexión de un parásito con la plantación",
    )
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Objetivo a banear")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Razón de la purga total"),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("dias")
        .setDescription("Días de historial de chat a limpiar (0-7)")
        .setMinValue(0)
        .setMaxValue(7),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const reason =
      interaction.options.getString("motivo") ??
      "Incompatibilidad crítica con el sistema.";
    const days = interaction.options.getInteger("dias") ?? 0;

    const member = interaction.guild?.members.cache.get(target.id);
    if (member) {
      if (!member.bannable)
        return interaction.reply({
          content:
            "❌ Jerarquía de privilegios insuficiente para purgar a este sujeto.",
          ephemeral: true,
        });
    }

    let dmSent = false;
    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setTitle(
              `🔨 Has sido permanentemente purgado de ${interaction.guild?.name}`,
            )
            .setDescription(`\`\`\`md\n* Causa Final :: ${reason}\n\`\`\``)
            .setTimestamp(),
        ],
      });
      dmSent = true;
    } catch {
      dmSent = false;
    }

    await interaction.guild?.members.ban(target.id, {
      reason: `${reason} | Por: ${interaction.user.tag}`,
      deleteMessageSeconds: days * 24 * 60 * 60,
    });

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Protocolo de Purga Absoluta // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🔨 Parásito Sancionado con Ban Definitivo")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        {
          name: "👤 Sujeto Eliminado",
          value: `${target.tag} \`(${target.id})\``,
          inline: true,
        },
        {
          name: "🛡️ Autoridad Ejecutora",
          value: `${interaction.user.tag}`,
          inline: true,
        },
        {
          name: "🧹 Depuración de Mensajes",
          value: `\`${days} días borrados\``,
          inline: true,
        },
        {
          name: "📝 Fundamentación",
          value: `\`\`\`\n${reason}\n\`\`\``,
          inline: false,
        },
        {
          name: "📬 Historial DM",
          value: dmSent
            ? "✅ Notificación de Purga Entregada"
            : "❌ Imposible Notificar (DM Cerrado)",
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await sendModLog(client, interaction.guild?.id ?? "", embed);

    await logBotEvent({
      level: "warn",
      event: "ban",
      details: { reason, deleteMessageDays: days },
      guildId: interaction.guild?.id,
      guildName: interaction.guild?.name,
      userId: target.id,
      username: target.username,
    });
  },
};

export default command;
