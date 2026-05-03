import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { db } from "@workspace/db";
import { logsTable } from "@workspace/db";
import { desc, eq, and, or, like } from "drizzle-orm";

const EVENT_CHOICES = [
  { name: "Ban", value: "ban" },
  { name: "Kick", value: "kick" },
  { name: "Warn", value: "warn" },
  { name: "Timeout", value: "timeout" },
  { name: "Untimeout", value: "untimeout" },
  { name: "Unban", value: "unban" },
  { name: "Lock", value: "lock" },
  { name: "Unlock", value: "unlock" },
  { name: "Slowmode", value: "slowmode" },
  { name: "Purge", value: "purge" },
];

const EVENT_EMOJI: Record<string, string> = {
  ban: "🔨", kick: "👢", warn: "⚠️", timeout: "⏳",
  untimeout: "✅", unban: "🔓", lock: "🔒", unlock: "🔓",
  slowmode: "🐢", purge: "🗑️",
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription("📋 Sistema de logs de moderación")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("ver")
        .setDescription("📋 Ver los logs de moderación de este servidor")
        .addStringOption((opt) =>
          opt
            .setName("tipo")
            .setDescription("Filtrar por tipo de acción")
            .setRequired(false)
            .addChoices(...EVENT_CHOICES)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("cantidad")
            .setDescription("Número de logs a mostrar (máx. 10, default: 5)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("buscar")
        .setDescription("🔍 Buscar logs por nombre de usuario o moderador")
        .addStringOption((opt) =>
          opt
            .setName("usuario")
            .setDescription("Nombre del usuario o moderador a buscar")
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("cantidad")
            .setDescription("Número de logs a mostrar (máx. 10, default: 5)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("borrar")
        .setDescription("🗑️ Borrar todos los logs de moderación de este servidor")
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild?.id ?? "";

    if (sub === "ver") {
      await interaction.deferReply();
      const tipo = interaction.options.getString("tipo");
      const cantidad = interaction.options.getInteger("cantidad") ?? 5;

      const conditions = [eq(logsTable.guildId, guildId)];
      if (tipo) conditions.push(eq(logsTable.event, tipo));

      const logs = await db
        .select()
        .from(logsTable)
        .where(and(...conditions))
        .orderBy(desc(logsTable.createdAt))
        .limit(cantidad);

      if (logs.length === 0) {
        const empty = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("📋 Logs de Moderación")
          .setDescription(
            tipo
              ? `No hay logs del tipo **${tipo}** en este servidor.`
              : "No hay logs de moderación en este servidor."
          )
          .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() })
          .setTimestamp();
        return interaction.editReply({ embeds: [empty] });
      }

      const embed = new EmbedBuilder()
        .setColor(0xec4899)
        .setTitle(`📋 Logs de Moderación${tipo ? ` · ${tipo.toUpperCase()}` : ""}`)
        .setDescription(`Mostrando los últimos **${logs.length}** eventos en **${interaction.guild?.name}**`)
        .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

      for (const log of logs) {
        const emoji = EVENT_EMOJI[log.event] ?? "📌";
        const details = (() => { try { return JSON.parse(log.details ?? "{}"); } catch { return {}; } })();
        const reason = details.reason ? `\n> ${details.reason}` : "";
        const date = `<t:${Math.floor(new Date(log.createdAt).getTime() / 1000)}:R>`;

        embed.addFields({
          name: `${emoji} ${log.event.toUpperCase()} ${date}`,
          value: [
            `**Usuario:** ${log.username ?? "—"} \`${log.userId ?? "—"}\``,
            `**Moderador:** ${log.moderatorName ?? "—"}`,
            reason,
          ].filter(Boolean).join("\n"),
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === "buscar") {
      await interaction.deferReply();
      const query = interaction.options.getString("usuario", true);
      const cantidad = interaction.options.getInteger("cantidad") ?? 5;

      const logs = await db
        .select()
        .from(logsTable)
        .where(
          and(
            eq(logsTable.guildId, guildId),
            or(
              like(logsTable.username, `%${query}%`),
              like(logsTable.moderatorName, `%${query}%`)
            )!
          )
        )
        .orderBy(desc(logsTable.createdAt))
        .limit(cantidad);

      if (logs.length === 0) {
        const empty = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle("🔍 Búsqueda en Logs")
          .setDescription(`No se encontraron logs para **${query}** en este servidor.`)
          .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() })
          .setTimestamp();
        return interaction.editReply({ embeds: [empty] });
      }

      const embed = new EmbedBuilder()
        .setColor(0xec4899)
        .setTitle(`🔍 Logs · "${query}"`)
        .setDescription(`**${logs.length}** resultado(s) en **${interaction.guild?.name}**`)
        .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

      for (const log of logs) {
        const emoji = EVENT_EMOJI[log.event] ?? "📌";
        const details = (() => { try { return JSON.parse(log.details ?? "{}"); } catch { return {}; } })();
        const reason = details.reason ? `\n> ${details.reason}` : "";
        const date = `<t:${Math.floor(new Date(log.createdAt).getTime() / 1000)}:R>`;

        embed.addFields({
          name: `${emoji} ${log.event.toUpperCase()} ${date}`,
          value: [
            `**Usuario:** ${log.username ?? "—"} \`${log.userId ?? "—"}\``,
            `**Moderador:** ${log.moderatorName ?? "—"}`,
            reason,
          ].filter(Boolean).join("\n"),
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === "borrar") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setDescription("❌ Necesitas permisos de **Administrador** para borrar los logs."),
          ],
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const allLogs = await db
        .select()
        .from(logsTable)
        .where(eq(logsTable.guildId, guildId));

      const count = allLogs.length;

      await db.delete(logsTable).where(eq(logsTable.guildId, guildId));

      const embed = new EmbedBuilder()
        .setColor(0x00ff99)
        .setTitle("🗑️ Logs Borrados")
        .setDescription(`Se eliminaron **${count}** evento(s) de moderación de este servidor.`)
        .setFooter({ text: `Por ${interaction.user.tag} · ZeroTwo v2.1.0`, iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
