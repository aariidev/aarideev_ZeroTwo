import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription("🎲 Lanza un dado")
    .addIntegerOption((opt) =>
      opt.setName("caras").setDescription("Número de caras del dado (default: 6)").setMinValue(2).setMaxValue(1000)
    ),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sides = interaction.options.getInteger("caras") ?? 6;
    const result = Math.floor(Math.random() * sides) + 1;
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle("🎲 Dado Lanzado")
      .setDescription(`**d${sides}: ${result}**`)
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
