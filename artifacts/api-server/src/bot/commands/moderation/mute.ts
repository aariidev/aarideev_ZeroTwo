import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";

const parseDuration = (str: string): number | null => {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const val = parseInt(match[1]!);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };
  return val * (multipliers[unit!] ?? 0);
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("🔇 Silencia a un miembro por un tiempo")
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Objetivo a silenciar")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("duracion")
        .setDescription("Duración (ej: 10m, 1h, 7d)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo del aislamiento"),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const durationStr = interaction.options.getString("duracion", true);
    const reason =
      interaction.options.getString("motivo") ?? "Sin motivo especificado";
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member)
      return interaction.reply({
        content: "❌ No se encontró a ese parásito en los registros locales.",
        ephemeral: true,
      });

    const botMember = interaction.guild?.members.me;
    const modMember = interaction.member as any;
    if (
      botMember &&
      member.roles.highest.position >= botMember.roles.highest.position
    ) {
      return interaction.reply({
        content:
          "❌ Error de calibración: Mi nivel de rol es inferior al del objetivo.",
        ephemeral: true,
      });
    }
    if (
      modMember &&
      member.roles.highest.position >= modMember.roles.highest.position
    ) {
      return interaction.reply({
        content:
          "❌ No tienes autorización de rango para aislar a este usuario.",
        ephemeral: true,
      });
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        content:
          "❌ Formato temporal inválido. Rango: `10m`, `1h`, `7d` (Máx: 28 días).",
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
              `⚠️ Tu comunicación ha sido restringida en ${interaction.guild?.name}`,
            )
            .setDescription(
              `\`\`\`md\n* Motivo   :: ${reason}\n* Duración :: ${durationStr}\n\`\`\``,
            )
            .setTimestamp(),
        ],
      });
      dmSent = true;
    } catch {
      dmSent = false;
    }

    await member.timeout(
      durationMs,
      `${reason} | Por: ${interaction.user.tag}`,
    );

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Protocolo de Aislamiento Estructural // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🔇 Parásito Silenciado Correctamente")
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
          name: "⏳ Tiempo Asignado",
          value: `\`${durationStr}\``,
          inline: true,
        },
        {
          name: "📝 Diagnóstico / Motivo",
          value: `\`\`\`\n${reason}\n\`\`\``,
          inline: false,
        },
        {
          name: "📥 Estado de Alerta DM",
          value: dmSent
            ? "✅ Entregada con éxito."
            : "❌ Bloqueada por el usuario.",
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({
        text: "The Garden · Control de Conducta",
        iconURL: client.user?.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
