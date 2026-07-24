/**
 * /sugerencias — canal de ideas de la comunidad.
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import {
  createSuggestion,
  getSuggestionSettings,
  upsertSuggestionSettings,
  listRecentSuggestions,
} from "../../lib/suggestions.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;
const GREEN = 0x22c55e;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("sugerencias")
    .setDescription("💡 Sistema de sugerencias del servidor")
    .addSubcommand((s) =>
      s
        .setName("crear")
        .setDescription("Envía una sugerencia al canal configurado")
        .addStringOption((o) =>
          o
            .setName("texto")
            .setDescription("Tu idea o propuesta")
            .setRequired(true)
            .setMaxLength(1500),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Configura el canal de sugerencias")
        .addChannelOption((o) =>
          o
            .setName("canal")
            .setDescription("Canal donde se publican las sugerencias")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("logs")
        .setDescription("Canal de logs de moderación de sugerencias")
        .addChannelOption((o) =>
          o
            .setName("canal")
            .setDescription("Canal de logs (aprobadas/rechazadas)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("status")
        .setDescription("Muestra la configuración actual"),
    )
    .addSubcommand((s) =>
      s
        .setName("lista")
        .setDescription("Últimas sugerencias del servidor"),
    )
    .addSubcommand((s) =>
      s
        .setName("toggle")
        .setDescription("Activa o desactiva el sistema")
        .addBooleanOption((o) =>
          o
            .setName("activar")
            .setDescription("true = on, false = off")
            .setRequired(true),
        ),
    ) as SlashCommandBuilder,

  cooldown: 8,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Solo en servidores.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const isAdmin = interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild,
    );

    if (sub === "crear") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const texto = interaction.options.getString("texto", true);
      const result = await createSuggestion({
        guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        content: texto,
        client,
      });
      if (!result.ok) {
        await interaction.editReply({ content: `❌ ${result.reason}` });
        return;
      }
      await interaction.editReply({
        content: `✅ Sugerencia **#${result.suggestion.id}** publicada. Gracias, Darling.`,
      });
      return;
    }

    if (sub === "status" || sub === "lista") {
      // public-ish
    } else if (!isAdmin) {
      await interaction.reply({
        content: "❌ Necesitas **Gestionar servidor**.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "set") {
      const canal = interaction.options.getChannel("canal", true);
      await upsertSuggestionSettings(guildId, { channelId: canal.id });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setTitle("✅ Canal de sugerencias")
            .setDescription(
              `Las sugerencias se publicarán en ${canal}.\nUsa \`/sugerencias crear\` para enviar una.`,
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION}` }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "logs") {
      const canal = interaction.options.getChannel("canal", true);
      await upsertSuggestionSettings(guildId, { logChannelId: canal.id });
      await interaction.reply({
        content: `✅ Logs de sugerencias → ${canal}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "toggle") {
      const on = interaction.options.getBoolean("activar", true);
      await upsertSuggestionSettings(guildId, { enabled: on });
      await interaction.reply({
        content: on
          ? "✅ Sugerencias **activadas**."
          : "⏸️ Sugerencias **desactivadas**.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "status") {
      const s = await getSuggestionSettings(guildId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setAuthor({
              name: "Zero Two · Sugerencias",
              iconURL: client.user?.displayAvatarURL() ?? undefined,
            })
            .setTitle("📋 Configuración")
            .addFields(
              {
                name: "Estado",
                value: s?.enabled !== false ? "✅ Activo" : "⏸️ Off",
                inline: true,
              },
              {
                name: "Canal",
                value: s?.channelId ? `<#${s.channelId}>` : "`sin configurar`",
                inline: true,
              },
              {
                name: "Logs",
                value: s?.logChannelId
                  ? `<#${s.logChannelId}>`
                  : "`sin configurar`",
                inline: true,
              },
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION}` }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "lista") {
      const items = await listRecentSuggestions(guildId, 12);
      const body =
        items.length === 0
          ? "_Aún no hay sugerencias._"
          : items
              .map(
                (i) =>
                  `**#${i.id}** [${i.status}] <@${i.userId}> — ${i.content.slice(0, 80)}${i.content.length > 80 ? "…" : ""}`,
              )
              .join("\n");
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setTitle("💡 Últimas sugerencias")
            .setDescription(body)
            .setFooter({ text: `Zero Two ${BOT_VERSION}` }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
