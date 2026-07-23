import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../types.js";
import { musicNoticePayload } from "../../music/embeds.js";
import {
  disableMusicPanel,
  getMusicPanelConfig,
} from "../../music/panelStore.js";
import { publishMusicPanel } from "../../music/panel.js";

const PINK = 0xff2d6b;
const CYAN = 0x22d3ee;
const GREEN = 0x22c55e;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("musicpanel")
    .setDescription("🎛️ Configura el panel fijo de música del servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Elige el canal y publica el panel de control")
        .addChannelOption((o) =>
          o
            .setName("canal")
            .setDescription("Canal de texto donde estará el panel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("Republica el panel (mismo canal o el indicado)")
        .addChannelOption((o) =>
          o
            .setName("canal")
            .setDescription("Canal (por defecto: el configurado o el actual)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Muestra la config del panel de música"),
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Desactiva el panel (deja de actualizarse)"),
    ) as SlashCommandBuilder,

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        ...musicNoticePayload("❌ Solo en servidores.", { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "status") {
      const cfg = await getMusicPanelConfig(guildId);
      const emb = new EmbedBuilder()
        .setColor(cfg?.enabled && cfg.channelId ? GREEN : CYAN)
        .setAuthor({
          name: "Zero Two Music · Config del panel",
          iconURL: client.user?.displayAvatarURL() ?? undefined,
        })
        .setDescription(
          cfg?.enabled && cfg.channelId
            ? [
                `**Estado:** activo`,
                `**Canal:** <#${cfg.channelId}>`,
                `**Mensaje:** \`${cfg.messageId ?? "—"}\``,
                "",
                "Los usuarios pueden añadir canciones y controlar la cola desde ese mensaje.",
              ].join("\n")
            : "No hay panel activo.\nUsa **`/musicpanel set`** en un canal de texto.",
        )
        .setTimestamp();
      await interaction.reply({ embeds: [emb], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "disable") {
      await disableMusicPanel(guildId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription(
              "🛑 Panel de música desactivado.\nEl mensaje antiguo ya no se actualizará (puedes borrarlo a mano).",
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const optChannel = interaction.options.getChannel("canal");
    const cfg = await getMusicPanelConfig(guildId);
    let channelId: string | null =
      optChannel?.id ??
      (sub === "set" ? null : cfg?.channelId) ??
      interaction.channelId;

    if (sub === "set" && !optChannel) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Debes indicar un **canal**.")],
      });
      return;
    }
    if (sub === "set" && optChannel) channelId = optChannel.id;

    if (!channelId) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription("❌ No hay canal configurado. Usa `/musicpanel set canal:#música`."),
        ],
      });
      return;
    }

    const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (
      !ch ||
      !ch.isTextBased() ||
      (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement)
    ) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ El canal debe ser de **texto**.")],
      });
      return;
    }

    const me = interaction.guild.members.me;
    if (
      me &&
      !ch.permissionsFor(me)?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ])
    ) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription("❌ Necesito permisos de **Ver / Enviar / Embeds / Archivos** en ese canal."),
        ],
      });
      return;
    }

    try {
      const { message } = await publishMusicPanel(client, guildId, ch);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setAuthor({
              name: "Zero Two Music · Panel listo",
              iconURL: client.user?.displayAvatarURL() ?? undefined,
            })
            .setDescription(
              [
                `✅ Panel publicado en ${ch}.`,
                `Mensaje: [ir al panel](${message.url})`,
                "",
                "Los miembros pueden usar **Añadir canción** y los botones de control ahí.",
              ].join("\n"),
            ),
        ],
      });
    } catch (err) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription(
              `❌ No se pudo publicar el panel: ${err instanceof Error ? err.message : "error"}`,
            ),
        ],
      });
    }
  },
};

export default command;