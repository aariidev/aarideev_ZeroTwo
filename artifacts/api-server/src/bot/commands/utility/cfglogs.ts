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
