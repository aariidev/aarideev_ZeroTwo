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
    .setName("shuffle")
    .setDescription("🔀 Mezcla la cola de reproducción"),
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
    if (!session || session.queue.length === 0) {
      await interaction.reply({
        ...musicNoticePayload("❌ La cola está vacía.", { kind: "error", client }),
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
    const n = session.shuffle();
    await interaction.reply(
      musicNoticePayload(`🔀 Cola mezclada (**${n}** pistas).`, {
        kind: "ok", client, banner: true, title: "Zero Two Music · Mezclar",
      }),
    );
  },
};
export default command;