import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("🔓 Desbanea a un usuario por su ID")
    .addStringOption((opt) =>
      opt.setName("userid").setDescription("ID del usuario a desbanear").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo del desbaneo")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const userId = interaction.options.getString("userid", true).trim();
    const reason = interaction.options.getString("motivo") ?? "Sin motivo especificado";

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ content: "ID de usuario inválida. Debe ser un número de 17-20 dígitos.", ephemeral: true });
    }

    try {
      const ban = await interaction.guild?.bans.fetch(userId).catch(() => null);
      if (!ban) return interaction.reply({ content: "Ese usuario no está baneado en este servidor.", ephemeral: true });

      await interaction.guild?.bans.remove(userId, reason);

      const embed = new EmbedBuilder()
        .setColor(0x00cc44)
        .setTitle("🔓 Usuario Desbaneado")
        .addFields(
          { name: "Usuario", value: `${ban.user.tag} (${ban.user.id})`, inline: true },
          { name: "Moderador", value: interaction.user.tag, inline: true },
          { name: "Motivo", value: reason },
        )
        .setTimestamp()
        .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() });

      await interaction.reply({ embeds: [embed] });

      await logBotEvent({
        level: "info",
        event: "unban",
        details: { reason },
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        userId: ban.user.id,
        username: ban.user.username,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
    } catch {
      await interaction.reply({ content: "No pude desbanear a ese usuario. Verifica la ID.", ephemeral: true });
    }
  },
};

export default command;
