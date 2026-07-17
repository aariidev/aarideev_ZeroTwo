import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../types.js";
import { formatWarnTimestamp, listWarns } from "../../lib/warns.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warns")
    .setDescription(
      "📋 Extrae el expediente disciplinario completo de un parásito",
    )
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Sujeto de consulta")
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

    const userWarns = await listWarns(guildId, target.id);

    if (userWarns.length === 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              `📂 **Expediente limpio:** \`${target.username}\` no tiene advertencias guardadas en **zerotwo** para este servidor.`,
            ),
        ],
      });
    }

    const warnsText = userWarns
      .slice(0, 15)
      .map(
        (w, i) =>
          `\`#${w.id}\` **#${i + 1}** • ${formatWarnTimestamp(w.createdAt)}\n` +
          `└ **Causa:** \`${w.reason.slice(0, 200)}\`\n` +
          `└ **Operador:** <@${w.moderatorId}>`,
      )
      .join("\n\n");

    const more =
      userWarns.length > 15
        ? `\n\n_…y ${userWarns.length - 15} más (usa el dashboard o borra con /delwarn /clearwarns)._`
        : "";

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Terminal de Registros Centrales // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(`⚠️ Historial de Incidencias de ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(warnsText + more)
      .addFields({
        name: "📊 Total en BD",
        value: `\`${userWarns.length} faltas\` · HeidiSQL \`zerotwo.warns\``,
        inline: false,
      })
      .setFooter({
        text: "The Garden · Archivo de Conducta · /delwarn id: · /clearwarns",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
