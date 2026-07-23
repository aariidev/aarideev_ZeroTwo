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
    .setName("volume")
    .setDescription("🔊 Cambia el volumen (0–150)")
    .addIntegerOption((o) =>
      o
        .setName("nivel")
        .setDescription("Volumen 0-150")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(150),
    ),
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
    const v = session.setVolume(interaction.options.getInteger("nivel", true));
    await interaction.reply({ content: `🔊 Volumen: **${v}%**` });
  },
};

export default command;
