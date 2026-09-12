/**
 * /playlist — Manage personal saved playlists.
 * Save current queue, load saved playlists, manage tracks.
 */
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { Command } from "../../types.js";
import {
  createPlaylist,
  listPlaylists,
  getPlaylist,
  deletePlaylist,
  renamePlaylist,
  formatPlaylistInfo,
} from "../../music/favorites.js";
import { GuildMusicSession } from "../../music/manager.js";

const PINK = 0xff2d6b;
const CYAN = 0x22d3ee;
const GREEN = 0x22c55e;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("⭐ Manage your saved music playlists")
    .addSubcommand((s) =>
      s
        .setName("save")
        .setDescription("Save current queue as a playlist")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Name for this playlist")
            .setMaxLength(50)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("load")
        .setDescription("Load a saved playlist")
        .addStringOption((o) =>
          o
            .setName("playlist_id")
            .setDescription("ID of the playlist to load")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("list")
        .setDescription("Show all your saved playlists"),
    )
    .addSubcommand((s) =>
      s
        .setName("delete")
        .setDescription("Delete a saved playlist")
        .addStringOption((o) =>
          o
            .setName("playlist_id")
            .setDescription("ID of the playlist to delete")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("rename")
        .setDescription("Rename a saved playlist")
        .addStringOption((o) =>
          o
            .setName("playlist_id")
            .setDescription("ID of the playlist")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("new_name")
            .setDescription("New name for the playlist")
            .setMaxLength(50)
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;

    try {
      if (subcommand === "save") {
        const name = interaction.options.getString("name")!;

        // Get current queue from music manager
        const session = (global as any).musicSessions?.get(guildId);
        if (!session || session.queue.length === 0) {
          const embed = new EmbedBuilder()
            .setTitle("❌ Queue Empty")
            .setDescription("There must be at least one track in the queue to save.")
            .setColor(0xef4444);

          return await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        const tracksToSave = session.queue.map((track: any) => ({
          title: track.title || "Unknown",
          url: track.url || "",
          duration: track.duration || 0,
        }));

        const playlist = await createPlaylist(guildId, userId, name, tracksToSave);

        const embed = new EmbedBuilder()
          .setTitle("✅ Playlist Saved")
          .setDescription(formatPlaylistInfo(playlist))
          .setColor(GREEN)
          .addFields({
            name: "ID",
            value: `\`${playlist.id}\``,
            inline: false,
          })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (subcommand === "load") {
        const playlistId = interaction.options.getString("playlist_id")!;

        const playlist = await getPlaylist(guildId, userId, playlistId);
        if (!playlist) {
          const embed = new EmbedBuilder()
            .setTitle("❌ Playlist Not Found")
            .setDescription("This playlist doesn't exist.")
            .setColor(0xef4444);

          return await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        // Get or create music session
        let session = (global as any).musicSessions?.get(guildId);
        if (!session) {
          const embed = new EmbedBuilder()
            .setTitle("❌ Music Not Available")
            .setDescription("Join a voice channel and try again.")
            .setColor(0xef4444);

          return await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        // Add tracks to queue
        const addedCount = playlist.tracks.length;
        session.queue.push(
          ...playlist.tracks.map((t: any) => ({
            title: t.title,
            url: t.url,
            duration: t.duration,
          })),
        );

        const embed = new EmbedBuilder()
          .setTitle("✅ Playlist Loaded")
          .setDescription(
            `Added **${addedCount}** tracks from "${playlist.name}" to the queue.`,
          )
          .setColor(GREEN)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (subcommand === "list") {
        const userPlaylists = await listPlaylists(guildId, userId);

        if (userPlaylists.length === 0) {
          const embed = new EmbedBuilder()
            .setTitle("📭 No Playlists")
            .setDescription("You haven't saved any playlists yet.")
            .setColor(CYAN);

          return await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        const playlistList = userPlaylists
          .map((p, i) => `${i + 1}. ${formatPlaylistInfo(p)}\n   ID: \`${p.id}\``)
          .join("\n\n");

        const embed = new EmbedBuilder()
          .setTitle("⭐ Your Playlists")
          .setDescription(playlistList)
          .setColor(PINK)
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      } else if (subcommand === "delete") {
        const playlistId = interaction.options.getString("playlist_id")!;

        const success = await deletePlaylist(guildId, userId, playlistId);

        if (!success) {
          const embed = new EmbedBuilder()
            .setTitle("❌ Playlist Not Found")
            .setDescription("This playlist doesn't exist.")
            .setColor(0xef4444);

          return await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("✅ Playlist Deleted")
          .setDescription("The playlist has been removed.")
          .setColor(GREEN)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (subcommand === "rename") {
        const playlistId = interaction.options.getString("playlist_id")!;
        const newName = interaction.options.getString("new_name")!;

        const playlist = await renamePlaylist(guildId, userId, playlistId, newName);

        if (!playlist) {
          const embed = new EmbedBuilder()
            .setTitle("❌ Playlist Not Found")
            .setDescription("This playlist doesn't exist.")
            .setColor(0xef4444);

          return await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("✅ Playlist Renamed")
          .setDescription(`New name: **${newName}**`)
          .setColor(GREEN)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Error in playlist command:", error);

      const embed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription(`${error}`)
        .setColor(0xef4444);

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
