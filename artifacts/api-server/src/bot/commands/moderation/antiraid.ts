/**
 * /antiraid — protección contra joins masivos.
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
  getAntiraidSettings,
  updateAntiraidSettings,
  type AntiraidAction,
} from "../../lib/antiraid.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;
const GREEN = 0x22c55e;
const AMBER = 0xf59e0b;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("antiraid")
    .setDescription("🚨 Antiraid — frena joins masivos automáticamente")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName("status").setDescription("📊 Ver configuración y estado actual"),
    )
    .addSubcommand((s) =>
      s
        .setName("toggle")
        .setDescription("🔛 Activar o desactivar el antiraid")
        .addBooleanOption((o) =>
          o
            .setName("activar")
            .setDescription("✅ true = ON · false = OFF")
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("config")
        .setDescription("⚙️ Ajustar umbral, ventana y acción")
        .addIntegerOption((o) =>
          o
            .setName("umbral")
            .setDescription("👥 Joins para disparar (2–50)")
            .setMinValue(2)
            .setMaxValue(50),
        )
        .addIntegerOption((o) =>
          o
            .setName("ventana")
            .setDescription("⏱️ Segundos de la ventana (10–600)")
            .setMinValue(10)
            .setMaxValue(600),
        )
        .addStringOption((o) =>
          o
            .setName("accion")
            .setDescription("⚡ Qué hacer con el join sospechoso")
            .addChoices(
              { name: "👢 Kick", value: "kick" },
              { name: "🔨 Ban", value: "ban" },
              { name: "🔔 Solo alerta", value: "none" },
            ),
        )
        .addChannelOption((o) =>
          o
            .setName("logs")
            .setDescription("📡 Canal de alertas antiraid")
            .addChannelTypes(ChannelType.GuildText),
        ),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Solo en servidores.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.reply({
        content: "❌ Necesitas **Gestionar servidor**.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "status") {
      const s = await getAntiraidSettings(guildId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(s.enabled ? GREEN : AMBER)
            .setAuthor({
              name: "Zero Two · Antiraid",
              iconURL: client.user?.displayAvatarURL() ?? undefined,
            })
            .setTitle(s.enabled ? "🛡️ Antiraid activo" : "⏸️ Antiraid inactivo")
            .addFields(
              {
                name: "Umbral",
                value: `\`${s.threshold}\` joins`,
                inline: true,
              },
              {
                name: "Ventana",
                value: `\`${s.timeWindow}\` s`,
                inline: true,
              },
              {
                name: "Acción",
                value: `\`${s.action}\``,
                inline: true,
              },
              {
                name: "Logs",
                value: s.logChannelId
                  ? `<#${s.logChannelId}>`
                  : "`sin canal`",
                inline: false,
              },
            )
            .setDescription(
              "Si entran **≥ umbral** miembros en **ventana** segundos, se aplica la acción al join que dispara el umbral.",
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION}` })
            .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "toggle") {
      const on = interaction.options.getBoolean("activar", true);
      const s = await updateAntiraidSettings(guildId, { enabled: on });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(on ? GREEN : PINK)
            .setTitle(on ? "✅ Antiraid activado" : "⏸️ Antiraid desactivado")
            .setDescription(
              on
                ? `Umbral **${s.threshold}** / **${s.timeWindow}s** · acción \`${s.action}\``
                : "Ya no se actuarán joins masivos automáticamente.",
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "config") {
      const umbral = interaction.options.getInteger("umbral");
      const ventana = interaction.options.getInteger("ventana");
      const accion = interaction.options.getString("accion") as AntiraidAction | null;
      const logs = interaction.options.getChannel("logs");

      if (
        umbral == null &&
        ventana == null &&
        !accion &&
        !logs
      ) {
        await interaction.reply({
          content: "❌ Pasa al menos un parámetro (`umbral`, `ventana`, `accion`, `logs`).",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const s = await updateAntiraidSettings(guildId, {
        threshold: umbral ?? undefined,
        timeWindow: ventana ?? undefined,
        action: accion ?? undefined,
        logChannelId: logs?.id ?? undefined,
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setTitle("✅ Antiraid actualizado")
            .addFields(
              { name: "Umbral", value: `\`${s.threshold}\``, inline: true },
              { name: "Ventana", value: `\`${s.timeWindow}s\``, inline: true },
              { name: "Acción", value: `\`${s.action}\``, inline: true },
              {
                name: "Logs",
                value: s.logChannelId ? `<#${s.logChannelId}>` : "`—`",
                inline: false,
              },
              {
                name: "Estado",
                value: s.enabled ? "🟢 Activo" : "⚪ Inactivo (usa `/antiraid toggle`)",
                inline: false,
              },
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION}` }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
