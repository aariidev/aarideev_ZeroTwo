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
import { addedToQueueEmbed, nowPlayingEmbed, musicControls } from "../../music/embeds.js";

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
        content: "❌ Solo en servidores.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voice = memberVoiceChannel(member);
    if (!voice) {
      await interaction.reply({
        content: "❌ Entra a un **canal de voz** primero.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const me = interaction.guild.members.me;
    if (
      me &&
      !voice.permissionsFor(me)?.has([
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ])
    ) {
      await interaction.reply({
        content: "❌ No tengo permiso de **Conectar/Hablar** en ese canal.",
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
      await interaction.editReply({
        content: `❌ No se pudo buscar: ${err instanceof Error ? err.message : "error"}`,
      });
      return;
    }

    if (!tracks.length) {
      await interaction.editReply({
        content: "❌ No encontré resultados. Prueba otra búsqueda o un enlace de YouTube.",
      });
      return;
    }

    const session = musicManager.getOrCreate(interaction.guild.id, client);
    session.connect(voice);

    const wasIdle = !session.current && session.queue.length === 0;
    if (wasIdle) session.suppressNextAnnounce = true;
    await session.enqueue(tracks, interaction.channelId);

    if (tracks.length > 1) {
      await interaction.editReply({
        content: `📜 Playlist: **${tracks.length}** pistas añadidas a la cola.`,
      });
      return;
    }

    const track = tracks[0]!;
    if (wasIdle) {
      // Now playing will also be announced by the session; reply with NP embed
      await interaction.editReply({
        embeds: [
          nowPlayingEmbed(client, track, {
            position: 1,
            queueLen: session.queue.length,
            volume: session.volume,
            loop: session.loop,
            paused: session.paused,
          }),
        ],
        components: musicControls(interaction.guild.id, session.paused),
      });
    } else {
      const pos = session.queue.length; // just queued at end (current already playing)
      await interaction.editReply({
        embeds: [addedToQueueEmbed(client, track, pos)],
      });
    }
  },
};

export default command;
