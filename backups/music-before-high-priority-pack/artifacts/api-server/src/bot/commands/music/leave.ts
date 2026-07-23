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
    .setName("leave")
    .setDescription("🚪 Desconecta el bot del canal de voz"),
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
        ...musicNoticePayload("❌ No estoy en un canal de voz.", { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (voice && session.voiceChannelId && voice.id !== session.voiceChannelId) {
      await interaction.reply({
        ...musicNoticePayload("❌ Debes estar en el **mismo canal de voz** (o ninguno).", { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    session.destroy();
    await interaction.reply(
      musicNoticePayload("👋 Desconectado del canal de voz.\n¡Hasta la próxima!", {
        kind: "ok", client, banner: true, title: "Zero Two Music · Adiós",
      }),
    );
  },
};
export default command;