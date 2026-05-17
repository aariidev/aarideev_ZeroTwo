import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { db, warnsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

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
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const guildId = interaction.guild?.id ?? "";

    const userWarns = await db
      .select()
      .from(warnsTable)
      .where(
        and(eq(warnsTable.userId, target.id), eq(warnsTable.guildId, guildId)),
      )
      .orderBy(desc(warnsTable.createdAt));

    if (userWarns.length === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              `📂 **Expediente Impecable:** \`${target.username}\` no cuenta con infracciones en la base de datos central.`,
            ),
        ],
        ephemeral: true,
      });
    }

    const warnsText = userWarns
      .slice(0, 10)
      .map(
        (w, i) =>
          `\`#${w.id}\` **Infracción ${i + 1}** • <t:${Math.floor(w.createdAt!.getTime() / 1000)}:R>\n` +
          `└ **Causa:** \`${w.reason}\`\n` +
          `└ **Operador:** <@${w.moderatorId}>`,
      )
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Terminal de Registros Centrales // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(`⚠️ Historial de Incidencias de ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(warnsText)
      .addFields({
        name: "📊 Total Acumulados",
        value: `\`${userWarns.length} faltas registradas\``,
        inline: false,
      })
      .setFooter({ text: "The Garden · Archivo de Conducta Humana" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
