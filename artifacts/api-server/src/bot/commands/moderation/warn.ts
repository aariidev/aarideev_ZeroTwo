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
import { sendModLog } from "../../lib/modlog.js";
import { addWarn, listWarns } from "../../lib/warns.js";

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
        .setRequired(true)
        .setMaxLength(900),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const reason = interaction.options.getString("motivo", true);
    const guildId = interaction.guild?.id ?? "";

    if (!guildId) {
      return interaction.reply({
        content: "❌ Este comando solo funciona en un servidor.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (target.bot) {
      return interaction.reply({
        content: "❌ No puedes advertir a un bot.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const member = interaction.guild?.members.cache.get(target.id);
    if (member) {
      const modMember = interaction.member as {
        roles?: { highest?: { position: number } };
      } | null;
      if (
        modMember?.roles?.highest &&
        member.roles.highest.position >= modMember.roles.highest.position &&
        interaction.guild.ownerId !== interaction.user.id
      ) {
        return interaction.reply({
          content:
            "❌ Tus rangos no igualan o superan al del parásito seleccionado.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    await interaction.deferReply();

    let warn;
    try {
      warn = await addWarn({
        guildId,
        userId: target.id,
        username: target.username,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
        reason,
      });
    } catch (err) {
      await interaction.editReply({
        content: `❌ **Error al guardar en la base de datos**\n${
          err instanceof Error ? err.message : "Fallo desconocido"
        }\nComprueba que MySQL (zerotwo) esté en marcha.`,
      });
      throw err;
    }

    const allWarns = await listWarns(guildId, target.id);

    let dmSent = false;
    try {
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setTitle(`⚠️ Has sido advertido en ${interaction.guild?.name}`)
            .setDescription(
              `\`\`\`md\n* Infracción  :: ${reason}\n* Historial    :: Infracción #${allWarns.length}\n* Folio        :: #${warn.id}\n\`\`\``,
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
          value: `\`#${warn.id}\` · guardado en **zerotwo**`,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await sendModLog(client, guildId, embed);

    logBotEvent({
      level: "warn",
      event: "warn",
      details: {
        reason,
        warnId: warn.id,
        totalWarns: allWarns.length,
        persisted: true,
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
