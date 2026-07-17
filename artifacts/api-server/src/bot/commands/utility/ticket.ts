import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getTicketConfig,
  setTicketConfig,
  getTicketByChannel,
  closeTicketRecord,
  claimTicket,
  isStaff,
  buildTranscript,
  defaultTicketConfig,
  TICKET_CATEGORIES,
} from "../../lib/tickets.js";
import { AttachmentBuilder } from "discord.js";

const PINK = 0xff2d6b;
const CYAN = 0x00f5d4;
const GREEN = 0x00ff9f;
const AMBER = 0xff9900;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("🎫 Sistema de tickets de soporte")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configura el sistema de tickets (admin)")
        .addChannelOption((o) =>
          o
            .setName("categoria")
            .setDescription("Categoría donde se crearán los tickets")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true),
        )
        .addRoleOption((o) =>
          o
            .setName("staff")
            .setDescription("Rol del staff que ve los tickets")
            .setRequired(true),
        )
        .addChannelOption((o) =>
          o
            .setName("logs")
            .setDescription("Canal de logs/transcripts (opcional)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false),
        )
        .addIntegerOption((o) =>
          o
            .setName("max_abiertos")
            .setDescription("Máximo de tickets abiertos por usuario (1-5)")
            .setMinValue(1)
            .setMaxValue(5)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("Publica el panel para abrir tickets")
        .addChannelOption((o) =>
          o
            .setName("canal")
            .setDescription("Canal donde publicar el panel (default: actual)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Cierra el ticket del canal actual")
        .addStringOption((o) =>
          o.setName("razon").setDescription("Motivo del cierre").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("claim").setDescription("Reclama el ticket (staff)"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Añade un usuario al ticket")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Usuario a añadir").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Quita un usuario del ticket")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Usuario a quitar").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Muestra la configuración de tickets"),
    ) as SlashCommandBuilder,

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription("❌ Este comando solo funciona en servidores."),
        ],
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const botIcon = client.user?.displayAvatarURL();

    // ── SETUP ────────────────────────────────────────────────────────────────
    if (sub === "setup") {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Solo administradores pueden configurar tickets."),
          ],
          ephemeral: true,
        });
        return;
      }

      const category = interaction.options.getChannel("categoria", true);
      const staff = interaction.options.getRole("staff", true);
      const logs = interaction.options.getChannel("logs");
      const maxOpen = interaction.options.getInteger("max_abiertos") ?? 1;

      const cfg = await setTicketConfig(guildId, {
        categoryId: category.id,
        staffRoleId: staff.id,
        logChannelId: logs?.id ?? null,
        maxOpen,
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setAuthor({
              name: "Zero Two · Tickets",
              iconURL: botIcon,
            })
            .setTitle("✅ Sistema de tickets configurado")
            .addFields(
              {
                name: "📁 Categoría",
                value: `<#${cfg.categoryId}>`,
                inline: true,
              },
              {
                name: "🛡️ Staff",
                value: `<@&${cfg.staffRoleId}>`,
                inline: true,
              },
              {
                name: "📡 Logs",
                value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "`—`",
                inline: true,
              },
              {
                name: "🔢 Max abiertos",
                value: `\`${cfg.maxOpen}\` por usuario`,
                inline: true,
              },
            )
            .setDescription(
              "Usa `/ticket panel` para publicar el menú de apertura.",
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── STATUS ───────────────────────────────────────────────────────────────
    if (sub === "status") {
      const cfg = await getTicketConfig(guildId);
      const base = defaultTicketConfig();
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(CYAN)
            .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
            .setTitle("📡 Estado del sistema de tickets")
            .addFields(
              {
                name: "📁 Categoría",
                value: cfg.categoryId ? `<#${cfg.categoryId}>` : "`sin configurar`",
                inline: true,
              },
              {
                name: "🛡️ Staff",
                value: cfg.staffRoleId
                  ? `<@&${cfg.staffRoleId}>`
                  : "`sin configurar`",
                inline: true,
              },
              {
                name: "📡 Logs",
                value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "`—`",
                inline: true,
              },
              {
                name: "🔢 Max abiertos",
                value: `\`${cfg.maxOpen}\``,
                inline: true,
              },
              {
                name: "⏱️ Borrar canal tras cierre",
                value: cfg.deleteAfterCloseSec
                  ? `\`${cfg.deleteAfterCloseSec}s\``
                  : "`no`",
                inline: true,
              },
            )
            .setFooter({
              text:
                cfg.categoryId && cfg.staffRoleId
                  ? "Listo para /ticket panel"
                  : "Falta /ticket setup",
              iconURL: botIcon,
            })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── PANEL ────────────────────────────────────────────────────────────────
    if (sub === "panel") {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      ) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Necesitas permiso de gestionar servidor."),
          ],
          ephemeral: true,
        });
        return;
      }

      const cfg = await getTicketConfig(guildId);
      if (!cfg.categoryId || !cfg.staffRoleId) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(AMBER)
              .setDescription(
                "⚠️ Primero configura el sistema con `/ticket setup`.",
              ),
          ],
          ephemeral: true,
        });
        return;
      }

      const target =
        interaction.options.getChannel("canal") ?? interaction.channel;
      if (!target || !("send" in target)) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Canal inválido."),
          ],
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setAuthor({
          name: "Central de Tickets // Zero Two",
          iconURL: botIcon,
        })
        .setTitle(cfg.panelTitle)
        .setDescription(cfg.panelDescription)
        .addFields(
          {
            name: "📋 Categorías",
            value: TICKET_CATEGORIES.map((c) => `${c.label} — ${c.description}`).join(
              "\n",
            ),
          },
          {
            name: "⏱️ Respuesta",
            value: "El staff te atenderá lo antes posible en un canal privado.",
          },
        )
        .setFooter({
          text: "Zero Two · Sistema de Tickets",
          iconURL: botIcon,
        })
        .setTimestamp();

      const select = new StringSelectMenuBuilder()
        .setCustomId("ticket_open")
        .setPlaceholder("Selecciona una categoría…")
        .addOptions(
          {
            label: "Soporte",
            description: "Ayuda general",
            value: "soporte",
            emoji: "🛠️",
          },
          {
            label: "Reporte",
            description: "Reportar un usuario",
            value: "reporte",
            emoji: "🚨",
          },
          {
            label: "Apelación",
            description: "Apelar una sanción",
            value: "apelacion",
            emoji: "📋",
          },
          {
            label: "Otro",
            description: "Cualquier otra consulta",
            value: "otro",
            emoji: "💬",
          },
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        select,
      );

      await (target as typeof interaction.channel & { send: Function }).send({
        embeds: [embed],
        components: [row],
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setDescription(`✅ Panel publicado en <#${target.id}>.`),
        ],
        ephemeral: true,
      });
      return;
    }

    // Ticket-channel-only commands below
    const ticket = await getTicketByChannel(interaction.channelId);
    const cfg = await getTicketConfig(guildId);
    const member = await interaction.guild.members.fetch(interaction.user.id);

    // ── CLOSE ────────────────────────────────────────────────────────────────
    if (sub === "close") {
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Este canal no es un ticket abierto."),
          ],
          ephemeral: true,
        });
        return;
      }

      const canClose =
        ticket.userId === interaction.user.id || isStaff(member, cfg);
      if (!canClose) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Solo el dueño del ticket o el staff pueden cerrarlo."),
          ],
          ephemeral: true,
        });
        return;
      }

      const reason = interaction.options.getString("razon");
      await interaction.deferReply();

      const channel = interaction.channel;
      if (!channel || !channel.isTextBased() || channel.isDMBased()) return;

      const transcript = await buildTranscript(channel as import("discord.js").TextChannel);
      await closeTicketRecord(
        interaction.channelId,
        interaction.user.id,
        interaction.user.tag,
        reason,
      );

      const closeEmbed = new EmbedBuilder()
        .setColor(PINK)
        .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
        .setTitle("🔒 Ticket cerrado")
        .addFields(
          {
            name: "👤 Cerrado por",
            value: `${interaction.user}`,
            inline: true,
          },
          {
            name: "📝 Motivo",
            value: reason ?? "Sin motivo",
            inline: true,
          },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [closeEmbed] });

      if (cfg.logChannelId) {
        const logCh = interaction.guild.channels.cache.get(cfg.logChannelId);
        if (logCh?.isTextBased()) {
          const file = new AttachmentBuilder(Buffer.from(transcript, "utf8"), {
            name: `ticket-${ticket.id}-${ticket.userId}.txt`,
          });
          await logCh
            .send({
              embeds: [
                new EmbedBuilder()
                  .setColor(PINK)
                  .setTitle("📄 Ticket cerrado")
                  .addFields(
                    {
                      name: "Usuario",
                      value: `<@${ticket.userId}> (\`${ticket.username}\`)`,
                      inline: true,
                    },
                    {
                      name: "Categoría",
                      value: ticket.category,
                      inline: true,
                    },
                    {
                      name: "Cerrado por",
                      value: `${interaction.user.tag}`,
                      inline: true,
                    },
                    {
                      name: "Motivo",
                      value: reason ?? "—",
                      inline: false,
                    },
                  )
                  .setTimestamp(),
              ],
              files: [file],
            })
            .catch(() => null);
        }
      }

      if (cfg.deleteAfterCloseSec > 0 && "delete" in channel) {
        setTimeout(() => {
          (channel as import("discord.js").GuildChannel)
            .delete(`Ticket cerrado por ${interaction.user.tag}`)
            .catch(() => null);
        }, cfg.deleteAfterCloseSec * 1000);
      }
      return;
    }

    // ── CLAIM ────────────────────────────────────────────────────────────────
    if (sub === "claim") {
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Este canal no es un ticket abierto."),
          ],
          ephemeral: true,
        });
        return;
      }
      if (!isStaff(member, cfg)) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Solo el staff puede reclamar tickets."),
          ],
          ephemeral: true,
        });
        return;
      }

      await claimTicket(
        interaction.channelId,
        interaction.user.id,
        interaction.user.tag,
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(CYAN)
            .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
            .setTitle("✋ Ticket reclamado")
            .setDescription(
              `${interaction.user} se encargará de este ticket.`,
            )
            .setTimestamp(),
        ],
      });
      return;
    }

    // ── ADD / REMOVE ─────────────────────────────────────────────────────────
    if (sub === "add" || sub === "remove") {
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Este canal no es un ticket abierto."),
          ],
          ephemeral: true,
        });
        return;
      }
      if (!isStaff(member, cfg) && ticket.userId !== interaction.user.id) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ No tienes permiso para eso."),
          ],
          ephemeral: true,
        });
        return;
      }

      const targetUser = interaction.options.getUser("usuario", true);
      const ch = interaction.channel;
      if (!ch || !("permissionOverwrites" in ch)) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Canal inválido."),
          ],
          ephemeral: true,
        });
        return;
      }

      if (sub === "add") {
        await ch.permissionOverwrites.edit(targetUser.id, {
          ViewChannel: true,
          SendMessages: true,
          AttachFiles: true,
          ReadMessageHistory: true,
        });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(GREEN)
              .setDescription(`✅ ${targetUser} añadido al ticket.`),
          ],
        });
      } else {
        if (targetUser.id === ticket.userId) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(PINK)
                .setDescription("❌ No puedes quitar al dueño del ticket."),
            ],
            ephemeral: true,
          });
          return;
        }
        await ch.permissionOverwrites.delete(targetUser.id);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(AMBER)
              .setDescription(`🗑️ ${targetUser} eliminado del ticket.`),
          ],
        });
      }
      return;
    }
  },
};

export default command;

/** Shared UI for ticket channel controls */
export function ticketControlRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Reclamar")
      .setEmoji("✋")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Cerrar")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
  );
}
