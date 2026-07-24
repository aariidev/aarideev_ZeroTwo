/**
 * /warn — comando unificado con subcomandos:
 *   /warn add    <usuario> <motivo>     → añadir advertencia
 *   /warn list   <usuario>              → listar advertencias
 *   /warn remove <id>                   → eliminar por folio
 *   /warn clear  <usuario>              → borrar todo el historial
 */
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
import {
  addWarn,
  listWarns,
  deleteWarnById,
  clearWarns,
  formatWarnTimestamp,
} from "../../lib/warns.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("⚠️ Advertencias — add, list, remove y clear")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("⚠️ Registra una advertencia formal en el expediente de un usuario")
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
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("📋 Extrae el expediente disciplinario completo de un usuario")
        .addUserOption((opt) =>
          opt
            .setName("usuario")
            .setDescription("Sujeto de consulta")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("🗑️ Elimina una advertencia concreta por su folio (#id)")
        .addIntegerOption((opt) =>
          opt
            .setName("id")
            .setDescription("Folio de la warn (aparece en /warn list como #123)")
            .setRequired(true)
            .setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("🗑️ Limpia a cero el expediente de incidencias de un usuario")
        .addUserOption((opt) =>
          opt
            .setName("usuario")
            .setDescription("Objetivo a indultar")
            .setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sub = interaction.options.getSubcommand(true) as
      | "add"
      | "list"
      | "remove"
      | "clear";
    const guildId = interaction.guild?.id ?? "";

    if (!guildId) {
      return interaction.reply({
        content: "❌ Este comando solo funciona en un servidor.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /warn add ──────────────────────────────────────────────────────────────
    if (sub === "add") {
      const target = interaction.options.getUser("usuario", true);
      const reason = interaction.options.getString("motivo", true);

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
          interaction.guild?.ownerId !== interaction.user.id
        ) {
          return interaction.reply({
            content: "❌ Tus rangos no igualan o superan al del usuario seleccionado.",
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
          }`,
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
          name: "Expediente Criminal // Registro Central",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle("⚠️ Advertencia Indexada en la Base de Datos")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "👤 Sujeto", value: `${target.tag} \`(${target.id})\``, inline: true },
          { name: "🛡️ Aplicado por", value: `${interaction.user.tag}`, inline: true },
          { name: "📊 Total acumuladas", value: `\`${allWarns.length}\``, inline: true },
          { name: "📜 Justificación", value: `\`\`\`\n${reason}\n\`\`\``, inline: false },
          { name: "📬 Alerta Directa", value: dmSent ? "✅ Notificado por DM" : "❌ DM Cerrado", inline: true },
          { name: "🔑 Folio", value: `\`#${warn.id}\``, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendModLog(client, guildId, embed);

      logBotEvent({
        level: "warn",
        event: "warn",
        details: { reason, warnId: warn.id, totalWarns: allWarns.length },
        guildId,
        guildName: interaction.guild?.name,
        userId: target.id,
        username: target.username,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
      return;
    }

    // ── /warn list ─────────────────────────────────────────────────────────────
    if (sub === "list") {
      const target = interaction.options.getUser("usuario", true);
      await interaction.deferReply();

      const userWarns = await listWarns(guildId, target.id);

      if (userWarns.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff2d6b)
              .setDescription(
                `📂 **Expediente limpio:** \`${target.username}\` no tiene advertencias en este servidor.`,
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
          ? `\n\n_…y ${userWarns.length - 15} más. Usa el dashboard o \`/warn remove\` para gestionar._`
          : "";

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: "Terminal de Registros // Zero Two",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle(`⚠️ Historial de ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(warnsText + more)
        .addFields({
          name: "📊 Total en BD",
          value: `\`${userWarns.length} faltas\``,
          inline: false,
        })
        .setFooter({ text: "Usa /warn remove <id> o /warn clear <usuario>" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── /warn remove ───────────────────────────────────────────────────────────
    if (sub === "remove") {
      const warnId = interaction.options.getInteger("id", true);
      await interaction.deferReply();

      const deleted = await deleteWarnById(guildId, warnId);
      if (!deleted) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff2d6b)
              .setDescription(
                `❌ No existe el folio \`#${warnId}\` en este servidor (o ya fue borrado).`,
              ),
          ],
        });
      }

      const remaining = await listWarns(guildId, deleted.userId);

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({ name: "Archivo // Borrado de Folio", iconURL: client.user?.displayAvatarURL() })
        .setTitle(`🗑️ Advertencia #${deleted.id} eliminada`)
        .addFields(
          { name: "👤 Usuario", value: `<@${deleted.userId}> \`(${deleted.userId})\``, inline: true },
          { name: "🛡️ Eliminado por", value: interaction.user.tag, inline: true },
          { name: "📜 Motivo original", value: `\`\`\`\n${deleted.reason}\n\`\`\`` },
          { name: "📊 Warns restantes", value: `\`${remaining.length}\``, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendModLog(client, guildId, embed);

      logBotEvent({
        level: "info",
        event: "purge",
        details: { action: "delwarn", warnId: deleted.id, remaining: remaining.length },
        guildId,
        guildName: interaction.guild?.name,
        userId: deleted.userId,
        username: deleted.username,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
      return;
    }

    // ── /warn clear ────────────────────────────────────────────────────────────
    if (sub === "clear") {
      const target = interaction.options.getUser("usuario", true);
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
          name: "Purga de Expedientes // Zero Two",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle(
          cleared > 0 ? "🗑️ Historial borrado" : "📂 Sin advertencias que purgar",
        )
        .setThumbnail(target.displayAvatarURL())
        .setDescription(
          cleared > 0
            ? `Se han eliminado **${cleared}** advertencia(s) de **${target.tag}**.`
            : `\`${target.username}\` no tenía advertencias en este servidor.`,
        )
        .addFields(
          { name: "👤 Sujeto", value: `${target.username} \`(${target.id})\``, inline: true },
          { name: "🛡️ Mod de Gestión", value: interaction.user.tag, inline: true },
          {
            name: "🔢 Folios eliminados",
            value:
              ids.length > 0
                ? ids.slice(0, 20).map((id) => `\`#${id}\``).join(", ") +
                  (ids.length > 20 ? "…" : "")
                : "—",
            inline: false,
          },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      if (cleared > 0) await sendModLog(client, guildId, embed);

      logBotEvent({
        level: "info",
        event: "purge",
        details: { action: "clearwarns", clearedCount: cleared, warnIds: ids },
        guildId,
        guildName: interaction.guild?.name,
        userId: target.id,
        username: target.username,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
    }
  },
};

export default command;
