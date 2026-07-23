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
    .setName("stop")
    .setDescription("⏹️ Detiene la música y limpia la cola"),
  cooldown: 2,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "❌ Solo en servidores.", flags: MessageFlags.Ephemeral });
      return;
    }
    const member = interaction.member as GuildMember;
    const voice = memberVoiceChannel(member);
    const session = musicManager.get(interaction.guild.id);
    if (!session) {
      await interaction.reply({ content: "❌ No hay sesión de música.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!voice || voice.id !== session.voiceChannelId) {
      await interaction.reply({
        content: "❌ Debes estar en el mismo canal de voz que el bot.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    session.stop();
    await interaction.reply({ content: "⏹️ Música detenida y cola vaciada." });
  },
};

export default command;
