import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { Command } from "../../types.js";
import { memberVoiceChannel, musicManager } from "../../music/manager.js";
import { musicEmbedFiles, musicNoticePayload, stoppedEmbed } from "../../music/embeds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("⏹️ Detiene la reproducción y vacía la cola"),
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
        ...musicNoticePayload("❌ Debes estar en el **mismo canal de voz** que el bot.", { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    session.stop();
    const files = musicEmbedFiles();
    await interaction.reply({
      embeds: [stoppedEmbed(client)],
      files: files.length ? files : undefined,
    });
  },
};
export default command;