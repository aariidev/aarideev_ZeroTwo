/**
 * /cfglogs — canal de logs + vista bonita del catálogo de eventos.
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getGuildLogSettings,
  getLogChannelId,
  LOG_CATEGORIES,
  LOG_EVENT_META,
  LOG_EMOJI,
  LOG_COLORS,
  removeLogChannel,
  setLogChannelId,
  setLogEvents,
  type LogEventKey,
} from "../../lib/modlog.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;
const GREEN = 0x22c55e;

function statusEmbed(
  client: Client,
  guildId: string,
  channelId: string | null,
  events: LogEventKey[],
  guildName?: string,
) {
  const enabled = new Set(events);
  const lines = LOG_CATEGORIES.map((cat) => {
    const parts = cat.events.map((ev) => {
      const on = enabled.has(ev);
      return `${on ? "🟢" : "⚫"} ${LOG_EMOJI[ev]} ${LOG_EVENT_META[ev].label}`;
    });
    return `**${cat.label}**\n${parts.join("\n")}`;
  });

  return new EmbedBuilder()
    .setColor(channelId ? GREEN : PINK)
    .setAuthor({
      name: "Zero Two · Central de Logs",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle(channelId ? "📡 Logs configurados" : "📡 Logs sin canal")
    .setDescription(
      [
        channelId
          ? `Canal: <#${channelId}>`
          : "No hay canal. Usa `/cfglogs set`.",
        "",
        `Eventos activos: **${events.length}** / **${Object.keys(LOG_EVENT_META).length}**`,
        guildName ? `Servidor: **${guildName}**` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .addFields(
      lines.slice(0, 5).map((v, i) => ({
        name: LOG_CATEGORIES[i]!.label,
        value: v.replace(`**${LOG_CATEGORIES[i]!.label}**\n`, "") || "—",
        inline: true,
      })),
    )
    .setFooter({
      text: `Zero Two ${BOT_VERSION} · Panel: elige categoría para activar TODOS sus eventos`,
    })
    .setTimestamp();
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("cfglogs")
    .setDescription("📡 Canal y catálogo de logs del servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Define el canal donde se enviarán los logs")
        .addChannelOption((opt) =>
          opt
            .setName("canal")
            .setDescription("Canal de destino para los logs")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
            )
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Desactiva el envío de logs al canal configurado"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Muestra canal + eventos activos (panel interactivo)"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("enable-all")
        .setDescription("Activa TODOS los eventos de log"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("defaults")
        .setDescription("Restaura el set de eventos por defecto (recomendado)"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("backfill")
        .setDescription(
          "📥 Indexa el historial de mensajes (para logs de borrado/edición)",
        )
        .addIntegerOption((o) =>
          o
            .setName("limite")
            .setDescription(
              "Máx. mensajes por canal (default 1000, máx 5000)",
            )
            .setMinValue(50)
            .setMaxValue(5000)
            .setRequired(false),
        )
        .addChannelOption((o) =>
          o
            .setName("canal")
            .setDescription("Solo este canal (si omites: todos los de texto)")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("index-status")
        .setDescription("📊 Cuántos mensajes tiene Zero Two indexados en BD"),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild?.id ?? "";
    if (!guildId) {
      await interaction.reply({
        content: "❌ Solo en servidores.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "set") {
      const channel = interaction.options.getChannel("canal", true);
      await setLogChannelId(guildId, channel.id);
      const settings = await getGuildLogSettings(guildId);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setAuthor({
              name: "Zero Two · Central de Logs",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTitle("📡 Canal de logs configurado")
            .setDescription(
              [
                `Los registros se enviarán a <#${channel.id}>.`,
                "",
                "• `/cfglogs status` — ver y activar categorías",
                "• Dashboard → Servidores — filtros finos (bots, canales ignorados…)",
              ].join("\n"),
            )
            .addFields(
              { name: "📌 Canal", value: `<#${channel.id}>`, inline: true },
              {
                name: "🔔 Eventos activos",
                value: `\`${settings.events.length}\``,
                inline: true,
              },
              {
                name: "🛡️ Por",
                value: `${interaction.user}`,
                inline: true,
              },
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION}` })
            .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "disable") {
      const existing = await getLogChannelId(guildId);
      if (!existing) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ No hay canal de logs configurado."),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await removeLogChannel(guildId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setTitle("📡 Logs desactivados")
            .setDescription(
              "Ya no se enviarán embeds al canal de logs. La configuración de eventos se conserva.",
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "enable-all") {
      const all = Object.keys(LOG_EVENT_META) as LogEventKey[];
      await setLogEvents(guildId, all);
      await interaction.reply({
        content: `✅ Activados **${all.length}** eventos de log.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "defaults") {
      const { defaultLogEvents } = await import("../../lib/modlog.js");
      await setLogEvents(guildId, defaultLogEvents());
      await interaction.reply({
        content: "✅ Eventos restaurados al set **recomendado** por defecto.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "index-status") {
      const {
        countGuildSnapshots,
        BACKFILL_DEFAULT_PER_CHANNEL,
      } = await import("../../lib/messageStore.js");
      const total = await countGuildSnapshots(guildId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setAuthor({
              name: "Zero Two · Index de mensajes",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTitle("📊 Snapshots en base de datos")
            .setDescription(
              [
                `Mensajes indexados en este servidor: **${total.toLocaleString("es-ES")}**`,
                "",
                "Sirven para que, al **borrar o editar**, el log muestre el contenido real.",
                "",
                "• Los mensajes **nuevos** se indexan solos.",
                "• El historial antiguo: `/cfglogs backfill`",
                `• Por defecto se leen ~**${BACKFILL_DEFAULT_PER_CHANNEL}** msgs por canal (máx. 5000).`,
                "• Retención en BD: **30 días** (luego se limpian).",
              ].join("\n"),
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION}` })
            .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "backfill") {
      if (!interaction.guild) {
        await interaction.reply({
          content: "❌ Solo en un servidor.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          content: "❌ Necesitas **Administrador** para indexar el historial.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const limite = interaction.options.getInteger("limite") ?? 1000;
      const onlyCh = interaction.options.getChannel("canal");

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const {
        backfillGuildHistory,
        BACKFILL_DEFAULT_PER_CHANNEL,
      } = await import("../../lib/messageStore.js");

      const me = interaction.guild.members.me;
      if (me && !me.permissions.has(PermissionFlagsBits.ReadMessageHistory)) {
        await interaction.editReply({
          content:
            "❌ Al bot le falta el permiso **Leer historial de mensajes**.",
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle("📥 Indexando historial…")
            .setDescription(
              [
                "Zero Two está leyendo canales de texto y guardando mensajes en MySQL.",
                "",
                `Límite: **${limite}** msgs/canal` +
                  (onlyCh ? ` · solo ${onlyCh}` : " · todos los canales legibles"),
                "",
                "_Puede tardar varios minutos. No cierres el bot._",
              ].join("\n"),
            ),
        ],
      });

      try {
        const result = await backfillGuildHistory(interaction.guild, {
          maxPerChannel: limite || BACKFILL_DEFAULT_PER_CHANNEL,
          channelIds: onlyCh ? [onlyCh.id] : undefined,
        });

        const top = result.perChannel
          .filter((c) => c.scanned > 0)
          .sort((a, b) => b.indexed - a.indexed)
          .slice(0, 12)
          .map(
            (c) =>
              `• **#${c.name}** — ${c.indexed.toLocaleString("es")} indexados / ${c.scanned} leídos`,
          )
          .join("\n");

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(GREEN)
              .setAuthor({
                name: "Zero Two · Backfill de mensajes",
                iconURL: client.user?.displayAvatarURL(),
              })
              .setTitle("✅ Historial indexado")
              .setDescription(
                [
                  `Canales procesados: **${result.channels}**`,
                  `Mensajes leídos: **${result.scanned.toLocaleString("es")}**`,
                  `Guardados/actualizados en BD: **${result.indexed.toLocaleString("es")}**`,
                  "",
                  "A partir de ahora, al borrar un mensaje indexado, el log mostrará el **contenido**.",
                  "",
                  top ? `**Top canales**\n${top}` : null,
                  result.errors.length
                    ? `\n⚠️ Avisos:\n${result.errors
                        .slice(0, 5)
                        .map((e) => `• ${e}`)
                        .join("\n")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join("\n"),
              )
              .setFooter({
                text: `Zero Two ${BOT_VERSION} · /cfglogs index-status`,
              })
              .setTimestamp(),
          ],
        });
      } catch (err) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setTitle("❌ Error en backfill")
              .setDescription(
                err instanceof Error ? err.message : String(err),
              ),
          ],
        });
      }
      return;
    }

    // status + interactive category enable
    const settings = await getGuildLogSettings(guildId);
    const menu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`cfglogs_cat:${interaction.user.id}`)
        .setPlaceholder("Activar todos los eventos de una categoría…")
        .addOptions(
          LOG_CATEGORIES.map((c) => ({
            label: c.label,
            value: c.id,
            description: `Activa ${c.events.length} eventos de ${c.label}`,
            emoji: c.id === "moderation" ? "🛡️" : c.id === "messages" ? "💬" : c.id === "members" ? "👥" : c.id === "server" ? "🏠" : "🎙️",
          })),
        ),
    );

    const msg = await interaction.reply({
      embeds: [
        statusEmbed(
          client,
          guildId,
          settings.channelId,
          settings.events,
          interaction.guild?.name,
        ),
      ],
      components: [menu],
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 90_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (sel) => {
      const catId = sel.values[0];
      const cat = LOG_CATEGORIES.find((c) => c.id === catId);
      if (!cat) {
        await sel.deferUpdate();
        return;
      }
      const current = await getGuildLogSettings(guildId);
      const merged = [...new Set([...current.events, ...cat.events])];
      await setLogEvents(guildId, merged);
      const next = await getGuildLogSettings(guildId);
      await sel.update({
        embeds: [
          statusEmbed(
            client,
            guildId,
            next.channelId,
            next.events,
            interaction.guild?.name,
          ).setColor(LOG_COLORS[cat.events[0]!] ?? GREEN),
        ],
        components: [menu],
      });
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
