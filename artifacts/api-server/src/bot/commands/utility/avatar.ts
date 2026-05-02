import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("🖼️ Muestra el avatar de un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a consultar")
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const user = interaction.options.getUser("usuario") ?? interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: 512 });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🖼️ Avatar de ${user.username}`)
      .setImage(avatarUrl)
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Descargar")
        .setStyle(ButtonStyle.Link)
        .setURL(avatarUrl)
        .setEmoji("📥")
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

export default command;
