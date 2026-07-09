import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { db, warnsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logBotEvent } from "../../../lib/botLogger.js";
import { sendModLog } from "../../lib/modlog.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription(
      "⚠️ Registra una advertencia formal en el expediente de un parásito",
    )
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Usuario a advertir")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("motivo")
        .setDescription("Especificación de la infracción")
        .setRequired(true),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const reason = interaction.options.getString("motivo", true);
    const guildId = interaction.guild?.id ?? "";

    const member = interaction.guild?.members.cache.get(target.id);
    if (member) {
      const modMember = interaction.member as any;
      if (
        modMember &&
        member.roles.highest.position >= modMember.roles.highest.position
      ) {
        return interaction.reply({
          content:
            "❌ Tus rangos no igualan o superan al del parásito seleccionado.",
          ephemeral: true,
        });
      }
    }

    const [warn] = await db
      .insert(warnsTable)
      .values({
        guildId,
        userId: target.id,
        username: target.username,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
        reason,
      })
      .returning();

    const allWarns = await db
      .select()
      .from(warnsTable)
      .where(
        and(eq(warnsTable.userId, target.id), eq(warnsTable.guildId, guildId)),
      );

    let dmSent = false;
    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setTitle(`⚠️ Has sido advertido en ${interaction.guild?.name}`)
            .setDescription(
              `\`\`\`md\n* Infracción  :: ${reason}\n* Historial    :: Infracción #${allWarns.length}\n\`\`\``,
            ),
        ],
      });
      dmSent = true;
    } catch {
      dmSent = false;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: `Expediente Criminal // Registro Central`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("⚠️ Advertencia Indexada en la Base de Datos")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        {
          name: "👤 Sujeto",
          value: `${target.tag} \`(${target.id})\``,
          inline: true,
        },
        {
          name: "🛡️ Aplicado por",
          value: `${interaction.user.tag}`,
          inline: true,
        },
        {
          name: "📊 Incidencias Totales",
          value: `\`${allWarns.length} acumuladas\``,
          inline: true,
        },
        {
          name: "📜 Justificación",
          value: `\`\`\`\n${reason}\n\`\`\``,
          inline: false,
        },
        {
          name: "📬 Alerta Directa",
          value: dmSent ? "✅ Notificado por DM" : "❌ DM Cerrado",
          inline: true,
        },
        {
          name: "🔑 Folio de Registro",
          value: `\`#${warn?.id ?? "N/A"}\``,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await sendModLog(client, interaction.guild?.id ?? "", embed);

    await logBotEvent({
      level: "warn",
      event: "warn",
      details: { reason, warnId: warn?.id, totalWarns: allWarns.length },
      guildId,
      guildName: interaction.guild?.name,
    });
  },
};

export default command;
