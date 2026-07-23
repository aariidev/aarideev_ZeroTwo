import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types.js";
import { db, logsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";

const EVENT_EMOJI: Record<string, string> = {
  ban: "🔨",
  kick: "👢",
  warn: "⚠️",
  timeout: "⏳",
  untimeout: "✅",
  unban: "🔓",
  lock: "🔒",
  unlock: "🔓",
  slowmode: "🐢",
  purge: "🗑️",
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription(
      "📋 Central de Diagnóstico: Revisa el historial operativo de sanciones",
    )
    .addSubcommand((sub) =>
      sub
        .setName("ver")
        .setDescription("Despliega los expedientes interactivos de moderación")
        .addStringOption((opt) =>
          opt
            .setName("evento")
            .setDescription("Filtrar por tipo")
            .addChoices(
              { name: "Bans", value: "ban" },
              { name: "Kicks", value: "kick" },
              { name: "Warns", value: "warn" },
              { name: "Locks", value: "lock" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("borrar")
        .setDescription("Limpia la base de datos de logs del servidor"),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild?.id ?? "";

    if (sub === "ver") {
      await interaction.deferReply();
      const eventFilter = interaction.options.getString("evento");

      let query = db
        .select()
        .from(logsTable)
        .where(eq(logsTable.guildId, guildId))
        .orderBy(desc(logsTable.createdAt));
      let rows = await query;

      if (eventFilter) {
        rows = rows.filter((r) => r.event === eventFilter);
      }

      if (rows.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff2d6b)
              .setDescription(
                "📂 **Expediente Limpio:** No se registran incidencias bajo los filtros indicados.",
              ),
          ],
        });
        return;
      }

      // Configuración de paginación (5 logs por página)
      const itemsPerPage = 5;
      const totalPages = Math.ceil(rows.length / itemsPerPage);
      let currentPage = 0;

      const buildEmbed = (page: number) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = rows.slice(start, end);

        const embed = new EmbedBuilder()
          .setColor(0xff2d6b)
          .setAuthor({
            name: "Reporte Crítico de Eventos // Control Central",
            iconURL: client.user?.displayAvatarURL(),
          })
          .setTitle(`📋 Registros de Sanciones Encontrados (${rows.length})`)
          .setFooter({
            text: `Página ${page + 1} de ${totalPages} · Archivos de Datos`,
            iconURL: client.user?.displayAvatarURL(),
          })
          .setTimestamp();

        pageItems.forEach((log) => {
          const emoji = EVENT_EMOJI[log.event ?? ""] ?? "📌";
          const date = log.createdAt
            ? `<t:${Math.floor(new Date(log.createdAt).getTime() / 1000)}:d>`
            : "";
          const details: any = log.details ?? {};

          embed.addFields({
            name: `${emoji} ${log.event?.toUpperCase()} — ${date}`,
            value: `• **Sujeto:** ${log.username ?? "Desconocido"} \`(${log.userId ?? "N/A"})\`\n• **Operador:** ${log.moderatorName ?? "Sistema"}\n• **Motivo:** \`${details.reason ?? "Sin especificar"}\``,
          });
        });

        return embed;
      };

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("⬅️ Anterior")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Siguiente ➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(totalPages === 1),
      );

      const msg = await interaction.editReply({
        embeds: [buildEmbed(currentPage)],
        components: [buttons],
      });
      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 90_000,
      });

      collector.on("collect", async (btnInt) => {
        if (btnInt.user.id !== interaction.user.id) {
          await btnInt.reply({
            content: "❌ Panel bloqueado para tu firma digital.",
            ephemeral: true,
          });
          return;
        }

        if (btnInt.customId === "prev") currentPage--;
        if (btnInt.customId === "next") currentPage++;

        buttons.components[0]!.setDisabled(currentPage === 0);
        buttons.components[1]!.setDisabled(currentPage === totalPages - 1);

        await btnInt.update({
          embeds: [buildEmbed(currentPage)],
          components: [buttons],
        });
      });

      collector.on("end", () => {
        buttons.components.forEach((b) => b.setDisabled(true));
        interaction.editReply({ components: [buttons] }).catch(() => null);
      });
    }

    if (sub === "borrar") {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          content: "❌ Permiso denegado. Requiere rango: `Administrador`.",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      await db.delete(logsTable).where(eq(logsTable.guildId, guildId));

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setTitle("🗑️ Base de Datos Purgada")
            .setDescription(
              "Todos los logs locales del escuadrón han sido erradicados con éxito.",
            ),
        ],
      });
    }
  },
};

export default command;
