import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { Command } from "../../types.js";
import { musicManager } from "../../music/manager.js";
import {
  musicEmbedFiles,
  musicNoticePayload,
  stoppedEmbed,
} from "../../music/embeds.js";
import { canControlMusic } from "../../music/permissions.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("⏹️ Detiene la música y limpia la cola"),
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
    const session = musicManager.get(interaction.guild.id);
    const perm = await canControlMusic(member, session);
    if (!perm.ok) {
      await interaction.reply({
        ...musicNoticePayload(perm.reason, { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    session!.stop();
    const files = musicEmbedFiles();
    await interaction.reply({
      embeds: [stoppedEmbed(client)],
      files: files.length ? files : undefined,
    });
  },
};

export default command;
