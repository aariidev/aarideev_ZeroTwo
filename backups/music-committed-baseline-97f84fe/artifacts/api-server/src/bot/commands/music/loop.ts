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
    .setName("loop")
    .setDescription("🔁 Cambia el modo de loop: off → track → queue"),
  cooldown: 1,

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
        content: "❌ Debes estar en el mismo canal de voz.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const mode = session.cycleLoop();
    const label =
      mode === "off" ? "➡️ Off" : mode === "track" ? "🔂 Track" : "🔁 Queue";
    await interaction.reply({ content: `Loop: **${label}**` });
  },
};

export default command;
