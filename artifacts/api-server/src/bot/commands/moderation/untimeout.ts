import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("✅ Quita el timeout de un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario al que quitar el timeout").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: "No pude encontrar ese usuario.", ephemeral: true });
    if (!member.isCommunicationDisabled()) return interaction.reply({ content: "Ese usuario no tiene timeout activo.", ephemeral: true });

    try {
      await member.timeout(null);

      const embed = new EmbedBuilder()
        .setColor(0x00cc44)
        .setTitle("✅ Timeout Eliminado")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "Usuario", value: `${target.tag} (${target.id})`, inline: true },
          { name: "Moderador", value: interaction.user.tag, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() });

      await interaction.reply({ embeds: [embed] });

      await logBotEvent({
        level: "info",
        event: "untimeout",
        details: {},
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        userId: target.id,
        username: target.username,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
    } catch {
      await interaction.reply({ content: "Ocurrió un error al quitar el timeout.", ephemeral: true });
    }
  },
};

export default command;
