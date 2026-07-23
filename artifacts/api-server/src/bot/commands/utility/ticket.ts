import {
  SlashCommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getTicketConfig,
  setTicketConfig,
  getTicketByChannel,
  closeTicketRecord,
  claimTicket,
  isStaff,
  canCloseTicket,
  canClaimTicket,
  buildTranscript,
  resolveCategories,
  type TicketCategory,
} from "../../lib/tickets.js";

const PINK  = 0xff2d6b;
const CYAN  = 0x00f5d4;
const GREEN = 0x00ff9f;
const AMBER = 0xff9900;


// ── Slash command definition ──────────────────────────────────────────────────

const configGroup = new SlashCommandSubcommandGroupBuilder()
  .setName("config")
  .setDescription("⚙️ Ajustes avanzados del sistema de tickets")
  .addSubcommand((s) =>
    s.setName("close-policy")
      .setDescription("¿Quién puede cerrar tickets?")
      .addStringOption((o) =>
        o.setName("politica").setDescription("Política de cierre").setRequired(true)
          .addChoices(
            { name: "Dueño o staff (por defecto)", value: "both" },
            { name: "Solo staff",                  value: "staff_only" },
            { name: "Solo el dueño del ticket",    value: "owner_only" },
          ),
      ),
  )
  .addSubcommand((s) =>
    s.setName("claim-policy")
      .setDescription("¿Quién puede reclamar tickets?")
      .addStringOption((o) =>
        o.setName("politica").setDescription("Política de claim").setRequired(true)
          .addChoices(
            { name: "Solo staff (por defecto)", value: "staff_only" },
            { name: "Cualquier miembro",        value: "anyone" },
          ),
      ),
  )
  .addSubcommand((s) =>
    s.setName("staff-roles")
      .setDescription("Gestiona los roles de staff para tickets")
      .addStringOption((o) =>
        o.setName("accion").setDescription("Añadir o quitar rol").setRequired(true)
          .addChoices(
            { name: "➕ Añadir rol", value: "add" },
            { name: "➖ Quitar rol", value: "remove" },
            { name: "🗑️ Limpiar todos", value: "clear" },
          ),
      )
      .addRoleOption((o) =>
        o.setName("rol").setDescription("Rol a añadir/quitar").setRequired(false),
      ),
  )
  .addSubcommand((s) =>
    s.setName("delete-delay")
      .setDescription("Segundos antes de borrar el canal al cerrar (0 = no borrar)")
      .addIntegerOption((o) =>
        o.setName("segundos").setDescription("0–300 segundos").setMinValue(0).setMaxValue(300).setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s.setName("welcome")
      .setDescription("Mensaje de bienvenida dentro del ticket. Vars: {user} {category} {subject}")
      .addStringOption((o) =>
        o.setName("mensaje").setDescription("Texto del mensaje (vacío = desactivar)").setRequired(true).setMaxLength(500),
      ),
  )
  .addSubcommand((s) =>
    s.setName("channel-name")
      .setDescription("Formato del nombre del canal. Vars: {username} {userid4} {category} {number}")
      .addStringOption((o) =>
        o.setName("formato").setDescription("Ej: ticket-{username}-{userid4}").setRequired(true).setMaxLength(80),
      ),
  )
  .addSubcommand((s) =>
    s.setName("panel")
      .setDescription("Personaliza el título y descripción del panel de tickets")
      .addStringOption((o) =>
        o.setName("titulo").setDescription("Título del embed del panel").setRequired(false).setMaxLength(150),
      )
      .addStringOption((o) =>
        o.setName("descripcion").setDescription("Descripción del embed del panel").setRequired(false).setMaxLength(1000),
      ),
  )
  .addSubcommand((s) =>
    s.setName("categories")
      .setDescription("Gestiona las categorías personalizadas del panel")
      .addStringOption((o) =>
        o.setName("accion").setDescription("Acción").setRequired(true)
          .addChoices(
            { name: "➕ Añadir categoría",         value: "add" },
            { name: "➖ Quitar categoría por ID",   value: "remove" },
            { name: "🗑️ Restaurar predeterminadas", value: "reset" },
            { name: "📋 Ver categorías actuales",   value: "list" },
          ),
      )
      .addStringOption((o) =>
        o.setName("id").setDescription("ID única (sin espacios, ej: ventas)").setRequired(false).setMaxLength(32),
      )
      .addStringOption((o) =>
        o.setName("label").setDescription("Nombre visible (ej: Ventas)").setRequired(false).setMaxLength(50),
      )
      .addStringOption((o) =>
        o.setName("emoji").setDescription("Emoji (ej: 💼)").setRequired(false).setMaxLength(10),
      )
      .addStringOption((o) =>
        o.setName("descripcion").setDescription("Descripción corta").setRequired(false).setMaxLength(100),
      )
      .addRoleOption((o) =>
        o.setName("rol_extra").setDescription("Rol extra que ve esta categoría (opcional)").setRequired(false),
      ),
  );


const builder = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("🎫 Sistema de tickets de soporte")
  .addSubcommand((s) =>
    s.setName("setup")
      .setDescription("Configura el sistema de tickets (admin)")
      .addChannelOption((o) =>
        o.setName("categoria").setDescription("Categoría Discord donde se crearán los tickets")
          .addChannelTypes(ChannelType.GuildCategory).setRequired(true),
      )
      .addRoleOption((o) =>
        o.setName("staff").setDescription("Rol principal de staff").setRequired(true),
      )
      .addChannelOption((o) =>
        o.setName("logs").setDescription("Canal de logs/transcripts (opcional)")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false),
      )
      .addIntegerOption((o) =>
        o.setName("max_abiertos").setDescription("Máximo de tickets abiertos por usuario (1-5)")
          .setMinValue(1).setMaxValue(5).setRequired(false),
      )
      .addIntegerOption((o) =>
        o.setName("borrar_tras").setDescription("Segundos antes de borrar al cerrar (0 = no borrar)")
          .setMinValue(0).setMaxValue(300).setRequired(false),
      ),
  )
  .addSubcommandGroup(() => configGroup)
  .addSubcommand((s) =>
    s.setName("panel")
      .setDescription("Publica el panel para abrir tickets")
      .addChannelOption((o) =>
        o.setName("canal").setDescription("Canal donde publicar (default: actual)")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false),
      ),
  )
  .addSubcommand((s) =>
    s.setName("close")
      .setDescription("Cierra el ticket del canal actual")
      .addStringOption((o) =>
        o.setName("razon").setDescription("Motivo del cierre").setRequired(false),
      ),
  )
  .addSubcommand((s) => s.setName("claim").setDescription("Reclama el ticket"))
  .addSubcommand((s) =>
    s.setName("add")
      .setDescription("Añade un usuario al ticket")
      .addUserOption((o) => o.setName("usuario").setDescription("Usuario a añadir").setRequired(true)),
  )
  .addSubcommand((s) =>
    s.setName("remove")
      .setDescription("Quita un usuario del ticket")
      .addUserOption((o) => o.setName("usuario").setDescription("Usuario a quitar").setRequired(true)),
  )
  .addSubcommand((s) => s.setName("status").setDescription("Muestra la configuración de tickets"));


// ── Helpers ───────────────────────────────────────────────────────────────────

function adminOnly(interaction: ChatInputCommandInteraction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}
function manageGuild(interaction: ChatInputCommandInteraction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

function closePolicyLabel(p: string): string {
  return p === "staff_only" ? "Solo staff"
       : p === "owner_only" ? "Solo el dueño"
       : "Dueño o staff";
}
function claimPolicyLabel(p: string): string {
  return p === "anyone" ? "Cualquier miembro" : "Solo staff";
}

export function ticketControlRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Reclamar")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Cerrar")
      .setStyle(ButtonStyle.Danger),
  );
}

function configUpdatedEmbed(
  title: string,
  description: string,
  botIcon?: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(GREEN)
    .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

async function handleConfig(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  sub: string,
  botIcon?: string,
) {
  if (sub === "close-policy") {
    const policy = interaction.options.getString("politica", true) as "both" | "staff_only" | "owner_only";
    const cfg = await setTicketConfig(guildId, { closePolicy: policy });
    await interaction.reply({
      embeds: [configUpdatedEmbed("✅ Política de cierre actualizada", `Ahora: **${closePolicyLabel(cfg.closePolicy)}**.`, botIcon)],
      ephemeral: true,
    });
    return;
  }

  if (sub === "claim-policy") {
    const policy = interaction.options.getString("politica", true) as "staff_only" | "anyone";
    const cfg = await setTicketConfig(guildId, { claimPolicy: policy });
    await interaction.reply({
      embeds: [configUpdatedEmbed("✅ Política de claim actualizada", `Ahora: **${claimPolicyLabel(cfg.claimPolicy)}**.`, botIcon)],
      ephemeral: true,
    });
    return;
  }

  if (sub === "staff-roles") {
    const action = interaction.options.getString("accion", true);
    const role = interaction.options.getRole("rol");
    const current = await getTicketConfig(guildId);
    let staffRoleIds = [...current.staffRoleIds];

    if (action === "clear") {
      staffRoleIds = [];
    } else {
      if (!role) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Indica un rol para añadir o quitar.")],
          ephemeral: true,
        });
        return;
      }
      if (action === "add" && !staffRoleIds.includes(role.id)) {
        staffRoleIds.push(role.id);
      }
      if (action === "remove") {
        staffRoleIds = staffRoleIds.filter((id) => id !== role.id);
      }
    }

    const cfg = await setTicketConfig(guildId, {
      staffRoleIds,
      staffRoleId: staffRoleIds[0] ?? null,
    });
    const roles = cfg.staffRoleIds.length ? cfg.staffRoleIds.map((id) => `<@&${id}>`).join(", ") : "`sin roles`";
    await interaction.reply({
      embeds: [configUpdatedEmbed("✅ Roles staff actualizados", roles, botIcon)],
      ephemeral: true,
    });
    return;
  }

  if (sub === "delete-delay") {
    const seconds = interaction.options.getInteger("segundos", true);
    const cfg = await setTicketConfig(guildId, { deleteAfterCloseSec: seconds });
    await interaction.reply({
      embeds: [configUpdatedEmbed("✅ Tiempo de borrado actualizado", cfg.deleteAfterCloseSec ? `Los canales se borrarán tras **${cfg.deleteAfterCloseSec}s**.` : "Los canales no se borrarán automáticamente.", botIcon)],
      ephemeral: true,
    });
    return;
  }

  if (sub === "welcome") {
    const raw = interaction.options.getString("mensaje", true).trim();
    const welcomeMessage = ["off", "none", "null", "-"].includes(raw.toLowerCase()) ? "" : raw;
    const cfg = await setTicketConfig(guildId, { welcomeMessage });
    await interaction.reply({
      embeds: [configUpdatedEmbed("✅ Bienvenida actualizada", cfg.welcomeMessage ? `\`\`\`${cfg.welcomeMessage.slice(0, 500)}\`\`\`` : "Mensaje personalizado desactivado.", botIcon)],
      ephemeral: true,
    });
    return;
  }

  if (sub === "channel-name") {
    const format = interaction.options.getString("formato", true).trim();
    if (!format.includes("{username}") && !format.includes("{userid4}") && !format.includes("{number}")) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Usa al menos una variable: `{username}`, `{userid4}` o `{number}`.")],
        ephemeral: true,
      });
      return;
    }
    const cfg = await setTicketConfig(guildId, { channelNameFormat: format });
    await interaction.reply({
      embeds: [configUpdatedEmbed("✅ Formato de canal actualizado", `\`${cfg.channelNameFormat}\``, botIcon)],
      ephemeral: true,
    });
    return;
  }

  if (sub === "panel") {
    const title = interaction.options.getString("titulo");
    const description = interaction.options.getString("descripcion");
    if (!title && !description) {
      const cfg = await getTicketConfig(guildId);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(CYAN).setTitle(cfg.panelTitle).setDescription(cfg.panelDescription)],
        ephemeral: true,
      });
      return;
    }
    const cfg = await setTicketConfig(guildId, {
      ...(title ? { panelTitle: title.trim() } : {}),
      ...(description ? { panelDescription: description.trim() } : {}),
    });
    await interaction.reply({
      embeds: [configUpdatedEmbed("✅ Panel actualizado", `**${cfg.panelTitle}**\n${cfg.panelDescription.slice(0, 500)}`, botIcon)],
      ephemeral: true,
    });
    return;
  }

  if (sub === "categories") {
    const action = interaction.options.getString("accion", true);
    const current = await getTicketConfig(guildId);

    if (action === "list") {
      const cats = resolveCategories(current);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(CYAN)
            .setTitle(`📋 Categorías (${cats.length})`)
            .setDescription(cats.map((c) => `${c.emoji} **${c.label}** \`${c.id}\` — ${c.description}${c.staffRoleIds?.length ? `\nRoles extra: ${c.staffRoleIds.map((id) => `<@&${id}>`).join(", ")}` : ""}`).join("\n\n")),
        ],
        ephemeral: true,
      });
      return;
    }

    if (action === "reset") {
      await setTicketConfig(guildId, { categories: [] });
      await interaction.reply({
        embeds: [configUpdatedEmbed("✅ Categorías restauradas", "El panel volverá a usar las categorías predeterminadas.", botIcon)],
        ephemeral: true,
      });
      return;
    }

    if (action === "remove") {
      const id = interaction.options.getString("id")?.trim().toLowerCase();
      if (!id) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Indica la ID de la categoría a quitar.")],
          ephemeral: true,
        });
        return;
      }
      const base = current.categories.length ? current.categories : [...resolveCategories(current)];
      const categories = base.filter((c) => c.id !== id);
      await setTicketConfig(guildId, { categories });
      await interaction.reply({
        embeds: [configUpdatedEmbed("✅ Categoría eliminada", `Quitada: \`${id}\`.`, botIcon)],
        ephemeral: true,
      });
      return;
    }

    if (action === "add") {
      const id = interaction.options.getString("id")?.trim().toLowerCase();
      const label = interaction.options.getString("label")?.trim();
      const emoji = interaction.options.getString("emoji")?.trim() || "🎫";
      const description = interaction.options.getString("descripcion")?.trim() || label || "Ticket";
      const extraRole = interaction.options.getRole("rol_extra");
      if (!id || !/^[a-z0-9_-]{1,32}$/.test(id) || !label) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Para añadir necesitas `id` válida y `label`. La ID solo admite letras, números, `_` y `-`.")],
          ephemeral: true,
        });
        return;
      }
      const nextCategory: TicketCategory = {
        id,
        label,
        emoji,
        description,
        ...(extraRole ? { staffRoleIds: [extraRole.id] } : {}),
      };
      const base = current.categories.length ? current.categories : [...resolveCategories(current)];
      const categories = [...base.filter((c) => c.id !== id), nextCategory].slice(0, 25);
      await setTicketConfig(guildId, { categories });
      await interaction.reply({
        embeds: [configUpdatedEmbed("✅ Categoría guardada", `${emoji} **${label}** \`${id}\``, botIcon)],
        ephemeral: true,
      });
    }
  }
}

// ── Command handler ───────────────────────────────────────────────────────────

const command: Command = {
  data: builder as SlashCommandBuilder,
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Solo en servidores.")],
        ephemeral: true,
      });
      return;
    }

    const sub   = interaction.options.getSubcommand(false);
    const group = interaction.options.getSubcommandGroup(false);
    const guildId  = interaction.guild.id;
    const botIcon  = client.user?.displayAvatarURL();

    // ── /ticket config * ──────────────────────────────────────────────────────
    if (group === "config") {
      if (!manageGuild(interaction)) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Necesitas **Gestionar servidor**.")],
          ephemeral: true,
        });
        return;
      }
      await handleConfig(interaction, guildId, sub!, botIcon);
      return;
    }

    // ── /ticket setup ─────────────────────────────────────────────────────────
    if (sub === "setup") {
      if (!adminOnly(interaction)) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Solo administradores.")],
          ephemeral: true,
        });
        return;
      }

      const category   = interaction.options.getChannel("categoria", true);
      const staff      = interaction.options.getRole("staff", true);
      const logs       = interaction.options.getChannel("logs");
      const maxOpen    = interaction.options.getInteger("max_abiertos") ?? 1;
      const deleteAfterCloseSec = interaction.options.getInteger("borrar_tras");

      const current = await getTicketConfig(guildId);
      const allRoleIds = current.staffRoleIds.includes(staff.id)
        ? current.staffRoleIds
        : [staff.id, ...current.staffRoleIds];

      const cfg = await setTicketConfig(guildId, {
        categoryId:  category.id,
        staffRoleId: staff.id,
        staffRoleIds: allRoleIds,
        logChannelId: logs?.id ?? current.logChannelId,
        maxOpen,
        ...(deleteAfterCloseSec !== null ? { deleteAfterCloseSec } : {}),
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
            .setTitle("✅ Sistema de tickets configurado")
            .addFields(
              { name: "📁 Categoría",     value: `<#${cfg.categoryId}>`,          inline: true },
              { name: "🛡️ Staff",          value: `<@&${staff.id}>`,               inline: true },
              { name: "📡 Logs",           value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "`—`", inline: true },
              { name: "🔢 Max abiertos",   value: `\`${cfg.maxOpen}\` por usuario`, inline: true },
              { name: "⏱️ Borrar tras cierre", value: cfg.deleteAfterCloseSec ? `\`${cfg.deleteAfterCloseSec}s\`` : "`no`", inline: true },
            )
            .setDescription("Usa `/ticket config` para ajustes avanzados y `/ticket panel` para publicar el menú.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── /ticket status ────────────────────────────────────────────────────────
    if (sub === "status") {
      const cfg  = await getTicketConfig(guildId);
      const cats = resolveCategories(cfg);
      const rolesText = cfg.staffRoleIds.length
        ? cfg.staffRoleIds.map((r) => `<@&${r}>`).join(", ")
        : "`sin configurar`";

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(CYAN)
            .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
            .setTitle("📡 Configuración del sistema de tickets")
            .addFields(
              { name: "📁 Categoría",          value: cfg.categoryId ? `<#${cfg.categoryId}>` : "`sin configurar`", inline: true },
              { name: "🛡️ Roles staff",         value: rolesText,                              inline: true },
              { name: "📡 Logs",                value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "`—`", inline: true },
              { name: "🔢 Max abiertos",        value: `\`${cfg.maxOpen}\``,                   inline: true },
              { name: "⏱️ Borrar tras cierre",  value: cfg.deleteAfterCloseSec ? `\`${cfg.deleteAfterCloseSec}s\`` : "`no`", inline: true },
              { name: "🔒 Política cierre",     value: closePolicyLabel(cfg.closePolicy),       inline: true },
              { name: "✋ Política claim",       value: claimPolicyLabel(cfg.claimPolicy),       inline: true },
              { name: "📝 Nombre de canal",     value: `\`${cfg.channelNameFormat}\``,           inline: true },
              { name: "💬 Mensaje bienvenida",  value: cfg.welcomeMessage ? `\`\`\`${cfg.welcomeMessage.slice(0, 80)}\`\`\`` : "`—`", inline: false },
              { name: `📋 Categorías (${cats.length})`, value: cats.map((c) => `${c.emoji} **${c.label}** \`${c.id}\``).join("\n"), inline: false },
              { name: "🎨 Panel — título",      value: `\`${cfg.panelTitle}\``,                  inline: false },
            )
            .setFooter({ text: cfg.categoryId && cfg.staffRoleIds.length ? "Listo para /ticket panel" : "Falta /ticket setup", iconURL: botIcon })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── /ticket panel ─────────────────────────────────────────────────────────
    if (sub === "panel") {
      if (!manageGuild(interaction)) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Necesitas **Gestionar servidor**.")],
          ephemeral: true,
        });
        return;
      }
      const cfg = await getTicketConfig(guildId);
      if (!cfg.categoryId || !cfg.staffRoleIds.length) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(AMBER).setDescription("⚠️ Primero configura con `/ticket setup`.")],
          ephemeral: true,
        });
        return;
      }

      const target = interaction.options.getChannel("canal") ?? interaction.channel;
      if (!target || !("send" in target)) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Canal inválido.")],
          ephemeral: true,
        });
        return;
      }

      const cats = resolveCategories(cfg);
      const embed = new EmbedBuilder()
        .setColor(PINK)
        .setAuthor({ name: "Central de Tickets // Zero Two", iconURL: botIcon })
        .setTitle(cfg.panelTitle)
        .setDescription(cfg.panelDescription || "Selecciona una categoría para abrir un ticket.")
        .addFields({
          name: "📋 Categorías disponibles",
          value: cats.map((c) => `${c.emoji} **${c.label}** — ${c.description}`).join("\n"),
        })
        .setFooter({ text: "Zero Two · Sistema de Tickets", iconURL: botIcon })
        .setTimestamp();

      const select = new StringSelectMenuBuilder()
        .setCustomId("ticket_open")
        .setPlaceholder("Selecciona una categoría…")
        .addOptions(cats.map((c) => ({
          label: c.label,
          description: c.description,
          value: c.id,
          emoji: c.emoji,
        })));

      await (target as typeof interaction.channel & { send: Function }).send({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      });

      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(GREEN).setDescription(`✅ Panel publicado en <#${target.id}>.`)],
        ephemeral: true,
      });
      return;
    }

    // ── Ticket-channel commands ───────────────────────────────────────────────
    const ticket = await getTicketByChannel(interaction.channelId);
    const cfg    = await getTicketConfig(guildId);
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (sub === "close") {
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Este canal no es un ticket abierto.")],
          ephemeral: true,
        });
        return;
      }
      if (!canCloseTicket(member, cfg, ticket.userId)) {
        const hint = cfg.closePolicy === "staff_only" ? "Solo el staff puede cerrar tickets."
                   : cfg.closePolicy === "owner_only"  ? "Solo el dueño del ticket puede cerrarlo."
                   : "No tienes permiso para cerrar este ticket.";
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription(`❌ ${hint}`)],
          ephemeral: true,
        });
        return;
      }

      const reason = interaction.options.getString("razon");
      await interaction.deferReply();

      const channel = interaction.channel;
      if (!channel || !channel.isTextBased() || channel.isDMBased()) return;

      const transcript = await buildTranscript(channel as import("discord.js").TextChannel);
      await closeTicketRecord(interaction.channelId, interaction.user.id, interaction.user.tag, reason);

      const closeEmbed = new EmbedBuilder()
        .setColor(PINK)
        .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
        .setTitle("🔒 Ticket cerrado")
        .addFields(
          { name: "👤 Cerrado por", value: `${interaction.user}`, inline: true },
          { name: "📝 Motivo",      value: reason ?? "Sin motivo",  inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [closeEmbed] });

      if (cfg.logChannelId) {
        const logCh = interaction.guild.channels.cache.get(cfg.logChannelId);
        if (logCh?.isTextBased()) {
          const file = new AttachmentBuilder(Buffer.from(transcript, "utf8"), {
            name: `ticket-${ticket.id}-${ticket.userId}.txt`,
          });
          await logCh.send({
            embeds: [
              new EmbedBuilder().setColor(PINK).setTitle("📄 Ticket cerrado")
                .addFields(
                  { name: "Usuario",     value: `<@${ticket.userId}> (\`${ticket.username}\`)`, inline: true },
                  { name: "Categoría",   value: ticket.category, inline: true },
                  { name: "Cerrado por", value: interaction.user.tag, inline: true },
                  { name: "Motivo",      value: reason ?? "—", inline: false },
                ).setTimestamp(),
            ],
            files: [file],
          }).catch(() => null);
        }
      }

      if (cfg.deleteAfterCloseSec > 0 && "delete" in channel) {
        setTimeout(() => {
          (channel as import("discord.js").GuildChannel)
            .delete(`Ticket cerrado por ${interaction.user.tag}`).catch(() => null);
        }, cfg.deleteAfterCloseSec * 1000);
      }
      return;
    }

    if (sub === "claim") {
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Este canal no es un ticket abierto.")],
          ephemeral: true,
        });
        return;
      }
      if (!canClaimTicket(member, cfg)) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Solo el staff puede reclamar tickets.")],
          ephemeral: true,
        });
        return;
      }
      await claimTicket(interaction.channelId, interaction.user.id, interaction.user.tag);
      await interaction.reply({
        embeds: [
          new EmbedBuilder().setColor(CYAN)
            .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
            .setTitle("✋ Ticket reclamado")
            .setDescription(`${interaction.user} se encargará de este ticket.`)
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === "add" || sub === "remove") {
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Este canal no es un ticket abierto.")],
          ephemeral: true,
        });
        return;
      }
      if (!isStaff(member, cfg) && ticket.userId !== interaction.user.id) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ No tienes permiso para eso.")],
          ephemeral: true,
        });
        return;
      }
      const targetUser = interaction.options.getUser("usuario", true);
      const ch = interaction.channel;
      if (!ch || !("permissionOverwrites" in ch)) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ Canal inválido.")],
          ephemeral: true,
        });
        return;
      }
      if (sub === "add") {
        await ch.permissionOverwrites.edit(targetUser.id, {
          ViewChannel: true, SendMessages: true,
          AttachFiles: true, ReadMessageHistory: true,
        });
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(GREEN).setDescription(`✅ ${targetUser} añadido al ticket.`)],
        });
      } else {
        if (targetUser.id === ticket.userId) {
          await interaction.reply({
            embeds: [new EmbedBuilder().setColor(PINK).setDescription("❌ No puedes quitar al dueño del ticket.")],
            ephemeral: true,
          });
          return;
        }
        await ch.permissionOverwrites.delete(targetUser.id);
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(AMBER).setDescription(`🗑️ ${targetUser} eliminado del ticket.`)],
        });
      }
    }
  },
};

export default command;
