import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { Command } from "../../types.js";
import { musicManager } from "../../music/manager.js";
import {
  musicControls,
  musicEmbedFiles,
  musicNoticePayload,
  nowPlayingEmbed,
} from "../../music/embeds.js";
import { canControlMusic } from "../../music/permissions.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("⏸️ Pausa / reanuda la reproducción"),
  cooldown: 2,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client;
    if (!interaction.guild) {
      await interaction.reply({
        ...musicNoticePayload("❌ Solo en servidores.", { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const member = interaction.member as GuildMember;
    const session = musicManager.get(interaction.guild.id);
    if (!session?.current) {
      await interaction.reply({
        ...musicNoticePayload("❌ No hay nada sonando.", {
          kind: "error",
          client,
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const perm = await canControlMusic(member, session);
    if (!perm.ok) {
      await interaction.reply({
        ...musicNoticePayload(perm.reason, { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (session.paused) session.resume();
    else session.pause();

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
