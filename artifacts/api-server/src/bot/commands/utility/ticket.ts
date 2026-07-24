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
  ComponentType,
  type GuildTextBasedChannel,
  type TextChannel,
  type GuildChannel,
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

// ── Colors ────────────────────────────────────────────────────────────────────
const PINK  = 0xff2d6b;
const CYAN  = 0x00f5d4;
const GREEN = 0x00ff9f;
const AMBER = 0xff9900;

const EMBED_FIELD_LIMIT = 1024;
const SELECT_DESCRIPTION_LIMIT = 100;

// ── Slash command definition ──────────────────────────────────────────────────
const configGroup = new SlashCommandSubcommandGroupBuilder()
  .setName("config")
  .setDescription("⚙️ Ajustes avanzados del sistema de tickets")
  .addSubcommand((s) =>
    s
      .setName("close-policy")
      .setDescription("🔐 ¿Quién puede cerrar tickets?")
      .addStringOption((o) =>
        o
          .setName("politica")
          .setDescription("📋 Política de cierre")
          .setRequired(true)
          .addChoices(
            { name: "Dueño o staff (por defecto)", value: "both" },
            { name: "Solo staff", value: "staff_only" },
            { name: "Solo el dueño del ticket", value: "owner_only" },
          ),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("claim-policy")
      .setDescription("¿Quién puede reclamar tickets?")
      .addStringOption((o) =>
        o
          .setName("politica")
          .setDescription("Política de claim")
          .setRequired(true)
          .addChoices(
            { name: "Solo staff (por defecto)", value: "staff_only" },
            { name: "Cualquier miembro", value: "anyone" },
          ),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("staff-roles")
      .setDescription("Gestiona los roles de staff para tickets")
      .addStringOption((o) =>
        o
          .setName("accion")
          .setDescription("Añadir o quitar rol")
          .setRequired(true)
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
    s
      .setName("delete-delay")
      .setDescription("Segundos antes de borrar el canal al cerrar (0 = no borrar)")
      .addIntegerOption((o) =>
        o
          .setName("segundos")
          .setDescription("0–300 segundos")
          .setMinValue(0)
          .setMaxValue(300)
          .setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("welcome")
      .setDescription("Mensaje de bienvenida dentro del ticket. Vars: {user} {category} {subject}")
      .addStringOption((o) =>
        o
          .setName("mensaje")
          .setDescription("Texto del mensaje (vacío = desactivar)")
          .setRequired(true)
          .setMaxLength(500),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("channel-name")
      .setDescription("Formato del nombre del canal. Vars: {username} {userid4} {category} {number}")
      .addStringOption((o) =>
        o
          .setName("formato")
          .setDescription("Ej: ticket-{username}-{userid4}")
          .setRequired(true)
          .setMaxLength(80),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("panel")
      .setDescription("Personaliza el título y descripción del panel de tickets")
      .addStringOption((o) =>
        o.setName("titulo").setDescription("Título del embed del panel").setRequired(false).setMaxLength(150),
      )
      .addStringOption((o) =>
        o
          .setName("descripcion")
          .setDescription("Descripción del embed del panel")
          .setRequired(false)
          .setMaxLength(1000),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("categories")
      .setDescription("Gestiona las categorías personalizadas del panel")
      .addStringOption((o) =>
        o
          .setName("accion")
          .setDescription("Acción")
          .setRequired(true)
          .addChoices(
            { name: "➕ Añadir categoría", value: "add" },
            { name: "➖ Quitar categoría por ID", value: "remove" },
            { name: "🗑️ Restaurar predeterminadas", value: "reset" },
            { name: "📋 Ver categorías actuales", value: "list" },
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
  .setDescription("🎫 Tickets de soporte — panel, claim, close y setup")
  .addSubcommand((s) =>
    s
      .setName("setup")
      .setDescription("🛠️ Configura categoría, staff y logs (admin)")
      .addChannelOption((o) =>
        o
          .setName("categoria")
          .setDescription("📁 Categoría donde se crearán los tickets")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true),
      )
      .addRoleOption((o) =>
        o
          .setName("staff")
          .setDescription("🛡️ Rol principal de staff")
          .setRequired(true),
      )
      .addChannelOption((o) =>
        o
          .setName("logs")
          .setDescription("📡 Canal de logs y transcripts (opcional)")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false),
      )
      .addIntegerOption((o) =>
        o
          .setName("max_abiertos")
          .setDescription("🔢 Máx. tickets abiertos por usuario (1–5)")
          .setMinValue(1)
          .setMaxValue(5)
          .setRequired(false),
      )
      .addIntegerOption((o) =>
        o
          .setName("borrar_tras")
          .setDescription("⏱️ Segundos antes de borrar al cerrar (0 = no)")
          .setMinValue(0)
          .setMaxValue(300)
          .setRequired(false),
      ),
  )
  .addSubcommandGroup(() => configGroup)
  .addSubcommand((s) =>
    s
      .setName("panel")
      .setDescription("📌 Publica el panel para abrir tickets")
      .addChannelOption((o) =>
        o
          .setName("canal")
          .setDescription("📢 Canal donde publicar (por defecto: este)")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("close")
      .setDescription("🔒 Cierra el ticket de este canal")
      .addStringOption((o) =>
        o
          .setName("razon")
          .setDescription("📝 Motivo del cierre")
          .setRequired(false),
      ),
  )
  .addSubcommand((s) =>
    s.setName("claim").setDescription("✋ Reclama este ticket como staff"),
  )
  .addSubcommand((s) =>
    s
      .setName("add")
      .setDescription("➕ Añade un usuario al ticket")
      .addUserOption((o) =>
        o
          .setName("usuario")
          .setDescription("👤 Usuario a añadir")
          .setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("remove")
      .setDescription("➖ Quita un usuario del ticket")
      .addUserOption((o) =>
        o
          .setName("usuario")
          .setDescription("👤 Usuario a quitar")
          .setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s.setName("status").setDescription("📊 Muestra la config actual de tickets"),
  );

// ── Helpers ───────────────────────────────────────────────────────────────────
function adminOnly(interaction: ChatInputCommandInteraction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}

function manageGuild(interaction: ChatInputCommandInteraction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

function closePolicyLabel(p: string): string {
  return p === "staff_only" ? "Solo staff" : p === "owner_only" ? "Solo el dueño" : "Dueño o staff";
}

function claimPolicyLabel(p: string): string {
  return p === "anyone" ? "Cualquier miembro" : "Solo staff";
}

export function ticketControlRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Reclamar")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("✋"),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Cerrar")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒"),
  );
}

function errorEmbed(description: string, botIcon?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(PINK)
    .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
    .setDescription(description)
    .setTimestamp();
}

function successEmbed(title: string, description: string, botIcon?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(GREEN)
    .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function configUpdatedEmbed(title: string, description: string, botIcon?: string): EmbedBuilder {
  return successEmbed(title, description, botIcon);
}

function truncateText(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatPanelCategories(categories: TicketCategory[]): string {
  const lines: string[] = [];
  let total = 0;

  for (const category of categories) {
    const line = `${category.emoji} **${category.label}**\n${truncateText(category.description, 120)}`;
    const nextTotal = total + line.length + (lines.length ? 2 : 0);

    if (nextTotal > EMBED_FIELD_LIMIT) {
      const remaining = `+ ${categories.length - lines.length} categorías más en el selector.`;
      if (total + remaining.length + (lines.length ? 2 : 0) <= EMBED_FIELD_LIMIT) {
        lines.push(remaining);
      }
      break;
    }

    lines.push(line);
    total = nextTotal;
  }

  return lines.join("\n\n") || "No hay categorías configuradas.";
}

function buildTicketPanelEmbed(
  cfg: Awaited<ReturnType<typeof getTicketConfig>>,
  categories: TicketCategory[],
  botIcon?: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(PINK)
    .setAuthor({ name: "Zero Two · Centro de Tickets", iconURL: botIcon })
    .setTitle(cfg.panelTitle)
    .setDescription(
      cfg.panelDescription ||
        "Selecciona una categoría para abrir un ticket privado con el staff.",
    )
    .addFields(
      {
        name: "Categorías disponibles",
        value: formatPanelCategories(categories),
      },
      {
        name: "Antes de abrir",
        value:
          "Elige la categoría correcta, describe el caso con detalle y evita abrir tickets duplicados.",
      },
      {
        name: "Límite",
        value: `Máximo **${cfg.maxOpen}** ticket(s) abierto(s) por usuario.`,
        inline: true,
      },
    )
    .setFooter({ text: "Zero Two · Soporte privado y transcripts", iconURL: botIcon })
    .setTimestamp();
}

function buildTicketPanelSelect(categories: TicketCategory[]): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId("ticket_open")
    .setPlaceholder("Elige el motivo de tu ticket")
    .addOptions(
      categories.slice(0, 25).map((category) => ({
        label: truncateText(category.label, 100),
        description: truncateText(category.description || "Abrir ticket", SELECT_DESCRIPTION_LIMIT),
        value: category.id,
        emoji: category.emoji,
      })),
    );
}

function isGuildTextSendableChannel(channel: unknown): channel is GuildTextBasedChannel {
  return Boolean(
    channel &&
      typeof channel === "object" &&
      "send" in channel &&
      "permissionsFor" in channel,
  );
}

// ── Config handlers ───────────────────────────────────────────────────────────
async function handleConfig(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  sub: string,
  botIcon?: string,
) {
  if (sub === "close-policy") {
    const policy = interaction.options.getString("politica", true) as
      | "both"
      | "staff_only"
      | "owner_only";
    const cfg = await setTicketConfig(guildId, { closePolicy: policy });
    await interaction.reply({
      embeds: [
        configUpdatedEmbed(
          "✅ Política de cierre actualizada",
          `Ahora: **${closePolicyLabel(cfg.closePolicy)}**.`,
          botIcon,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (sub === "claim-policy") {
    const policy = interaction.options.getString("politica", true) as "staff_only" | "anyone";
    const cfg = await setTicketConfig(guildId, { claimPolicy: policy });
    await interaction.reply({
      embeds: [
        configUpdatedEmbed(
          "✅ Política de claim actualizada",
          `Ahora: **${claimPolicyLabel(cfg.claimPolicy)}**.`,
          botIcon,
        ),
      ],
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
          embeds: [errorEmbed("❌ Indica un rol para añadir o quitar.", botIcon)],
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

    const roles = cfg.staffRoleIds.length
      ? cfg.staffRoleIds.map((id) => `<@&${id}>`).join(", ")
      : "`sin roles`";

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
      embeds: [
        configUpdatedEmbed(
          "✅ Tiempo de borrado actualizado",
          cfg.deleteAfterCloseSec
            ? `Los canales se borrarán tras **${cfg.deleteAfterCloseSec}s**.`
            : "Los canales no se borrarán automáticamente.",
          botIcon,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (sub === "welcome") {
    const raw = interaction.options.getString("mensaje", true).trim();
    const welcomeMessage = ["off", "none", "null", "-"].includes(raw.toLowerCase()) ? "" : raw;
    const cfg = await setTicketConfig(guildId, { welcomeMessage });
    await interaction.reply({
      embeds: [
        configUpdatedEmbed(
          "✅ Bienvenida actualizada",
          cfg.welcomeMessage
            ? `\`\`\`${cfg.welcomeMessage.slice(0, 500)}\`\`\``
            : "Mensaje personalizado desactivado.",
          botIcon,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (sub === "channel-name") {
    const format = interaction.options.getString("formato", true).trim();
    if (
      !format.includes("{username}") &&
      !format.includes("{userid4}") &&
      !format.includes("{number}")
    ) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            "❌ Usa al menos una variable: `{username}`, `{userid4}` o `{number}`.",
            botIcon,
          ),
        ],
        ephemeral: true,
      });
      return;
    }
    const cfg = await setTicketConfig(guildId, { channelNameFormat: format });
    await interaction.reply({
      embeds: [
        configUpdatedEmbed("✅ Formato de canal actualizado", `\`${cfg.channelNameFormat}\``, botIcon),
      ],
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
        embeds: [
          new EmbedBuilder()
            .setColor(CYAN)
            .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
            .setTitle(cfg.panelTitle)
            .setDescription(cfg.panelDescription)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    const cfg = await setTicketConfig(guildId, {
      ...(title ? { panelTitle: title.trim() } : {}),
      ...(description ? { panelDescription: description.trim() } : {}),
    });

    await interaction.reply({
      embeds: [
        configUpdatedEmbed(
          "✅ Panel actualizado",
          `**${cfg.panelTitle}**\n${cfg.panelDescription.slice(0, 500)}`,
          botIcon,
        ),
      ],
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
            .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
            .setTitle(`📋 Categorías (${cats.length})`)
            .setDescription(
              cats
                .map(
                  (c) =>
                    `${c.emoji} **${c.label}** \`${c.id}\`\n${c.description}${
                      c.staffRoleIds?.length
                        ? `\nRoles extra: ${c.staffRoleIds.map((id) => `<@&${id}>`).join(", ")}`
                        : ""
                    }`,
                )
                .join("\n\n") || "No hay categorías.",
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    if (action === "reset") {
      await setTicketConfig(guildId, { categories: [] });
      await interaction.reply({
        embeds: [
          configUpdatedEmbed(
            "✅ Categorías restauradas",
            "El panel volverá a usar las categorías predeterminadas.",
            botIcon,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (action === "remove") {
      const id = interaction.options.getString("id")?.trim().toLowerCase();
      if (!id) {
        await interaction.reply({
          embeds: [errorEmbed("❌ Indica la ID de la categoría a quitar.", botIcon)],
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
          embeds: [
            errorEmbed(
              "❌ Para añadir necesitas `id` válida y `label`.\nLa ID solo admite letras, números, `_` y `-`.",
              botIcon,
            ),
          ],
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
        embeds: [
          configUpdatedEmbed("✅ Categoría guardada", `${emoji} **${label}** \`${id}\``, botIcon),
        ],
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
        embeds: [errorEmbed("❌ Este comando solo funciona en servidores.")],
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand(false);
    const group = interaction.options.getSubcommandGroup(false);
    const guildId = interaction.guild.id;
    const botIcon = client.user?.displayAvatarURL();

    // ── /ticket config * ──────────────────────────────────────────────────────
    if (group === "config") {
      if (!manageGuild(interaction)) {
        await interaction.reply({
          embeds: [errorEmbed("❌ Necesitas el permiso **Gestionar servidor**.", botIcon)],
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
          embeds: [errorEmbed("❌ Solo administradores pueden ejecutar este comando.", botIcon)],
          ephemeral: true,
        });
        return;
      }

      const category = interaction.options.getChannel("categoria", true);
      const staff = interaction.options.getRole("staff", true);
      const logs = interaction.options.getChannel("logs");
      const maxOpen = interaction.options.getInteger("max_abiertos") ?? 1;
      const deleteAfterCloseSec = interaction.options.getInteger("borrar_tras");

      const current = await getTicketConfig(guildId);
      const allRoleIds = current.staffRoleIds.includes(staff.id)
        ? current.staffRoleIds
        : [staff.id, ...current.staffRoleIds];

      const cfg = await setTicketConfig(guildId, {
        categoryId: category.id,
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
            .setDescription(
              "Usa `/ticket config` para ajustes avanzados y `/ticket panel` para publicar el menú.",
            )
            .addFields(
              { name: "📁 Categoría", value: `<#${cfg.categoryId}>`, inline: true },
              { name: "🛡️ Staff", value: `<@&${staff.id}>`, inline: true },
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
              {
                name: "⏱️ Borrar tras cierre",
                value: cfg.deleteAfterCloseSec ? `\`${cfg.deleteAfterCloseSec}s\`` : "`no`",
                inline: true,
              },
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── /ticket status ────────────────────────────────────────────────────────
    if (sub === "status") {
      const cfg = await getTicketConfig(guildId);
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
              {
                name: "📁 Categoría",
                value: cfg.categoryId ? `<#${cfg.categoryId}>` : "`sin configurar`",
                inline: true,
              },
              { name: "🛡️ Roles staff", value: rolesText, inline: true },
              {
                name: "📡 Logs",
                value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : "`—`",
                inline: true,
              },
              { name: "🔢 Max abiertos", value: `\`${cfg.maxOpen}\``, inline: true },
              {
                name: "⏱️ Borrar tras cierre",
                value: cfg.deleteAfterCloseSec ? `\`${cfg.deleteAfterCloseSec}s\`` : "`no`",
                inline: true,
              },
              {
                name: "🔒 Política cierre",
                value: closePolicyLabel(cfg.closePolicy),
                inline: true,
              },
              {
                name: "✋ Política claim",
                value: claimPolicyLabel(cfg.claimPolicy),
                inline: true,
              },
              {
                name: "📝 Nombre de canal",
                value: `\`${cfg.channelNameFormat}\``,
                inline: true,
              },
              {
                name: "💬 Mensaje bienvenida",
                value: cfg.welcomeMessage
                  ? `\`\`\`${cfg.welcomeMessage.slice(0, 80)}\`\`\``
                  : "`—`",
                inline: false,
              },
              {
                name: `📋 Categorías (${cats.length})`,
                value:
                  cats.map((c) => `${c.emoji} **${c.label}** \`${c.id}\``).join("\n") ||
                  "`ninguna`",
                inline: false,
              },
              {
                name: "🎨 Panel — título",
                value: `\`${cfg.panelTitle}\``,
                inline: false,
              },
            )
            .setFooter({
              text:
                cfg.categoryId && cfg.staffRoleIds.length
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

    // ── /ticket panel ─────────────────────────────────────────────────────────
    if (sub === "panel") {
      if (!manageGuild(interaction)) {
        await interaction.reply({
          embeds: [errorEmbed("❌ Necesitas el permiso **Gestionar servidor**.", botIcon)],
          ephemeral: true,
        });
        return;
      }

      const cfg = await getTicketConfig(guildId);
      if (!cfg.categoryId || !cfg.staffRoleIds.length) {
        await interaction.reply({
          embeds: [
            errorEmbed("⚠️ Primero configura el sistema con `/ticket setup`.", botIcon),
          ],
          ephemeral: true,
        });
        return;
      }

      const target = interaction.options.getChannel("canal") ?? interaction.channel;
      if (!isGuildTextSendableChannel(target)) {
        await interaction.reply({
          embeds: [errorEmbed("❌ Canal inválido para publicar paneles.", botIcon)],
          ephemeral: true,
        });
        return;
      }

      const cats = resolveCategories(cfg);
      if (!cats.length) {
        await interaction.reply({
          embeds: [
            errorEmbed("⚠️ No hay categorías disponibles para el panel.", botIcon),
          ],
          ephemeral: true,
        });
        return;
      }

      const botMember =
        interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
      const targetPermissions = target.permissionsFor(botMember);

      if (
        !targetPermissions?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
        ])
      ) {
        await interaction.reply({
          embeds: [
            errorEmbed(
              "❌ Necesito los permisos **Ver canal**, **Enviar mensajes** e **Insertar enlaces** en ese canal.",
              botIcon,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const embed = buildTicketPanelEmbed(cfg, cats, botIcon);
      const select = buildTicketPanelSelect(cats);

      const panelMessage = await target.send({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      });

      await interaction.reply({
        embeds: [
          successEmbed(
            "✅ Panel de tickets publicado",
            `Publicado en <#${target.id}> con **${Math.min(cats.length, 25)}** categoría(s).\n[Ir al panel](${panelMessage.url})`,
            botIcon,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── Ticket-channel commands ───────────────────────────────────────────────
    const ticket = await getTicketByChannel(interaction.channelId);
    const cfg = await getTicketConfig(guildId);
    const member = await interaction.guild.members.fetch(interaction.user.id);

    // ── /ticket close (con confirmación) ──────────────────────────────────────
    if (sub === "close") {
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [errorEmbed("❌ Este canal no es un ticket abierto.", botIcon)],
          ephemeral: true,
        });
        return;
      }

      if (!canCloseTicket(member, cfg, ticket.userId)) {
        const hint =
          cfg.closePolicy === "staff_only"
            ? "Solo el staff puede cerrar tickets."
            : cfg.closePolicy === "owner_only"
              ? "Solo el dueño del ticket puede cerrarlo."
              : "No tienes permiso para cerrar este ticket.";

        await interaction.reply({
          embeds: [errorEmbed(`❌ ${hint}`, botIcon)],
          ephemeral: true,
        });
        return;
      }

      const reason = interaction.options.getString("razon") ?? "Sin motivo";

      // Confirmación con botones
      const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close_confirm")
          .setLabel("Confirmar cierre")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔒"),
        new ButtonBuilder()
          .setCustomId("ticket_close_cancel")
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary),
      );

      const confirmEmbed = new EmbedBuilder()
        .setColor(AMBER)
        .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
        .setTitle("⚠️ Confirmar cierre de ticket")
        .setDescription(
          `¿Seguro que quieres cerrar este ticket?\n\n**Motivo:** ${reason}\n\nEsta acción no se puede deshacer.`,
        )
        .setTimestamp();

      const reply = await interaction.reply({
        embeds: [confirmEmbed],
        components: [confirmRow],
        ephemeral: true,
        fetchReply: true,
      });

      try {
        const confirmation = await reply.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 30_000,
          filter: (i) => i.user.id === interaction.user.id,
        });

        if (confirmation.customId === "ticket_close_cancel") {
          await confirmation.update({
            embeds: [
              new EmbedBuilder()
                .setColor(CYAN)
                .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
                .setDescription("✅ Cierre cancelado.")
                .setTimestamp(),
            ],
            components: [],
          });
          return;
        }

        // Confirmed → proceed to close
        await confirmation.deferUpdate();

        const channel = interaction.channel;
        if (!channel || !channel.isTextBased() || channel.isDMBased()) return;

        const transcript = await buildTranscript(channel as TextChannel);
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
            { name: "👤 Cerrado por", value: `${interaction.user}`, inline: true },
            { name: "📝 Motivo", value: reason, inline: true },
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [closeEmbed], components: [] });

        // Log + transcript
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
                    .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
                    .setTitle("📄 Ticket cerrado")
                    .addFields(
                      {
                        name: "Usuario",
                        value: `<@${ticket.userId}> (\`${ticket.username}\`)`,
                        inline: true,
                      },
                      { name: "Categoría", value: ticket.category, inline: true },
                      { name: "Cerrado por", value: interaction.user.tag, inline: true },
                      { name: "Motivo", value: reason, inline: false },
                    )
                    .setTimestamp(),
                ],
                files: [file],
              })
              .catch(() => null);
          }
        }

        // Auto-delete
        if (cfg.deleteAfterCloseSec > 0 && "delete" in channel) {
          setTimeout(() => {
            (channel as GuildChannel)
              .delete(`Ticket cerrado por ${interaction.user.tag}`)
              .catch(() => null);
          }, cfg.deleteAfterCloseSec * 1000);
        }
      } catch {
        // Timeout
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(AMBER)
              .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
              .setDescription("⏱️ Tiempo de confirmación agotado. El ticket no se ha cerrado.")
              .setTimestamp(),
          ],
          components: [],
        });
      }
      return;
    }

    // ── /ticket claim ─────────────────────────────────────────────────────────
    if (sub === "claim") {
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [errorEmbed("❌ Este canal no es un ticket abierto.", botIcon)],
          ephemeral: true,
        });
        return;
      }

      if (!canClaimTicket(member, cfg)) {
        await interaction.reply({
          embeds: [errorEmbed("❌ Solo el staff puede reclamar tickets.", botIcon)],
          ephemeral: true,
        });
        return;
      }

      // Check if already claimed
      if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(AMBER)
              .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
              .setTitle("⚠️ Ticket ya reclamado")
              .setDescription(
                `Este ticket ya está siendo atendido por <@${ticket.claimedBy}>.\nPuedes reclamarlo de todas formas si es necesario.`,
              )
              .setTimestamp(),
          ],
        });
        // Still allow re-claim below
      }

      await claimTicket(interaction.channelId, interaction.user.id, interaction.user.tag);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(CYAN)
            .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
            .setTitle("✋ Ticket reclamado")
            .setDescription(`${interaction.user} se encargará de este ticket.`)
            .setTimestamp(),
        ],
      });
      return;
    }

    // ── /ticket add | remove ──────────────────────────────────────────────────
    if (sub === "add" || sub === "remove") {
      if (!ticket || ticket.status === "closed") {
        await interaction.reply({
          embeds: [errorEmbed("❌ Este canal no es un ticket abierto.", botIcon)],
          ephemeral: true,
        });
        return;
      }

      if (!isStaff(member, cfg) && ticket.userId !== interaction.user.id) {
        await interaction.reply({
          embeds: [errorEmbed("❌ No tienes permiso para hacer eso.", botIcon)],
          ephemeral: true,
        });
        return;
      }

      const targetUser = interaction.options.getUser("usuario", true);
      const ch = interaction.channel;

      if (!ch || !("permissionOverwrites" in ch)) {
        await interaction.reply({
          embeds: [errorEmbed("❌ Canal inválido.", botIcon)],
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
            successEmbed("✅ Usuario añadido", `${targetUser} ha sido añadido al ticket.`, botIcon),
          ],
        });
      } else {
        if (targetUser.id === ticket.userId) {
          await interaction.reply({
            embeds: [errorEmbed("❌ No puedes quitar al dueño del ticket.", botIcon)],
            ephemeral: true,
          });
          return;
        }

        await ch.permissionOverwrites.delete(targetUser.id);

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(AMBER)
              .setAuthor({ name: "Zero Two · Tickets", iconURL: botIcon })
              .setDescription(`🗑️ ${targetUser} ha sido eliminado del ticket.`)
              .setTimestamp(),
          ],
        });
      }
    }
  },
};

export default command;