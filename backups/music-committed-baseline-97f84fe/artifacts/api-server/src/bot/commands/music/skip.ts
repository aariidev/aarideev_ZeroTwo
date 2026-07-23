import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { Command } from "../../types.js";
import { memberVoiceChannel, musicManager } from "../../music/manager.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("⏭️ Salta la canción actual"),
  cooldown: 1,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({ content: "❌ Solo en servidores.", flags: MessageFlags.Ephemeral });
      return;
    }
    const member = interaction.member as GuildMember;
    const voice = memberVoiceChannel(member);
    const session = musicManager.get(interaction.guild.id);
    if (!session?.current) {
      await interaction.reply({ content: "❌ No hay nada sonando.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!voice || voice.id !== session.voiceChannelId) {
      await interaction.reply({
        content: "❌ Debes estar en el mismo canal de voz que el bot.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const title = session.current.title;
    session.skip();
    await interaction.reply({ content: `⏭️ Saltada: **${title.slice(0, 80)}**` });
  },
};

export default command;
