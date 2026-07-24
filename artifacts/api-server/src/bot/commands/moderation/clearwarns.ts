import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";
import { clearWarns } from "../../lib/warns.js";
import { sendModLog } from "../../lib/modlog.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clearwarns")
    .setDescription("🧹 Borra todas las advertencias de un usuario")
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Objetivo a indultar")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const guildId = interaction.guild?.id ?? "";

    if (!guildId) {
      return interaction.reply({
        content: "❌ Solo en servidores.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    let cleared = 0;
    let ids: number[] = [];
    try {
      const result = await clearWarns(guildId, target.id);
      cleared = result.cleared;
      ids = result.ids;
    } catch (err) {
      await interaction.editReply({
        content: `❌ Error al borrar en la BD: ${
          err instanceof Error ? err.message : "desconocido"
        }`,
      });
      throw err;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Purga de Expedientes Sanitarios // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(
        cleared > 0
          ? "🗑️ Amnistía de Advertencias Completada"
          : "📂 Sin advertencias que purgar",
      )
      .setThumbnail(target.displayAvatarURL())
      .setDescription(
        cleared > 0
          ? `Se han erradicado **${cleared}** advertencia(s) de la ficha de **${target.tag}** en la base **zerotwo**.`
          : `\`${target.username}\` no tenía advertencias registradas en este servidor.`,
      )
      .addFields(
        {
          name: "👤 Sujeto",
          value: `${target.username} \`(${target.id})\``,
          inline: true,
        },
        {
          name: "🛡️ Mod de Gestión",
          value: `${interaction.user.tag}`,
          inline: true,
        },
        {
          name: "🔢 Folios eliminados",
          value:
            ids.length > 0
              ? ids
                  .slice(0, 20)
                  .map((id) => `\`#${id}\``)
                  .join(", ") + (ids.length > 20 ? "…" : "")
              : "—",
          inline: false,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    if (cleared > 0) {
      await sendModLog(client, guildId, embed);
    }

    logBotEvent({
      level: "info",
      event: "purge",
      details: {
        action: "clearwarns",
        clearedCount: cleared,
        warnIds: ids,
        affectedUser: target.id,
      },
      guildId,
      guildName: interaction.guild?.name,
      userId: target.id,
      username: target.username,
      moderatorId: interaction.user.id,
      moderatorName: interaction.user.username,
    });
  },
};

export default command;
