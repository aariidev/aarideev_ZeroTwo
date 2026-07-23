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
    .setName("skip")
    .setDescription("⏭️ Salta la canción actual"),
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
    if (!session?.current) {
      await interaction.reply({
        ...musicNoticePayload("❌ No hay nada sonando.", { kind: "error", client }),
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
    const title = session.current.title;
    session.skip();
    await interaction.reply(
      musicNoticePayload(`⏭️ Saltada: **${title.slice(0, 80)}**`, {
        kind: "ok", client, banner: true, title: "Zero Two Music · Saltar",
      }),
    );
  },
};
export default command;