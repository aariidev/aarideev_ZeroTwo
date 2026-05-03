import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client, TextChannel, OverwriteType } from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("🔒 Bloquea el canal actual")
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo del bloqueo")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const reason = interaction.options.getString("motivo") ?? "Sin motivo especificado";
    const channel = interaction.channel as TextChannel;

    if (!channel?.isTextBased() || channel.isDMBased()) {
      return interaction.reply({ content: "Este comando solo funciona en canales de texto.", ephemeral: true });
    }

    const everyone = interaction.guild?.roles.everyone;
    if (!everyone) return interaction.reply({ content: "No pude encontrar el rol @everyone.", ephemeral: true });

    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, { reason: `Lock por ${interaction.user.tag}: ${reason}` });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("🔒 Canal Bloqueado")
        .addFields(
          { name: "Canal", value: `<#${channel.id}>`, inline: true },
          { name: "Moderador", value: interaction.user.tag, inline: true },
          { name: "Motivo", value: reason },
        )
        .setTimestamp()
        .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() });

      await interaction.reply({ embeds: [embed] });

      await logBotEvent({
        level: "warn",
        event: "lock",
        details: { reason, channelId: channel.id, channelName: channel.name },
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
    } catch {
      await interaction.reply({ content: "No pude bloquear este canal.", ephemeral: true });
    }
  },
};

export default command;
