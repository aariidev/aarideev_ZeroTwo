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
    .setName("shuffle")
    .setDescription("🔀 Mezcla la cola de reproducción"),
  cooldown: 2,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "❌ Solo en servidores.", flags: MessageFlags.Ephemeral });
      return;
    }
    const member = interaction.member as GuildMember;
    const voice = memberVoiceChannel(member);
    const session = musicManager.get(interaction.guild.id);
    if (!session?.queue.length) {
      await interaction.reply({ content: "❌ La cola está vacía.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!voice || voice.id !== session.voiceChannelId) {
      await interaction.reply({
        content: "❌ Debes estar en el mismo canal de voz.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const n = session.shuffle();
    await interaction.reply({ content: `🔀 Cola mezclada (**${n}** pistas).` });
  },
};

export default command;
