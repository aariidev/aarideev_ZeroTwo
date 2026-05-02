import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("🪙 Lanza una moneda"),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const result = Math.random() < 0.5 ? "Cara" : "Cruz";
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("🪙 Lanzamiento de Moneda")
      .setDescription(`**¡${result}!**`)
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
