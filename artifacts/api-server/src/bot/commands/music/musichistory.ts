/**
 * /musichistory — View recently played tracks.
 * Shows the last 20 songs that were played in the guild.
 */
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";

const CYAN = 0x22d3ee;
const PINK = 0xff2d6b;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("musichistory")
    .setDescription("📻 View recently played songs"),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;

    try {
      // Get session from global music manager
      const session = (global as any).musicSessions?.get(guildId);

      if (!session || !session.history || session.history.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle("📭 No History")
          .setDescription("No songs have been played yet in this guild.")
          .setColor(CYAN);

        return await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Get last 20 tracks from history
      const history = session.history.slice(-20).reverse();

      const historyText = history
        .map((track: any, i: number) => {
          const duration = track.duration
            ? `${Math.floor(track.duration / 60)}:${String(
                track.duration % 60,
              ).padStart(2, "0")}`
            : "?";

          return `**${i + 1}.** ${track.title || "Unknown"}\n   ⏱️ ${duration}`;
        })
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setTitle("📻 Music History")
        .setDescription(historyText || "No tracks found")
        .setColor(PINK)
        .setFooter({
          text: `Total in history: ${session.history.length}`,
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Error in musichistory command:", error);

      const embed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription("Failed to fetch music history")
        .setColor(0xef4444);

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
