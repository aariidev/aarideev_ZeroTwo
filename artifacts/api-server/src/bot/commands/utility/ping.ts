import { SlashCommandBuilder, EmbedBuilder, Client, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 Comprueba la latencia del bot"),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "Bot", value: `\`${Date.now() - interaction.createdTimestamp}ms\``, inline: true },
        { name: "WebSocket", value: `\`${Math.round(client.ws.ping)}ms\``, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
