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
    .setName("volume")
    .setDescription("🔊 Cambia el volumen del bot (0–150)")
    .addIntegerOption((o) =>
      o.setName("nivel").setDescription("Volumen 0–150").setRequired(true).setMinValue(0).setMaxValue(150),
    ),
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
    const nivel = interaction.options.getInteger("nivel", true);
    const v = session.setVolume(nivel);
    try {
      const { schedulePanelRefresh } = await import("../../music/panel.js");
      schedulePanelRefresh(client, interaction.guild.id);
    } catch { /* optional */ }
    await interaction.reply(
      musicNoticePayload(`🔊 Volumen ajustado a **${v}%**`, {
        kind: "ok", client, banner: true, title: "Zero Two Music · Volumen",
      }),
    );
  },
};
export default command;