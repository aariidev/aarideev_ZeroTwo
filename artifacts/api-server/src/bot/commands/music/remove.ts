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
    .setName("remove")
    .setDescription("🗑️ Quita una pista de la cola por su número")
    .addIntegerOption((o) =>
      o
        .setName("posicion")
        .setDescription("Número en la cola (1 = la siguiente)")
        .setRequired(true)
        .setMinValue(1),
    ),
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

    const pos = interaction.options.getInteger("posicion", true);
    const removed = session.remove(pos);
    if (!removed) {
      await interaction.reply({
        ...musicNoticePayload(
          `❌ No hay pista en la posición **#${pos}**. Usa \`/queue\` para ver la cola.`,
          { kind: "error", client },
        ),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const { schedulePanelRefresh } = await import("../../music/panel.js");
      schedulePanelRefresh(client, interaction.guild.id);
    } catch {
      /* optional */
    }

    await interaction.reply(
      musicNoticePayload(
        `🗑️ Eliminada de la cola **#${pos}**:\n**${removed.title.slice(0, 100)}**`,
        {
          kind: "ok",
          client,
          banner: true,
          title: "Zero Two Music · Remove",
        },
      ),
    );
  },
};

export default command;
