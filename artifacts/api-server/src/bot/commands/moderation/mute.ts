import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const parseDuration = (str: string): number | null => {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const val = parseInt(match[1]!);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * (multipliers[unit!] ?? 0);
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("🔇 Silencia a un usuario temporalmente")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a silenciar").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("duracion").setDescription("Duración (ej: 10m, 1h, 1d)").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo del silencio")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const durationStr = interaction.options.getString("duracion", true);
    const reason = interaction.options.getString("motivo") ?? "Sin motivo especificado";
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) {
      return interaction.reply({ content: "No pude encontrar a ese usuario.", ephemeral: true });
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({ content: "Duración inválida. Usa formato: `10m`, `1h`, `7d` (máx 28 días).", ephemeral: true });
    }

    await member.timeout(durationMs, reason);

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle("🔇 Usuario Silenciado")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "Usuario", value: `${target.tag} (${target.id})`, inline: true },
        { name: "Moderador", value: `${interaction.user.tag}`, inline: true },
        { name: "Duración", value: durationStr, inline: true },
        { name: "Motivo", value: reason }
      )
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
