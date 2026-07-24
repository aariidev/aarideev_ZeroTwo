import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { Command } from "../../types.js";
import { musicManager } from "../../music/manager.js";
import { musicNoticePayload } from "../../music/embeds.js";
import { canControlMusic } from "../../music/permissions.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("🚪 Sale del canal de voz"),
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
    if (!session) {
      await interaction.reply({
        ...musicNoticePayload("❌ No estoy en un canal de voz.", {
          kind: "error",
          client,
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const perm = await canControlMusic(member, session);
    if (!perm.ok) {
      await interaction.reply({
        ...musicNoticePayload(perm.reason, { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    session.destroy(true); // clear saved session
    await interaction.reply(
      musicNoticePayload("👋 Desconectado del canal de voz.\n¡Hasta la próxima!", {
        kind: "ok",
        client,
        banner: true,
        title: "Zero Two Music · Adiós",
      }),
    );
  },
};

export default command;
