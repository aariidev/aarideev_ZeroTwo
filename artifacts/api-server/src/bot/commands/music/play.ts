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
  isSpotifyQuery,
  memberVoiceChannel,
  musicManager,
  resolveSpotifyProgressive,
  resolveTracks,
} from "../../music/manager.js";
import {
  addedToQueueEmbed,
  musicControls,
  musicEmbedFiles,
  musicNoticePayload,
  nowPlayingEmbed,
  spotifyLoadingEmbed,
  spotifyPlaylistBootEmbed,
  spotifyPlaylistReadyEmbed,
} from "../../music/embeds.js";
import { canRequestMusic } from "../../music/permissions.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("▶️ Reproduce YouTube o Spotify (track, álbum, playlist)")
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

    const session = musicManager.getOrCreate(interaction.guild.id, client);
    session.connect(voice);
    const wasIdle = !session.current && session.queue.length === 0;

    // Spotify playlist/álbum: 1ª pista ya suena; el resto se resuelve en paralelo
    // (50× ytsearch secuencial dejaba el defer "pensando" varios minutos).
    if (isSpotifyQuery(query)) {
      const bannerFiles = musicEmbedFiles();
      try {
        await interaction.editReply({
          embeds: [spotifyLoadingEmbed(client, "reading")],
          files: bannerFiles.length ? bannerFiles : undefined,
        });

        let firstTitle = "";
        await resolveSpotifyProgressive(query, member, {
          onFirst: async (tracks, meta) => {
            if (wasIdle) session.suppressNextAnnounce = true;
            await session.enqueue(tracks, interaction.channelId);
            try {
              const { schedulePanelRefresh } = await import(
                "../../music/panel.js"
              );
              schedulePanelRefresh(client, interaction.guild!.id);
            } catch {
              /* optional */
            }

            const first = tracks[0]!;
            firstTitle = first.title;
            if (meta.totalItems === 1) {
              const files = musicEmbedFiles();
              if (wasIdle) {
                await interaction.editReply({
                  embeds: [
                    nowPlayingEmbed(client, first, {
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
                    interaction.guild!.id,
                    session.paused,
                    session.hasHistory,
                  ),
                  files: files.length ? files : undefined,
                });
              } else {
                await interaction.editReply({
                  embeds: [
                    addedToQueueEmbed(client, first, session.queue.length),
                  ],
                  files: musicEmbedFiles().length
                    ? musicEmbedFiles()
                    : undefined,
                });
              }
              return;
            }

            await interaction.editReply({
              embeds: [
                spotifyPlaylistBootEmbed(client, first, {
                  totalItems: meta.totalItems,
                  remaining: meta.totalItems - 1,
                  volume: session.volume,
                  loop: session.loop,
                  queueLen: session.queue.length,
                }),
              ],
              components: musicControls(
                interaction.guild!.id,
                session.paused,
                session.hasHistory,
              ),
              files: musicEmbedFiles().length ? musicEmbedFiles() : undefined,
            });
          },
          onRest: async (tracks, meta) => {
            await session.enqueue(tracks, interaction.channelId);
            try {
              const { schedulePanelRefresh } = await import(
                "../../music/panel.js"
              );
              schedulePanelRefresh(client, interaction.guild!.id);
            } catch {
              /* optional */
            }
            await interaction.editReply({
              embeds: [
                spotifyPlaylistReadyEmbed(client, {
                  resolved: meta.resolved,
                  totalItems: meta.totalItems,
                  queueLen: session.queue.length,
                  firstTitle,
                }),
              ],
              components: musicControls(
                interaction.guild!.id,
                session.paused,
                session.hasHistory,
              ),
              files: musicEmbedFiles().length ? musicEmbedFiles() : undefined,
            });
          },
        });
      } catch (err) {
        await interaction.editReply(
          musicNoticePayload(
            `❌ No se pudo cargar Spotify:\n\`\`\`${err instanceof Error ? err.message : "error"}\`\`\``,
            {
              kind: "error",
              client,
              banner: true,
              title: "Zero Two Music · Spotify",
            },
          ),
        );
      }
      return;
    }

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
          `📜 **Mix / playlist cargada**\nSe han añadido **${tracks.length}** pistas a la cola.\nLa primera empieza a sonar ya.`,
          {
            kind: "ok",
            client,
            banner: true,
            title: "Zero Two Music · Mix / Playlist",
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
