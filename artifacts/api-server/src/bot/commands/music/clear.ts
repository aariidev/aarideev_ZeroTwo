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
    .setName("clear")
    .setDescription("🗑️ Vacía la cola (la canción actual sigue sonando)"),
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

    const session = musicManager.get(interaction.guild.id);
    const member = interaction.member as GuildMember;
    const perm = await canControlMusic(member, session);
    if (!perm.ok) {
      await interaction.reply({
        ...musicNoticePayload(perm.reason, { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!session) return;

    const n = session.clearQueue();
    try {
      const { schedulePanelRefresh } = await import("../../music/panel.js");
      schedulePanelRefresh(client, interaction.guild.id);
    } catch {
      /* optional */
    }

    await interaction.reply(
      musicNoticePayload(
        n
          ? `🗑️ Cola vaciada: **${n}** pista(s) eliminadas.\nLa canción actual sigue en reproducción.`
          : "📭 La cola ya estaba vacía.",
        {
          kind: n ? "ok" : "info",
          client,
          banner: true,
          title: "Zero Two Music · Clear",
        },
      ),
    );
  },
};

export default command;
