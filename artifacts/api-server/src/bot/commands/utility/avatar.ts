import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("🖼️ Avatar a tamaño completo de un usuario (o el tuyo)")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Sujeto a escanear"),
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const user = interaction.options.getUser("usuario") ?? interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: 1024 });

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: `Transmisión Visual // Archivos Centrales`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(`🖼️ Interfaz de: ${user.username}`)
      .setImage(avatarUrl)
      .setTimestamp()
      .setFooter({
        text: `Resolución optimizada a 1024px`,
        iconURL: client.user?.displayAvatarURL(),
      });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Extraer Imagen Abierta")
        .setStyle(ButtonStyle.Link)
        .setURL(avatarUrl)
        .setEmoji("📥"),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

export default command;
