import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import { musicManager } from "../../music/manager.js";
import {
  musicControls,
  musicEmbedFiles,
  musicNoticePayload,
  nowPlayingEmbed,
} from "../../music/embeds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("🎵 Muestra la canción actual con controles"),
  cooldown: 2,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        ...musicNoticePayload("❌ Solo en servidores.", {
          kind: "error",
          client,
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const session = musicManager.get(interaction.guild.id);
    if (!session?.current) {
      await interaction.reply({
        ...musicNoticePayload(
          "❌ No hay nada sonando.\nUsa **`/play`** para empezar.",
          { kind: "error", client },
        ),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const files = musicEmbedFiles();
    await interaction.reply({
      embeds: [
        nowPlayingEmbed(client, session.current, {
          position: 1,
          queueLen: session.queue.length,
          volume: session.volume,
          loop: session.loop,
          paused: session.paused,
          playbackSec: session.playbackSec,
          hasHistory: session.hasHistory,
        }),
      ],
      components: musicControls(
        interaction.guild.id,
        session.paused,
        session.hasHistory,
      ),
      files: files.length ? files : undefined,
    });
  },
};

export default command;
