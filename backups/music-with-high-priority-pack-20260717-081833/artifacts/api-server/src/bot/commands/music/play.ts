import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../types.js";
import {
  memberVoiceChannel,
  musicManager,
  resolveTracks,
} from "../../music/manager.js";
import {
  addedToQueueEmbed,
  musicControls,
  musicEmbedFiles,
  musicNoticePayload,
  nowPlayingEmbed,
} from "../../music/embeds.js";
import { canRequestMusic } from "../../music/permissions.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription(
      "🎵 Reproduce música — YouTube, Spotify (track/album/playlist) o búsqueda",
    )
    .addStringOption((o) =>
      o
        .setName("query")
        .setDescription("Nombre, URL de YouTube o enlace de Spotify")
        .setRequired(true),
    ),
  cooldown: 2,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        ...musicNoticePayload("❌ Este comando solo funciona en **servidores**.", {
          kind: "error",
          client,
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const existing = musicManager.get(interaction.guild.id);
    const req = canRequestMusic(member, existing);
    if (!req.ok) {
      await interaction.reply({
        ...musicNoticePayload(req.reason, { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const voice = memberVoiceChannel(member)!;

    const me = interaction.guild.members.me;
    if (
      me &&
      !voice.permissionsFor(me)?.has([
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ])
    ) {
      await interaction.reply({
        ...musicNoticePayload(
          "❌ No tengo permiso de **Conectar** / **Hablar** en ese canal de voz.",
          { kind: "error", client },
        ),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const query = interaction.options.getString("query", true).trim();
    await interaction.deferReply();

    let tracks;
    try {
      tracks = await resolveTracks(query, member);
    } catch (err) {
      await interaction.editReply(
        musicNoticePayload(
          `❌ No se pudo buscar:\n\`\`\`${err instanceof Error ? err.message : "error"}\`\`\``,
          { kind: "error", client, banner: true, title: "Zero Two Music · Búsqueda" },
        ),
      );
      return;
    }

    if (!tracks.length) {
      await interaction.editReply(
        musicNoticePayload(
          "❌ No encontré resultados.\nPrueba otra búsqueda o un enlace de **YouTube** / **Spotify**.",
          { kind: "error", client, banner: true, title: "Zero Two Music · Sin resultados" },
        ),
      );
      return;
    }

    const session = musicManager.getOrCreate(interaction.guild.id, client);
    session.connect(voice);

    const wasIdle = !session.current && session.queue.length === 0;
    if (wasIdle) session.suppressNextAnnounce = true;
    await session.enqueue(tracks, interaction.channelId);

    // Keep fixed panel in sync
    try {
      const { schedulePanelRefresh } = await import("../../music/panel.js");
      schedulePanelRefresh(client, interaction.guild.id);
    } catch {
      /* optional */
    }

    if (tracks.length > 1) {
      await interaction.editReply(
        musicNoticePayload(
          `📜 **Playlist cargada**\nSe han añadido **${tracks.length}** pistas a la cola.`,
          {
            kind: "ok",
            client,
            banner: true,
            title: "Zero Two Music · Playlist",
          },
        ),
      );
      return;
    }

    const track = tracks[0]!;
    const files = musicEmbedFiles();
    if (wasIdle) {
      await interaction.editReply({
        embeds: [
          nowPlayingEmbed(client, track, {
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
      const pos = session.queue.length;
      await interaction.editReply({
        embeds: [addedToQueueEmbed(client, track, pos)],
        files: files.length ? files : undefined,
      });
    }
  },
};

export default command;
