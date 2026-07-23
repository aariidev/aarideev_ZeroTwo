import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type TextChannel,
} from "discord.js";
import {
  countOpenTickets,
  createTicketChannel,
  getTicketByChannel,
  getTicketConfig,
  claimTicket,
  closeTicketRecord,
  canClaimTicket,
  canCloseTicket,
  buildWelcomeMessage,
  buildTranscript,
  resolveCategories,
} from "../lib/tickets.js";
import { logger } from "../../lib/logger.js";
import { ticketControlRow } from "../commands/utility/ticket.js";

const PINK = 0xff2d6b;
const CYAN = 0x00f5d4;
const GREEN = 0x00ff9f;

/**
 * Handles select menus, buttons and modals for the ticket system.
 * Returns true if the interaction was consumed.
 */
export async function handleTicketInteraction(
  interaction: Interaction,
): Promise<boolean> {
  try {
    // ── Open: category select ──────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_open") {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Solo en servidores."),
          ],
          ephemeral: true,
        });
        return true;
      }

      const category = interaction.values[0] ?? "soporte";
      const cfg = await getTicketConfig(interaction.guild.id);

      if (!cfg.categoryId || !cfg.staffRoleIds.length) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription(
                "⚠️ El sistema de tickets no está configurado. Avisa a un admin (`/ticket setup`).",
              ),
          ],
          ephemeral: true,
        });
        return true;
      }

      const openCount = await countOpenTickets(
        interaction.guild.id,
        interaction.user.id,
      );
      if (openCount >= cfg.maxOpen) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription(
                `❌ Ya tienes **${openCount}** ticket(s) abierto(s). Máximo: **${cfg.maxOpen}**.`,
              ),
          ],
          ephemeral: true,
        });
        return true;
      }

      const modal = new ModalBuilder()
        .setCustomId(`ticket_modal:${category}`)
        .setTitle("Abrir ticket");

      const subject = new TextInputBuilder()
        .setCustomId("subject")
        .setLabel("Asunto / describe tu problema")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(500)
        .setPlaceholder("Cuéntanos qué necesitas…");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(subject),
      );
      await interaction.showModal(modal);
      return true;
    }

    // ── Modal submit → create channel ──────────────────────────────────────
    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("ticket_modal:")
    ) {
      if (!interaction.guild || !interaction.member) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Solo en servidores."),
          ],
          ephemeral: true,
        });
        return true;
      }

      const category = interaction.customId.split(":")[1] ?? "soporte";
      const subject = interaction.fields.getTextInputValue("subject").trim();
      const cfg = await getTicketConfig(interaction.guild.id);
      const botIcon = interaction.client.user?.displayAvatarURL();
      const cats = resolveCategories(cfg);
      const catMeta = cats.find((c) => c.id === category);

      if (!catMeta) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Esa categoría ya no está disponible."),
          ],
          ephemeral: true,
        });
        return true;
      }

      await interaction.deferReply({ ephemeral: true });

      const openCount = await countOpenTickets(
        interaction.guild.id,
        interaction.user.id,
      );
      if (openCount >= cfg.maxOpen) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription(
                `❌ Ya tienes el máximo de tickets abiertos (**${cfg.maxOpen}**).`,
              ),
          ],
        });
        return true;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);

      let channel: TextChannel;
      try {
        channel = await createTicketChannel(
          interaction.guild,
          member,
          cfg,
          category,
          subject,
        );
      } catch (err) {
        logger.error({ err }, "ticket create failed");
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription(
                "❌ No pude crear el canal. ¿Tengo permisos de **Gestionar canales** en la categoría?",
              ),
          ],
        });
        return true;
      }

      const customWelcome = buildWelcomeMessage(
        cfg.welcomeMessage,
        member,
        catMeta.label,
        subject,
      );
      const staffMentions = [
        ...new Set([
          ...cfg.staffRoleIds,
          ...(catMeta.staffRoleIds ?? []),
        ]),
      ];
      const welcome = new EmbedBuilder()
        .setColor(CYAN)
        .setAuthor({
          name: "Central de Tickets // Zero Two",
          iconURL: botIcon,
        })
        .setTitle(`${catMeta.label} abierto`)
        .setDescription(
          (customWelcome || `Hola ${member}, el staff te atenderá aquí.`) + "\n\n" +
            `**Asunto:** ${subject}\n\n` +
            staffMentions.map((id) => `<@&${id}>`).join(" "),
        )
        .addFields(
          {
            name: "👤 Usuario",
            value: `${member} (\`${member.id}\`)`,
            inline: true,
          },
          {
            name: "📁 Categoría",
            value: catMeta.label,
            inline: true,
          },
        )
        .setFooter({ text: "Usa los botones o /ticket close" })
        .setTimestamp();

      await channel.send({
        content: [String(member), ...staffMentions.map((id) => `<@&${id}>`)].join(" · "),
        embeds: [welcome],
        components: [ticketControlRow()],
        allowedMentions: {
          users: [member.id],
          roles: staffMentions,
        },
      });

      if (cfg.logChannelId) {
        const logCh = interaction.guild.channels.cache.get(cfg.logChannelId);
        if (logCh?.isTextBased()) {
          await logCh
            .send({
              embeds: [
                new EmbedBuilder()
                  .setColor(GREEN)
                  .setTitle("🎫 Ticket abierto")
                  .addFields(
                    {
                      name: "Usuario",
                      value: `${member} (\`${member.user.tag}\`)`,
                      inline: true,
                    },
                    {
                      name: "Canal",
                      value: `${channel}`,
                      inline: true,
                    },
                    {
                      name: "Categoría",
                      value: catMeta.label,
                      inline: true,
                    },
                    { name: "Asunto", value: subject },
                  )
                  .setTimestamp(),
              ],
            })
            .catch(() => null);
        }
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setDescription(`✅ Ticket creado: ${channel}`),
        ],
      });
      return true;
    }

    // ── Claim button ───────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === "ticket_claim") {
      if (!interaction.guild) return false;
      const ticket = await getTicketByChannel(interaction.channelId);
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Ticket no válido o ya cerrado."),
          ],
          ephemeral: true,
        });
        return true;
      }

      const cfg = await getTicketConfig(interaction.guild.id);
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!canClaimTicket(member, cfg)) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription(cfg.claimPolicy === "anyone" ? "❌ No puedes reclamar este ticket." : "❌ Solo el staff puede reclamar."),
          ],
          ephemeral: true,
        });
        return true;
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
            .setTitle("✋ Ticket reclamado")
            .setDescription(`${interaction.user} se encargará de este ticket.`)
            .setTimestamp(),
        ],
      });
      return true;
    }

    // ── Close button → confirm ─────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === "ticket_close") {
      if (!interaction.guild) return false;
      const ticket = await getTicketByChannel(interaction.channelId);
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Ticket no válido o ya cerrado."),
          ],
          ephemeral: true,
        });
        return true;
      }

      const cfg = await getTicketConfig(interaction.guild.id);
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!canCloseTicket(member, cfg, ticket.userId)) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ No puedes cerrar este ticket."),
          ],
          ephemeral: true,
        });
        return true;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close_yes")
          .setLabel("Sí, cerrar")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("ticket_close_no")
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription(
              "¿Seguro que quieres **cerrar** este ticket?\n" +
                `Se generará un transcript${cfg.deleteAfterCloseSec > 0 ? ` y el canal se eliminará en ${cfg.deleteAfterCloseSec}s` : ""}.`,
            ),
        ],
        components: [row],
        ephemeral: true,
      });
      return true;
    }

    if (interaction.isButton() && interaction.customId === "ticket_close_no") {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(CYAN)
            .setDescription("Cierre cancelado."),
        ],
        components: [],
      });
      return true;
    }

    if (interaction.isButton() && interaction.customId === "ticket_close_yes") {
      if (!interaction.guild) return false;
      const ticket = await getTicketByChannel(interaction.channelId);
      if (!ticket || ticket.status === "closed") {
        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Ticket ya cerrado."),
          ],
          components: [],
        });
        return true;
      }

      const cfg = await getTicketConfig(interaction.guild.id);
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!canCloseTicket(member, cfg, ticket.userId)) {
        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Ya no tienes permiso para cerrar este ticket."),
          ],
          components: [],
        });
        return true;
      }
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        return true;
      }

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription("🔒 Cerrando ticket…"),
        ],
        components: [],
      });

      const transcript = await buildTranscript(channel as TextChannel);
      await closeTicketRecord(
        interaction.channelId,
        interaction.user.id,
        interaction.user.tag,
        "Cerrado desde botón",
      );

      await channel
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setTitle("🔒 Ticket cerrado")
              .setDescription(
                `Cerrado por ${interaction.user}.\n` +
                  (cfg.deleteAfterCloseSec
                    ? `Canal se elimina en **${cfg.deleteAfterCloseSec}s**.`
                    : ""),
              )
              .setTimestamp(),
          ],
        })
        .catch(() => null);

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
                      value: `<@${ticket.userId}>`,
                      inline: true,
                    },
                    {
                      name: "Cerrado por",
                      value: interaction.user.tag,
                      inline: true,
                    },
                    { name: "Categoría", value: ticket.category, inline: true },
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
          channel
            .delete(`Ticket cerrado por ${interaction.user.tag}`)
            .catch(() => null);
        }, cfg.deleteAfterCloseSec * 1000);
      }
      return true;
    }

    return false;
  } catch (err) {
    logger.error({ err }, "ticketInteractions error");
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setDescription("❌ Error en el sistema de tickets."),
          ],
          ephemeral: true,
        })
        .catch(() => null);
    }
    return true;
  }
}
