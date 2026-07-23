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
  saveMusicPanelConfig,
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
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
            )
            .setRequired(true),
        )
        .addRoleOption((o) =>
          o
            .setName("rol_dj")
            .setDescription(
              "Solo este rol (y admins) puede controlar la música. Vacío = cualquiera en voz",
            )
            .setRequired(false),
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
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("dj")
        .setDescription("Configura o quita el rol DJ")
        .addRoleOption((o) =>
          o
            .setName("rol")
            .setDescription("Rol DJ (omitir + quitar:true para desactivar)")
            .setRequired(false),
        )
        .addBooleanOption((o) =>
          o
            .setName("quitar")
            .setDescription("Quitar restricción de rol DJ")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("cap")
        .setDescription(
          "Zero Two como bot de música principal (expulsa otros bots del VC)",
        )
        .addBooleanOption((o) =>
          o
            .setName("activo")
            .setDescription("true = capear otros bots de música")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Muestra la config del panel de música"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Desactiva el panel (deja de actualizarse)"),
    ) as SlashCommandBuilder,

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        ...musicNoticePayload("❌ Solo en servidores.", {
          kind: "error",
          client,
        }),
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
                `**Rol DJ:** ${cfg.djRoleId ? `<@&${cfg.djRoleId}>` : "`cualquiera en el canal de voz`"}`,
                `**Bot principal (cap):** ${cfg.capOtherBots ? "`activo` — expulsa otros bots del VC" : "`off`"}`,
                "",
                "Controles: anterior, pausa, skip, volumen, vaciar cola…",
                "Progreso del panel se actualiza ~cada 12s.",
                "Cap: `/musicpanel cap activo:True` (requiere Desconectar miembros).",
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

    if (sub === "dj") {
      const quitar = interaction.options.getBoolean("quitar") ?? false;
      const rol = interaction.options.getRole("rol");
      const prev = await getMusicPanelConfig(guildId);
      if (!prev) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription(
                "❌ Primero publica un panel con `/musicpanel set`.",
              ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const djRoleId = quitar ? null : (rol?.id ?? null);
      if (!quitar && !rol) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription(
                "❌ Indica un **rol** o usa `quitar:True` para quitar el DJ.",
              ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await saveMusicPanelConfig({ ...prev, djRoleId });
      try {
        const { schedulePanelRefresh } = await import("../../music/panel.js");
        schedulePanelRefresh(client, guildId);
      } catch {
        /* optional */
      }
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setDescription(
              djRoleId
                ? `✅ Rol DJ actualizado: <@&${djRoleId}>\nSolo ese rol (y admins) controlan la música.`
                : "✅ Restricción de rol DJ **eliminada**.\nCualquiera en el canal de voz del bot puede controlar.",
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "cap") {
      const activo = interaction.options.getBoolean("activo", true);
      let prev = await getMusicPanelConfig(guildId);
      if (!prev) {
        prev = {
          guildId,
          channelId: null,
          messageId: null,
          djRoleId: null,
          capOtherBots: false,
          enabled: false,
        };
      }
      await saveMusicPanelConfig({ ...prev, capOtherBots: activo });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(activo ? GREEN : PINK)
            .setAuthor({
              name: "Zero Two Music · Bot principal",
              iconURL: client.user?.displayAvatarURL() ?? undefined,
            })
            .setDescription(
              activo
                ? [
                    "✅ **Cap activo**: Zero Two es el bot de música principal.",
                    "",
                    "• Si otro bot entra al canal de voz donde está 02, será **desconectado**.",
                    "• Al conectar 02, se expulsan bots rivales del VC.",
                    "",
                    "⚠️ El bot necesita permiso **Desconectar miembros**.",
                  ].join("\n")
                : "🛑 Cap desactivado. Otros bots de música pueden compartir el canal de voz.",
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // set | panel
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const optChannel = interaction.options.getChannel("canal");
    const cfg = await getMusicPanelConfig(guildId);
    const djFromSet =
      sub === "set" ? interaction.options.getRole("rol_dj") : null;

    let channelId: string | null =
      optChannel?.id ??
      (sub === "set" ? null : cfg?.channelId) ??
      interaction.channelId;

    if (sub === "set" && !optChannel) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription("❌ Debes indicar un **canal**."),
        ],
      });
      return;
    }

    if (sub === "set" && optChannel) {
      channelId = optChannel.id;
    }

    if (!channelId) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription(
              "❌ No hay canal configurado. Usa `/musicpanel set canal:#música`.",
            ),
        ],
      });
      return;
    }

    const ch = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (
      !ch ||
      !ch.isTextBased() ||
      (ch.type !== ChannelType.GuildText &&
        ch.type !== ChannelType.GuildAnnouncement)
    ) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription("❌ El canal debe ser de **texto**."),
        ],
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
            .setDescription(
              "❌ Necesito permisos de **Ver / Enviar / Embeds / Archivos** en ese canal.",
            ),
        ],
      });
      return;
    }

    try {
      const { message, config } = await publishMusicPanel(client, guildId, ch, {
        djRoleId:
          sub === "set"
            ? (djFromSet?.id ?? cfg?.djRoleId ?? null)
            : undefined,
      });
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
                `**Rol DJ:** ${config.djRoleId ? `<@&${config.djRoleId}>` : "`cualquiera en voz`"}`,
                "",
                "Botones: Añadir · Anterior · Pausa · Skip · Volumen · Vaciar cola…",
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
