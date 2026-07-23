import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { Command } from "../../types.js";
import { memberVoiceChannel, musicManager } from "../../music/manager.js";
import { musicNoticePayload } from "../../music/embeds.js";

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
    const voice = memberVoiceChannel(member);
    const session = musicManager.get(interaction.guild.id);
    if (!session) {
      await interaction.reply({
        ...musicNoticePayload("❌ No hay sesión de música.", { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!voice || voice.id !== session.voiceChannelId) {
      await interaction.reply({
        ...musicNoticePayload("❌ Debes estar en el **mismo canal de voz**.", { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const mode = session.cycleLoop();
    const label = mode === "off" ? "Off" : mode === "track" ? "Pista 🔂" : "Cola 🔁";
    try {
      const { schedulePanelRefresh } = await import("../../music/panel.js");
      schedulePanelRefresh(client, interaction.guild.id);
    } catch { /* optional */ }
    await interaction.reply(
      musicNoticePayload(`🔁 Loop: **${label}**`, {
        kind: "ok", client, banner: true, title: "Zero Two Music · Loop",
      }),
    );
  },
};
export default command;