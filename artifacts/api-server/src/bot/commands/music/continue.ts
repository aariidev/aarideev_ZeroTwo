import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { Command } from "../../types.js";
import {
  continueMusicSession,
  musicManager,
} from "../../music/manager.js";
import {
  musicControls,
  musicEmbedFiles,
  musicNoticePayload,
  nowPlayingEmbed,
} from "../../music/embeds.js";
import { formatDuration } from "../../music/types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("continue")
    .setDescription("▶️ Reanuda la sesión de música guardada"),
  cooldown: 3,

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

    const member = interaction.member as GuildMember;
    await interaction.deferReply();

    const result = await continueMusicSession(
      client,
      interaction.guild.id,
      member,
    );

    if (!result.ok) {
      await interaction.editReply(
        musicNoticePayload(result.reason, { kind: "error", client }),
      );
      return;
    }

    const session = musicManager.get(interaction.guild.id);
    const files = musicEmbedFiles();

    if (session?.current) {
      await interaction.editReply({
        content: null,
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
    } else {
      await interaction.editReply(
        musicNoticePayload(
          [
            `▶️ **Sesión reanudada**`,
            `**${result.title.slice(0, 100)}**`,
            result.fromSec > 0
              ? `Desde \`${formatDuration(result.fromSec)}\``
              : null,
            result.queueLen
              ? `Cola: **${result.queueLen}** pista(s)`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
          {
            kind: "ok",
            client,
            banner: true,
            title: "Zero Two Music · Continue",
          },
        ),
      );
    }

    try {
      const { schedulePanelRefresh } = await import("../../music/panel.js");
      schedulePanelRefresh(client, interaction.guild.id);
    } catch {
      /* optional */
    }
  },
};

export default command;
