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
import { deleteWarnById, listWarns } from "../../lib/warns.js";
import { sendModLog } from "../../lib/modlog.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("delwarn")
    .setDescription("🗑️ Elimina una advertencia concreta por su folio (#id)")
    .addIntegerOption((opt) =>
      opt
        .setName("id")
        .setDescription("Folio de la warn (aparece en /warns como #123)")
        .setRequired(true)
        .setMinValue(1),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const warnId = interaction.options.getInteger("id", true);
    const guildId = interaction.guild?.id ?? "";

    if (!guildId) {
      return interaction.reply({
        content: "❌ Solo en servidores.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const deleted = await deleteWarnById(guildId, warnId);
    if (!deleted) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              `❌ No existe el folio \`#${warnId}\` en este servidor (o ya fue borrado).\nUsa \`/warns usuario:@user\` para ver los ids actuales.`,
            ),
        ],
      });
    }

    const remaining = await listWarns(guildId, deleted.userId);

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Archivo // Borrado de Folio",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(`🗑️ Advertencia #${deleted.id} eliminada`)
      .addFields(
        {
          name: "👤 Usuario",
          value: `<@${deleted.userId}> \`(${deleted.userId})\``,
          inline: true,
        },
        {
          name: "🛡️ Eliminado por",
          value: `${interaction.user.tag}`,
          inline: true,
        },
        {
          name: "📜 Motivo original",
          value: `\`\`\`\n${deleted.reason}\n\`\`\``,
        },
        {
          name: "📊 Warns restantes",
          value: `\`${remaining.length}\``,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await sendModLog(client, guildId, embed);

    logBotEvent({
      level: "info",
      event: "purge",
      details: {
        action: "delwarn",
        warnId: deleted.id,
        reason: deleted.reason,
        remaining: remaining.length,
      },
      guildId,
      guildName: interaction.guild?.name,
      userId: deleted.userId,
      username: deleted.username,
      moderatorId: interaction.user.id,
      moderatorName: interaction.user.username,
    });
  },
};

export default command;
