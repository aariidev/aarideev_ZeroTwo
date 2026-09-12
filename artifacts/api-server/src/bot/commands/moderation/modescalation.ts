/**
 * /modescalation — Configure automatic warn escalation rules.
 * Admins can set thresholds for auto-mute, auto-kick, auto-ban.
 */
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getEscalationConfig,
  setEscalationConfig,
} from "../../lib/escalation.js";

const PINK = 0xff2d6b;
const CYAN = 0x22d3ee;
const GREEN = 0x22c55e;
const AMBER = 0xf59e0b;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("modescalation")
    .setDescription("⚙️ Configure automatic warn escalation rules")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Set escalation thresholds")
        .addIntegerOption((o) =>
          o
            .setName("mute_at")
            .setDescription("Auto-mute user after X warns")
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("kick_at")
            .setDescription("Auto-kick user after X warns")
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("ban_at")
            .setDescription("Auto-ban user after X warns")
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(true),
        )
        .addChannelOption((o) =>
          o
            .setName("notify_channel")
            .setDescription("Channel to notify when escalation actions are taken")
            .setRequired(false),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("status")
        .setDescription("View current escalation configuration"),
    )
    .addSubcommand((s) =>
      s
        .setName("toggle")
        .setDescription("Enable or disable automatic escalation")
        .addBooleanOption((o) =>
          o
            .setName("enabled")
            .setDescription("Enable escalation?")
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      if (subcommand === "set") {
        const muteAt = interaction.options.getInteger("mute_at")!;
        const kickAt = interaction.options.getInteger("kick_at")!;
        const banAt = interaction.options.getInteger("ban_at")!;
        const notifyChannel = interaction.options.getChannel("notify_channel");

        // Validate order
        if (muteAt >= kickAt || kickAt >= banAt) {
          const embed = new EmbedBuilder()
            .setTitle("❌ Invalid Configuration")
            .setDescription(
              "Thresholds must be in order: `mute_at < kick_at < ban_at`",
            )
            .setColor(0xef4444)
            .addFields(
              { name: "Your values", value: `Mute: ${muteAt}, Kick: ${kickAt}, Ban: ${banAt}` },
            );

          return await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        await setEscalationConfig(guildId, {
          muteAt,
          kickAt,
          banAt,
          notifyChannel: notifyChannel?.id,
        });

        const embed = new EmbedBuilder()
          .setTitle("✅ Escalation Rules Updated")
          .setColor(GREEN)
          .addFields(
            { name: "🔇 Auto-Mute", value: `After ${muteAt} warns (1 hour)`, inline: true },
            { name: "👢 Auto-Kick", value: `After ${kickAt} warns`, inline: true },
            { name: "🔨 Auto-Ban", value: `After ${banAt} warns`, inline: true },
            {
              name: "📢 Notification Channel",
              value: notifyChannel ? `<#${notifyChannel.id}>` : "Disabled",
            },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (subcommand === "status") {
        const config = await getEscalationConfig(guildId);

        const embed = new EmbedBuilder()
          .setTitle("⚙️ Current Escalation Configuration")
          .setColor(CYAN)
          .addFields(
            { name: "Status", value: config.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
            { name: "🔇 Auto-Mute At", value: `${config.muteAt} warns`, inline: true },
            { name: "👢 Auto-Kick At", value: `${config.kickAt} warns`, inline: true },
            { name: "🔨 Auto-Ban At", value: `${config.banAt} warns`, inline: true },
            {
              name: "📢 Notification Channel",
              value: config.notifyChannel ? `<#${config.notifyChannel}>` : "Not set",
            },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (subcommand === "toggle") {
        const enabled = interaction.options.getBoolean("enabled")!;

        await setEscalationConfig(guildId, { enabled });

        const embed = new EmbedBuilder()
          .setTitle("✅ Escalation System Updated")
          .setDescription(
            enabled
              ? "🟢 Automatic escalation is now **enabled**"
              : "🔴 Automatic escalation is now **disabled**",
          )
          .setColor(enabled ? GREEN : AMBER)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Error in modescalation command:", error);

      const embed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription("Failed to update escalation configuration")
        .setColor(0xef4444);

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
