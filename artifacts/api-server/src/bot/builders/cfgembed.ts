import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChatInputCommandInteraction,
} from "discord.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CfgEmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface CfgEmbedState {
  title?: string;
  description?: string;
  color: number;
  authorName?: string;
  authorIconURL?: string;
  footerText?: string;
  imageURL?: string;
  thumbnailURL?: string;
  fields: CfgEmbedField[];
  targetChannelId: string;
  originalInteraction: ChatInputCommandInteraction;
  botBannerURL: string | null;
  expiresAt: number;
}

export const activeSessions = new Map<string, CfgEmbedState>();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of activeSessions.entries()) {
    if (now > state.expiresAt) activeSessions.delete(key);
  }
}, 60_000);

// ── Embed builders ─────────────────────────────────────────────────────────────

export function buildPreviewEmbed(
  state: CfgEmbedState,
  botIconURL?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(state.color);

  if (state.title) embed.setTitle(state.title);

  if (state.description) {
    embed.setDescription(state.description);
  } else if (!state.title && !state.authorName && !state.fields.length && !state.imageURL) {
    embed.setDescription("*— Embed vacío · Usa el menú para añadir contenido —*");
  }

  if (state.authorName) {
    embed.setAuthor({
      name: state.authorName,
      iconURL: state.authorIconURL || botIconURL,
    });
  }

  if (state.footerText) {
    embed.setFooter({ text: state.footerText, iconURL: botIconURL });
  }

  if (state.imageURL) embed.setImage(state.imageURL);
  if (state.thumbnailURL) embed.setThumbnail(state.thumbnailURL);
  if (state.fields.length) embed.addFields(state.fields);

  embed.setTimestamp();
  return embed;
}

export function buildPanelEmbed(
  state: CfgEmbedState,
  botIconURL?: string,
): EmbedBuilder {
  const fieldCount = state.fields.length;
  const hasContent =
    state.title || state.description || state.authorName || state.footerText || fieldCount;

  const lines: string[] = [
    `> 📍 **Destino:** <#${state.targetChannelId}>`,
    `> 🎨 **Color:** \`#${state.color.toString(16).padStart(6, "0")}\``,
    `> 📦 **Campos:** ${fieldCount}/25`,
    `> 🖼️ **Imagen:** ${state.imageURL ? "Configurada" : "Ninguna"}`,
    "",
    hasContent
      ? "✅ El embed tiene contenido — presiona **Enviar** cuando esté listo."
      : "⚠️ Selecciona una sección del menú para empezar a construir.",
  ];

  return new EmbedBuilder()
    .setColor(0x0a0a0a)
    .setAuthor({
      name: "ZeroTwo · Constructor de Embeds",
      iconURL: botIconURL,
    })
    .setDescription(lines.join("\n"))
    .setFooter({
      text: "Solo tú controlas este panel · La sesión expira en 15 minutos",
      iconURL: botIconURL,
    });
}

// ── Component builders ─────────────────────────────────────────────────────────

export function buildSectionMenu(
  userId: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cfge_section:${userId}`)
      .setPlaceholder("✦  Elige una sección para editar")
      .addOptions([
        {
          label: "Título y Descripción",
          description: "Texto principal del embed",
          value: "content",
          emoji: "📝",
        },
        {
          label: "Color",
          description: "Color del borde lateral (hex)",
          value: "color",
          emoji: "🎨",
        },
        {
          label: "Autor",
          description: "Nombre e ícono del autor",
          value: "author",
          emoji: "👤",
        },
        {
          label: "Footer",
          description: "Texto del pie del embed",
          value: "footer",
          emoji: "📎",
        },
        {
          label: "Añadir Campo",
          description: "Inserta un campo inline o de bloque completo",
          value: "field",
          emoji: "➕",
        },
        {
          label: "Eliminar último campo",
          description: "Quita el campo más reciente añadido",
          value: "removefield",
          emoji: "🗑️",
        },
        {
          label: "Imagen de portada",
          description: "Imagen grande al pie del embed",
          value: "image",
          emoji: "🖼️",
        },
      ]),
  );
}

export function buildActionButtons(
  userId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`cfge_send:${userId}`)
      .setLabel("Enviar")
      .setStyle(ButtonStyle.Success)
      .setEmoji("📤"),
    new ButtonBuilder()
      .setCustomId(`cfge_reset:${userId}`)
      .setLabel("Reiniciar")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔄"),
    new ButtonBuilder()
      .setCustomId(`cfge_cancel:${userId}`)
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("✕"),
  );
}

// ── Modal builders ─────────────────────────────────────────────────────────────

export function buildContentModal(
  userId: string,
  state: CfgEmbedState,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`cfge_modal_content:${userId}`)
    .setTitle("📝 Título y Descripción")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Título")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Título del embed…")
          .setValue(state.title ?? "")
          .setRequired(false)
          .setMaxLength(256),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("description")
          .setLabel("Descripción  (markdown habilitado)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder(
            "**negrita**  *cursiva*  `código`\n> cita\n- lista\n\nhttps://...",
          )
          .setValue(state.description ?? "")
          .setRequired(false)
          .setMaxLength(4000),
      ),
    );
}

export function buildColorModal(
  userId: string,
  state: CfgEmbedState,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`cfge_modal_color:${userId}`)
    .setTitle("🎨 Color del Embed")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("color")
          .setLabel("Código hex  (ej: ec4899  o  #00f5d4)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("#ec4899")
          .setValue(`#${state.color.toString(16).padStart(6, "0")}`)
          .setRequired(true)
          .setMaxLength(7),
      ),
    );
}

export function buildAuthorModal(
  userId: string,
  state: CfgEmbedState,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`cfge_modal_author:${userId}`)
    .setTitle("👤 Autor del Embed")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("authorName")
          .setLabel("Nombre del autor")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("ZeroTwo · Sistema")
          .setValue(state.authorName ?? "")
          .setRequired(false)
          .setMaxLength(256),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("authorIcon")
          .setLabel("URL del ícono del autor  (opcional)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("https://…")
          .setValue(state.authorIconURL ?? "")
          .setRequired(false),
      ),
    );
}

export function buildFooterModal(
  userId: string,
  state: CfgEmbedState,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`cfge_modal_footer:${userId}`)
    .setTitle("📎 Footer del Embed")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("footerText")
          .setLabel("Texto del footer")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("ZeroTwo · Laboratorio de Parásitos")
          .setValue(state.footerText ?? "")
          .setRequired(false)
          .setMaxLength(2048),
      ),
    );
}

export function buildFieldModal(userId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`cfge_modal_field:${userId}`)
    .setTitle("➕ Añadir Campo")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("fieldName")
          .setLabel("Nombre del campo")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Nombre…")
          .setRequired(true)
          .setMaxLength(256),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("fieldValue")
          .setLabel("Valor  (markdown habilitado)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Valor del campo…")
          .setRequired(true)
          .setMaxLength(1024),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("inline")
          .setLabel("¿Inline? Escribe  si  o  no")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("si")
          .setValue("si")
          .setRequired(true)
          .setMaxLength(2),
      ),
    );
}

export function buildImageModal(
  userId: string,
  state: CfgEmbedState,
): ModalBuilder {
  const currentURL =
    state.imageURL && state.imageURL !== state.botBannerURL
      ? state.imageURL
      : "";

  return new ModalBuilder()
    .setCustomId(`cfge_modal_image:${userId}`)
    .setTitle("🖼️ Imagen de Portada")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("imageURL")
          .setLabel("URL de imagen  (vacío = banner del bot)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("https://…  |  deja vacío para usar el banner")
          .setValue(currentURL)
          .setRequired(false),
      ),
    );
}
