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
    .setName("pause")
    .setDescription("⏸️ Pausa / reanuda la reproducción"),
  cooldown: 1,

  async execute(interaction: ChatInputCommandInteraction) {
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
        content: "❌ Debes estar en el mismo canal de voz.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (session.paused) {
      session.resume();
      await interaction.reply({ content: "▶️ Reproducción reanudada." });
    } else {
      session.pause();
      await interaction.reply({ content: "⏸️ Pausado." });
    }
  },
};

export default command;
