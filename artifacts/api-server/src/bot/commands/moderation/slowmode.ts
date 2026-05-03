import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client, TextChannel } from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("🐢 Configura el modo lento del canal")
    .addIntegerOption((opt) =>
      opt
        .setName("segundos")
        .setDescription("Segundos entre mensajes (0 para desactivar, máx 21600)")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const seconds = interaction.options.getInteger("segundos", true);
    const channel = interaction.channel as TextChannel;

    if (!channel?.isTextBased() || channel.isDMBased()) {
      return interaction.reply({ content: "Este comando solo funciona en canales de texto.", ephemeral: true });
    }

    try {
      await channel.setRateLimitPerUser(seconds, `Slowmode por ${interaction.user.tag}`);

      const isDisabled = seconds === 0;
      const embed = new EmbedBuilder()
        .setColor(isDisabled ? 0x00cc44 : 0xff8c00)
        .setTitle(isDisabled ? "🐢 Modo Lento Desactivado" : "🐢 Modo Lento Activado")
        .addFields(
          { name: "Canal", value: `<#${channel.id}>`, inline: true },
          { name: "Moderador", value: interaction.user.tag, inline: true },
          ...(isDisabled ? [] : [{ name: "Intervalo", value: `${seconds} segundos`, inline: true }]),
        )
        .setTimestamp()
        .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() });

      await interaction.reply({ embeds: [embed] });

      await logBotEvent({
        level: "info",
        event: "slowmode",
        details: { seconds, channelId: channel.id, channelName: channel.name },
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
    } catch {
      await interaction.reply({ content: "No pude cambiar el modo lento de este canal.", ephemeral: true });
    }
  },
};

export default command;
