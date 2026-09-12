/**
 * /modhistory — View complete infraction history for a user.
 * Shows warns, reasons, dates, and moderators.
 */
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
  User,
} from "discord.js";
import { Command } from "../../types.js";
import { getInfractionHistory, checkAndApplyEscalation } from "../../lib/escalation.js";

const PINK = 0xff2d6b;
const CYAN = 0x22d3ee;
const RED = 0xef4444;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("modhistory")
    .setDescription("📋 View user infraction history")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("User to check history for")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user")!;
    const guildId = interaction.guildId!;

    try {
      await interaction.deferReply();

      const history = await getInfractionHistory(guildId, user.id);

      if (history.total === 0) {
        const embed = new EmbedBuilder()
          .setTitle("✅ Clean Record")
          .setDescription(`${user.username} has no infractions.`)
          .setColor(0x22c55e)
          .setThumbnail(user.avatarURL())
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
      }

      const recentWarns = history.recent
        .map(
          (w, i) =>
            `**${i + 1}.** ${w.date} — ${w.reason}\n   *by ${w.moderator}*`,
        )
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setTitle(`📋 Infraction History — ${user.username}`)
        .setDescription(`**Total infractions:** ${history.total}`)
        .addFields(
          {
            name: "Recent Infractions",
            value: recentWarns || "No infractions",
          },
        )
        .setColor(history.total > 5 ? RED : PINK)
        .setThumbnail(user.avatarURL())
        .setTimestamp();

      if (history.total > 10) {
        embed.setFooter({
          text: `Showing 10 of ${history.total} infractions`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in modhistory command:", error);

      const embed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription("Failed to fetch infraction history")
        .setColor(RED);

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
