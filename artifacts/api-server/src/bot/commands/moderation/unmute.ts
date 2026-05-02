import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("🔊 Quita el silencio a un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a des-silenciar").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) {
      return interaction.reply({ content: "No pude encontrar a ese usuario.", ephemeral: true });
    }
    if (!member.communicationDisabledUntil) {
      return interaction.reply({ content: "Ese usuario no está silenciado.", ephemeral: true });
    }

    await member.timeout(null);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("🔊 Silencio Removido")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "Usuario", value: `${target.tag} (${target.id})`, inline: true },
        { name: "Moderador", value: `${interaction.user.tag}`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
