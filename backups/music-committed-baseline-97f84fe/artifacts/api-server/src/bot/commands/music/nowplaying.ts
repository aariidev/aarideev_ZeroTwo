import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import { musicManager } from "../../music/manager.js";
import { musicControls, nowPlayingEmbed } from "../../music/embeds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("🎵 Muestra la canción actual con controles"),
  cooldown: 2,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({ content: "❌ Solo en servidores.", flags: MessageFlags.Ephemeral });
      return;
    }
    const session = musicManager.get(interaction.guild.id);
    if (!session?.current) {
      await interaction.reply({ content: "❌ No hay nada sonando.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({
      embeds: [
        nowPlayingEmbed(client, session.current, {
          position: 1,
          queueLen: session.queue.length,
          volume: session.volume,
          loop: session.loop,
          paused: session.paused,
        }),
      ],
      components: musicControls(interaction.guild.id, session.paused),
    });
  },
};

export default command;
