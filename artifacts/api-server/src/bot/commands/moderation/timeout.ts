import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

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
    .setDescription("⏱️ Aplica un timeout a un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a silenciar temporalmente").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("duracion")
        .setDescription("Duración del timeout")
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
        )
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo del timeout")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const durationKey = interaction.options.getString("duracion", true);
    const reason = interaction.options.getString("motivo") ?? "Sin motivo especificado";
    const durationMs = DURATIONS[durationKey] ?? 300_000;
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: "No pude encontrar ese usuario.", ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: "No puedo aplicar timeout a ese usuario.", ephemeral: true });
    if (member.id === interaction.user.id) return interaction.reply({ content: "No puedes silenciarte a ti mismo.", ephemeral: true });

    try {
      await member.timeout(durationMs, reason);

      const embed = new EmbedBuilder()
        .setColor(0xff8c00)
        .setTitle("⏱️ Timeout Aplicado")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "Usuario", value: `${target.tag} (${target.id})`, inline: true },
          { name: "Moderador", value: interaction.user.tag, inline: true },
          { name: "Duración", value: durationKey, inline: true },
          { name: "Motivo", value: reason },
        )
        .setTimestamp()
        .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() });

      await interaction.reply({ embeds: [embed] });

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
      await interaction.reply({ content: "Ocurrió un error al aplicar el timeout.", ephemeral: true });
    }
  },
};

export default command;
