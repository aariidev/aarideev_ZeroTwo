import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client, TextChannel } from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("🔓 Desbloquea el canal actual")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const channel = interaction.channel as TextChannel;

    if (!channel?.isTextBased() || channel.isDMBased()) {
      return interaction.reply({ content: "Este comando solo funciona en canales de texto.", ephemeral: true });
    }

    const everyone = interaction.guild?.roles.everyone;
    if (!everyone) return interaction.reply({ content: "No pude encontrar el rol @everyone.", ephemeral: true });

    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: null }, { reason: `Unlock por ${interaction.user.tag}` });

      const embed = new EmbedBuilder()
        .setColor(0x00cc44)
        .setTitle("🔓 Canal Desbloqueado")
        .addFields(
          { name: "Canal", value: `<#${channel.id}>`, inline: true },
          { name: "Moderador", value: interaction.user.tag, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() });

      await interaction.reply({ embeds: [embed] });

      await logBotEvent({
        level: "info",
        event: "unlock",
        details: { channelId: channel.id, channelName: channel.name },
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
    } catch {
      await interaction.reply({ content: "No pude desbloquear este canal.", ephemeral: true });
    }
  },
};

export default command;
