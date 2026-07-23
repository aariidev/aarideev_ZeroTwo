import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { Command } from "../../types.js";
import { memberVoiceChannel, musicManager } from "../../music/manager.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("🚪 Desconecta el bot del canal de voz"),
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
      await interaction.reply({ content: "❌ No estoy en un canal de voz.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (voice && session.voiceChannelId && voice.id !== session.voiceChannelId) {
      await interaction.reply({
        content: "❌ Debes estar en el mismo canal de voz (o vacío).",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    session.destroy();
    await interaction.reply({ content: "👋 Desconectado. ¡Hasta la próxima!" });
  },
};

export default command;
