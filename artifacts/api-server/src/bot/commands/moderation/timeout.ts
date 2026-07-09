import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";
import { sendModLog } from "../../lib/modlog.js";

const DURATIONS: Record<string, number> = {
  "60s": 60_000,
  "5m": 300_000,
  "10m": 600_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "6h": 21_600_000,
  "12h": 43_200_000,
  "24h": 86_400_000,
  "7d": 604_800_000,
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription(
      "⏱️ Restringe la actividad de un parásito mediante un aislamiento temporal",
    )
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Sujeto de estudio")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("duracion")
        .setDescription("Ventana temporal de restricción")
        .setRequired(true)
        .addChoices(
          { name: "60 segundos", value: "60s" },
          { name: "5 minutos", value: "5m" },
          { name: "10 minutos", value: "10m" },
          { name: "30 minutos", value: "30m" },
          { name: "1 hora", value: "1h" },
          { name: "6 horas", value: "6h" },
          { name: "12 horas", value: "12h" },
          { name: "24 horas", value: "24h" },
          { name: "7 días", value: "7d" },
        ),
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Razón de la desincronización"),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const durationKey = interaction.options.getString("duracion", true);
    const reason =
      interaction.options.getString("motivo") ??
      "Corrección de comportamiento estándar.";
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member)
      return interaction.reply({
        content: "❌ El parásito no se encuentra en este servidor.",
        ephemeral: true,
      });
    if (!member.moderatable)
      return interaction.reply({
        content:
          "❌ Error de privilegios: Jerarquía del bot inferior al objetivo.",
        ephemeral: true,
      });
    if (member.id === interaction.user.id)
      return interaction.reply({
        content: "❌ No puedes auto-aplicarte un protocolo de contención.",
        ephemeral: true,
      });

    // Validación de jerarquía del moderador ejecutor
    const modMember = interaction.member as any;
    if (
      modMember &&
      member.roles.highest.position >= modMember.roles.highest.position
    ) {
      return interaction.reply({
        content:
          "❌ Tus rangos no igualan o superan la firma del parásito seleccionado.",
        ephemeral: true,
      });
    }

    const durationMs = DURATIONS[durationKey];
    if (!durationMs)
      return interaction.reply({
        content: "❌ Parámetro temporal corrupto.",
        ephemeral: true,
      });

    let dmSent = false;
    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setTitle(`⏱️ Aislamiento preventivo en ${interaction.guild?.name}`)
            .setDescription(
              `\`\`\`md\n* Plazo   :: ${durationKey}\n* Motivo  :: ${reason}\n\`\`\``,
            ),
        ],
      });
      dmSent = true;
    } catch {
      dmSent = false;
    }

    try {
      await member.timeout(
        durationMs,
        `${reason} | Por: ${interaction.user.tag}`,
      );

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: "Protocolo de Retención Cuántica // Zero Two",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle("⏱️ Timeout Desplegado Exitosamente")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          {
            name: "👤 Código Objetivo",
            value: `${target.tag} \`(${target.id})\``,
            inline: true,
          },
          {
            name: "🛡️ Moderador",
            value: `${interaction.user.tag}`,
            inline: true,
          },
          {
            name: "⏳ Ventana Temporal",
            value: `\`${durationKey}\``,
            inline: true,
          },
          {
            name: "📝 Diagnóstico",
            value: `\`\`\`\n${reason}\n\`\`\``,
            inline: false,
          },
          {
            name: "📥 Alerta de Enlace",
            value: dmSent ? "✅ Notificado por DM" : "❌ DM Bloqueado",
            inline: true,
          },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await sendModLog(client, interaction.guild?.id ?? "", embed);

      await logBotEvent({
        level: "warn",
        event: "timeout",
        details: { duration: durationKey, durationMs, reason },
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        userId: target.id,
        username: target.username,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
    } catch {
      await interaction.reply({
        content:
          "❌ Error en los sistemas de la API al intentar mitigar al usuario.",
        ephemeral: true,
      });
    }
  },
};

export default command;
