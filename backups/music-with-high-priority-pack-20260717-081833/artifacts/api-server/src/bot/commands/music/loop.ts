import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { Command } from "../../types.js";
import { musicManager } from "../../music/manager.js";
import { musicNoticePayload } from "../../music/embeds.js";
import { canControlMusic } from "../../music/permissions.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("🔁 Cambia el modo de loop: off → track → queue"),
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
    const perm = await canControlMusic(member, session);
    if (!perm.ok) {
      await interaction.reply({
        ...musicNoticePayload(perm.reason, { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const mode = session!.cycleLoop();
    const label =
      mode === "off" ? "Off" : mode === "track" ? "Pista 🔂" : "Cola 🔁";
    try {
      const { schedulePanelRefresh } = await import("../../music/panel.js");
      schedulePanelRefresh(client, interaction.guild.id);
    } catch {
      /* optional */
    }
    await interaction.reply(
      musicNoticePayload(`🔁 Loop: **${label}**`, {
        kind: "ok",
        client,
        banner: true,
        title: "Zero Two Music · Loop",
      }),
    );
  },
};

export default command;
