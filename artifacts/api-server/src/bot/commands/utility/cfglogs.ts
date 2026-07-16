import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getGuildLogSettings,
  getLogChannelId,
  LOG_CATEGORIES,
  LOG_EVENT_META,
  removeLogChannel,
  setLogChannelId,
} from "../../lib/modlog.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("cfglogs")
    .setDescription("📡 Configura el canal de logs de moderación del servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Define el canal donde se enviarán los logs de acción")
        .addChannelOption((opt) =>
          opt
            .setName("canal")
            .setDescription("Canal de destino para los logs")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
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
        .setDescription("Muestra el estado de la configuración de logs"),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild?.id ?? "";

    if (sub === "set") {
      const channel = interaction.options.getChannel("canal", true);

      await setLogChannelId(guildId, channel.id);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff9f)
            .setAuthor({
              name: "Central de Logs // Zero Two",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTitle("📡 Canal de Logs Configurado")
            .setDescription(
              `Los registros de moderación ahora se enviarán a <#${channel.id}>.\n\n` +
                `Para activar/desactivar eventos, filtros y alertas usa el **dashboard** → Servidores.`,
            )
            .addFields(
              { name: "📌 Canal", value: `<#${channel.id}>`, inline: true },
              { name: "🆔 ID", value: `\`${channel.id}\``, inline: true },
              {
                name: "🛡️ Configurado por",
                value: `${interaction.user.tag}`,
                inline: true,
              },
            )
            .setFooter({
              text: "Eventos, bots, webhooks y más → dashboard",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    if (sub === "disable") {
      const existing = await getLogChannelId(guildId);

      if (!existing) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff2d6b)
              .setDescription(
                "❌ No hay ningún canal de logs configurado para este servidor.",
              ),
          ],
          ephemeral: true,
        });
        return;
      }

      await removeLogChannel(guildId);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setAuthor({
              name: "Central de Logs // Zero Two",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTitle("🔕 Logs de Moderación Desactivados")
            .setDescription(
              "El canal de logs ha sido eliminado de la configuración.\n" +
                "Usa `/cfglogs set` para volver a activarlo.",
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    if (sub === "status") {
      const settings = await getGuildLogSettings(guildId);

      if (!settings.channelId) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff9900)
              .setAuthor({
                name: "Central de Logs // Zero Two",
                iconURL: client.user?.displayAvatarURL(),
              })
              .setTitle("📡 Estado del Canal de Logs")
              .setDescription(
                "⚠️ **Sin canal configurado.**\n" +
                  "Usa `/cfglogs set` o el dashboard para asignar un canal.",
              )
              .setTimestamp(),
          ],
          ephemeral: true,
        });
        return;
      }

      const channel = interaction.guild?.channels.cache.get(settings.channelId);
      const channelMention = channel
        ? `<#${settings.channelId}>`
        : `\`${settings.channelId}\` *(no encontrado)*`;

      const eventLines = LOG_CATEGORIES.map((cat) => {
        const active = cat.events.filter((k) => settings.events.includes(k));
        const labels = active
          .map((k) => LOG_EVENT_META[k].label)
          .join(", ");
        return `**${cat.label}** (${active.length}/${cat.events.length}): ${
          labels || "—"
        }`;
      }).join("\n");

      const ping =
        settings.pingRoleId && interaction.guild?.roles.cache.has(settings.pingRoleId)
          ? `<@&${settings.pingRoleId}>`
          : settings.pingRoleId
            ? `\`${settings.pingRoleId}\``
            : "Ninguno";

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff9f)
            .setAuthor({
              name: "Central de Logs // Zero Two",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTitle("📡 Estado de Logs del Servidor")
            .addFields(
              { name: "✅ Canal", value: channelMention, inline: true },
              {
                name: "📊 Eventos",
                value: `\`${settings.events.length}\` activos`,
                inline: true,
              },
              {
                name: "🔔 Ping",
                value: ping,
                inline: true,
              },
              {
                name: "🤖 Filtros",
                value: [
                  `Bots: ${settings.ignoreBots ? "ignorados" : "incluidos"}`,
                  `Webhooks: ${settings.ignoreWebhooks ? "ignorados" : "incluidos"}`,
                  `Adjuntos: ${settings.includeAttachments ? "sí" : "no"}`,
                  `Alerta cuenta nueva: ${
                    settings.joinAlertDays > 0
                      ? `${settings.joinAlertDays}d`
                      : "off"
                  }`,
                  `Canales ignorados: ${settings.ignoreChannels.length}`,
                ].join("\n"),
                inline: false,
              },
              {
                name: "📋 Eventos por categoría",
                value: eventLines.slice(0, 1024) || "—",
                inline: false,
              },
            )
            .setFooter({
              text: "Ajusta eventos y filtros en el dashboard → Servidores",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  },
};

export default command;
