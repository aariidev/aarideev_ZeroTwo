/**
 * /serverinfo — reporte del servidor con secciones interactivas.
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ChannelType,
  GuildVerificationLevel,
  GuildExplicitContentFilter,
  GuildMFALevel,
  GuildPremiumTier,
  GuildNSFWLevel,
} from "discord.js";
import { Command } from "../../types.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;
const COLLECTOR_MS = 180_000;

const VERIFICATION: Record<number, string> = {
  [GuildVerificationLevel.None]: "🟢 Ninguno",
  [GuildVerificationLevel.Low]: "🟡 Bajo · email verificado",
  [GuildVerificationLevel.Medium]: "🟠 Medio · +5 min en Discord",
  [GuildVerificationLevel.High]: "🔴 Alto · +10 min en el server",
  [GuildVerificationLevel.VeryHigh]: "🔴 Muy alto · teléfono",
};

const CONTENT_FILTER: Record<number, string> = {
  [GuildExplicitContentFilter.Disabled]: "❌ Desactivado",
  [GuildExplicitContentFilter.MembersWithoutRoles]: "⚠️ Solo sin roles",
  [GuildExplicitContentFilter.AllMembers]: "✅ Todos los miembros",
};

const MFA: Record<number, string> = {
  [GuildMFALevel.None]: "❌ No requerida",
  [GuildMFALevel.Elevated]: "✅ Obligatoria para mods",
};

const NSFW: Record<number, string> = {
  [GuildNSFWLevel.Default]: "Por defecto",
  [GuildNSFWLevel.Explicit]: "Explícito",
  [GuildNSFWLevel.Safe]: "Safe",
  [GuildNSFWLevel.AgeRestricted]: "Restringido por edad",
};

const BOOST_TIER: Record<number, string> = {
  [GuildPremiumTier.None]: "Sin nivel",
  [GuildPremiumTier.Tier1]: "Nivel 1",
  [GuildPremiumTier.Tier2]: "Nivel 2",
  [GuildPremiumTier.Tier3]: "Nivel 3",
};

const BOOST_NEXT: Record<number, number | null> = {
  [GuildPremiumTier.None]: 2,
  [GuildPremiumTier.Tier1]: 7,
  [GuildPremiumTier.Tier2]: 14,
  [GuildPremiumTier.Tier3]: null,
};

const BOOST_PERKS: Record<number, string> = {
  [GuildPremiumTier.None]: "Sin beneficios de boost activos",
  [GuildPremiumTier.Tier1]: "Audio 128 kbps · +50 emoji · +15 stickers",
  [GuildPremiumTier.Tier2]:
    "Audio 256 kbps · +100 emoji · banner · +30 stickers",
  [GuildPremiumTier.Tier3]:
    "Audio 384 kbps · +250 emoji · vanity URL · +60 stickers",
};

/** Features más legibles (subset útil) */
const FEATURE_LABELS: Record<string, string> = {
  COMMUNITY: "Comunidad",
  VERIFIED: "Verificado",
  PARTNERED: "Partner",
  DISCOVERABLE: "Discoverable",
  INVITE_SPLASH: "Splash de invitación",
  BANNER: "Banner",
  VANITY_URL: "URL personalizada",
  ANIMATED_ICON: "Icono animado",
  ANIMATED_BANNER: "Banner animado",
  ROLE_ICONS: "Iconos de rol",
  WELCOME_SCREEN_ENABLED: "Pantalla de bienvenida",
  MEMBER_VERIFICATION_GATE_ENABLED: "Gate de membresía",
  PREVIEW_ENABLED: "Vista previa",
  NEWS: "Canales de anuncios",
  AUTO_MODERATION: "AutoMod nativo",
  RAID_ALERTS_DISABLED: "Alertas de raid off",
  SOUNDBOARD: "Soundboard",
  INVITES_DISABLED: "Invitaciones desactivadas",
};

function progressBar(current: number, max: number, len = 10): string {
  if (max <= 0) return "█".repeat(len);
  const pct = Math.min(1, current / max);
  const filled = Math.round(pct * len);
  return "█".repeat(filled) + "░".repeat(Math.max(0, len - filled));
}

function featureList(features: readonly string[]): string {
  if (!features.length) return "*Ninguna destacada*";
  const mapped = features.map((f) => {
    const label = FEATURE_LABELS[f] ?? f.replace(/_/g, " ").toLowerCase();
    return `\`${label}\``;
  });
  const text = mapped.join(" · ");
  return text.length > 1000 ? `${text.slice(0, 997)}…` : text;
}

type Section =
  | "general"
  | "members"
  | "channels"
  | "roles"
  | "security"
  | "assets";

function buildEmbed(
  section: Section,
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  client: Client,
): EmbedBuilder {
  const base = new EmbedBuilder()
    .setColor(PINK)
    .setAuthor({
      name: `Zero Two · ${guild.name}`,
      iconURL: client.user?.displayAvatarURL({ size: 64 }) ?? undefined,
    })
    .setThumbnail(guild.iconURL({ size: 512 }) ?? null)
    .setTimestamp()
    .setFooter({
      text: `Zero Two ${BOT_VERSION} · ID ${guild.id}`,
      iconURL: client.user?.displayAvatarURL({ size: 32 }) ?? undefined,
    });

  const created = Math.floor(guild.createdTimestamp / 1000);

  if (section === "general") {
    const vanity = guild.vanityURLCode
      ? `discord.gg/${guild.vanityURLCode}`
      : null;
    base
      .setTitle("🌐 Información general")
      .setDescription(
        guild.description
          ? guild.description.slice(0, 300)
          : "*Sin descripción de comunidad*",
      )
      .addFields(
        { name: "🏷️ Nombre", value: guild.name, inline: true },
        { name: "🆔 ID", value: `\`${guild.id}\``, inline: true },
        {
          name: "👑 Dueño",
          value: `<@${guild.ownerId}>`,
          inline: true,
        },
        {
          name: "📅 Creado",
          value: `<t:${created}:D>\n(<t:${created}:R>)`,
          inline: true,
        },
        {
          name: "🌍 Idioma",
          value: `\`${guild.preferredLocale}\``,
          inline: true,
        },
        {
          name: "🔗 Vanity",
          value: vanity ? `[\`${vanity}\`](https://${vanity})` : "`—`",
          inline: true,
        },
        {
          name: "📢 Sistema",
          value: guild.systemChannel
            ? `${guild.systemChannel}`
            : "`sin canal de sistema`",
          inline: true,
        },
        {
          name: "📜 Reglas",
          value: guild.rulesChannel
            ? `${guild.rulesChannel}`
            : "`sin canal de reglas`",
          inline: true,
        },
        {
          name: "💤 AFK",
          value: guild.afkChannel
            ? `${guild.afkChannel} (${guild.afkTimeout}s)`
            : "`sin AFK`",
          inline: true,
        },
      );
    if (guild.bannerURL()) {
      base.setImage(guild.bannerURL({ size: 1024 }) ?? null);
    }
  }

  if (section === "members") {
    const total = guild.memberCount;
    const cached = guild.members.cache;
    const bots = cached.filter((m) => m.user.bot).size;
    const humans = Math.max(0, total - bots);
    // Presence requires GuildPresences intent — best-effort from cache
    const online = cached.filter((m) => {
      const s = m.presence?.status;
      return s === "online" || s === "idle" || s === "dnd";
    }).size;
    const boosters = cached.filter((m) => Boolean(m.premiumSince)).size;

    base.setTitle("👥 Miembros").addFields(
      {
        name: "📊 Total",
        value: `\`${total.toLocaleString("es-ES")}\``,
        inline: true,
      },
      {
        name: "🧑 Humanos (aprox.)",
        value: `\`${humans.toLocaleString("es-ES")}\``,
        inline: true,
      },
      {
        name: "🤖 Bots (caché)",
        value: `\`${bots.toLocaleString("es-ES")}\``,
        inline: true,
      },
      {
        name: "🟢 En línea (caché)",
        value: `\`${online.toLocaleString("es-ES")}\``,
        inline: true,
      },
      {
        name: "💎 Boosters (caché)",
        value: `\`${boosters}\``,
        inline: true,
      },
      {
        name: "📦 En caché del bot",
        value: `\`${cached.size.toLocaleString("es-ES")}\``,
        inline: true,
      },
    );

    if (guild.maximumMembers) {
      const max = guild.maximumMembers;
      base.addFields({
        name: "🔢 Capacidad",
        value: `\`${total.toLocaleString("es-ES")}\` / \`${max.toLocaleString("es-ES")}\`\n\`${progressBar(total, max)}\``,
        inline: false,
      });
    }
  }

  if (section === "channels") {
    const channels = guild.channels.cache;
    const count = (t: ChannelType | ChannelType[]) =>
      channels.filter((c) =>
        Array.isArray(t) ? t.includes(c.type) : c.type === t,
      ).size;

    base.setTitle("💬 Canales").addFields(
      {
        name: "📋 Total",
        value: `\`${channels.size}\``,
        inline: true,
      },
      {
        name: "💬 Texto",
        value: `\`${count(ChannelType.GuildText)}\``,
        inline: true,
      },
      {
        name: "🔊 Voz",
        value: `\`${count(ChannelType.GuildVoice)}\``,
        inline: true,
      },
      {
        name: "📁 Categorías",
        value: `\`${count(ChannelType.GuildCategory)}\``,
        inline: true,
      },
      {
        name: "📢 Anuncios",
        value: `\`${count(ChannelType.GuildAnnouncement)}\``,
        inline: true,
      },
      {
        name: "🎤 Escenario",
        value: `\`${count(ChannelType.GuildStageVoice)}\``,
        inline: true,
      },
      {
        name: "💭 Foros",
        value: `\`${count(ChannelType.GuildForum)}\``,
        inline: true,
      },
      {
        name: "🧵 Hilos",
        value: `\`${count([
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread,
        ])}\``,
        inline: true,
      },
      {
        name: "🎬 Media / otros",
        value: `\`${count([ChannelType.GuildMedia, ChannelType.GuildDirectory])}\``,
        inline: true,
      },
    );
  }

  if (section === "roles") {
    const roles = guild.roles.cache
      .filter((r) => r.id !== guild.id)
      .sort((a, b) => b.position - a.position);

    const managed = roles.filter((r) => r.managed).size;
    const hoisted = roles.filter((r) => r.hoist).size;
    const topRoles = roles.first(18);
    const roleList =
      topRoles.map((r) => `<@&${r.id}>`).join(" ") || "*Sin roles*";

    base.setTitle("🔮 Roles").addFields(
      {
        name: "📊 Total",
        value: `\`${roles.size}\``,
        inline: true,
      },
      {
        name: "🤖 Gestionados (bots)",
        value: `\`${managed}\``,
        inline: true,
      },
      {
        name: "📌 Separados (hoist)",
        value: `\`${hoisted}\``,
        inline: true,
      },
      {
        name: "🏅 Más alto",
        value: roles.first() ? `<@&${roles.first()!.id}>` : "*Ninguno*",
        inline: true,
      },
      {
        name: `🔮 Top ${Math.min(roles.size, 18)}`,
        value: roleList.slice(0, 1024),
        inline: false,
      },
    );
  }

  if (section === "security") {
    const boosts = guild.premiumSubscriptionCount ?? 0;
    const tier = guild.premiumTier;
    const next = BOOST_NEXT[tier];
    const boostLine =
      next != null
        ? `\`${progressBar(boosts, next)}\` **${boosts}** / ${next} para el siguiente nivel`
        : `\`${progressBar(1, 1)}\` **${boosts}** boosts · nivel máximo`;

    base.setTitle("🛡️ Seguridad & Boost").addFields(
      {
        name: "🔒 Verificación",
        value: VERIFICATION[guild.verificationLevel] ?? "?",
        inline: true,
      },
      {
        name: "🔞 Filtro de medios",
        value: CONTENT_FILTER[guild.explicitContentFilter] ?? "?",
        inline: true,
      },
      {
        name: "🔐 2FA mods",
        value: MFA[guild.mfaLevel] ?? "?",
        inline: true,
      },
      {
        name: "🚫 Nivel NSFW",
        value: NSFW[guild.nsfwLevel] ?? "?",
        inline: true,
      },
      {
        name: "⚡ Nivel de Boost",
        value: `**${BOOST_TIER[tier] ?? "N/A"}**`,
        inline: true,
      },
      {
        name: "💎 Boosts",
        value: `\`${boosts}\``,
        inline: true,
      },
      {
        name: "📈 Progreso de boost",
        value: boostLine,
        inline: false,
      },
      {
        name: "🎁 Beneficios",
        value: BOOST_PERKS[tier] ?? "—",
        inline: false,
      },
      {
        name: "✨ Características",
        value: featureList(guild.features),
        inline: false,
      },
    );
  }

  if (section === "assets") {
    const emojis = guild.emojis.cache;
    const animated = emojis.filter((e) => e.animated).size;
    const staticE = emojis.size - animated;
    const stickers = guild.stickers.cache.size;

    base.setTitle("🎨 Assets del servidor").addFields(
      {
        name: "😀 Emojis",
        value: `\`${emojis.size}\` total · \`${staticE}\` estáticos · \`${animated}\` animados`,
        inline: false,
      },
      {
        name: "🏷️ Stickers",
        value: `\`${stickers}\``,
        inline: true,
      },
      {
        name: "🖼️ Icono",
        value: guild.iconURL()
          ? `[Abrir](${guild.iconURL({ size: 1024 })})`
          : "`sin icono`",
        inline: true,
      },
      {
        name: "🎌 Banner",
        value: guild.bannerURL()
          ? `[Abrir](${guild.bannerURL({ size: 1024 })})`
          : "`sin banner`",
        inline: true,
      },
      {
        name: "✨ Splash invitación",
        value: guild.splashURL()
          ? `[Abrir](${guild.splashURL({ size: 1024 })})`
          : "`—`",
        inline: true,
      },
      {
        name: "🔍 Discovery splash",
        value: guild.discoverySplashURL()
          ? `[Abrir](${guild.discoverySplashURL({ size: 1024 })})`
          : "`—`",
        inline: true,
      },
    );

    // Sample of custom emojis
    const sample = emojis
      .first(12)
      .map((e) => e.toString())
      .join(" ");
    if (sample) {
      base.addFields({
        name: "Muestra de emojis",
        value: sample,
        inline: false,
      });
    }
  }

  return base;
}

function menu(userId: string, selected: Section) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`sinfo_section:${userId}`)
      .setPlaceholder("✦  Selecciona una sección")
      .addOptions([
        {
          label: "General",
          description: "Nombre, dueño, vanity, canales de sistema",
          value: "general",
          emoji: "🌐",
          default: selected === "general",
        },
        {
          label: "Miembros",
          description: "Total, bots, online y capacidad",
          value: "members",
          emoji: "👥",
          default: selected === "members",
        },
        {
          label: "Canales",
          description: "Texto, voz, foros, hilos…",
          value: "channels",
          emoji: "💬",
          default: selected === "channels",
        },
        {
          label: "Roles",
          description: "Cantidad y top de rangos",
          value: "roles",
          emoji: "🔮",
          default: selected === "roles",
        },
        {
          label: "Seguridad & Boost",
          description: "Verificación, 2FA, Nitro y features",
          value: "security",
          emoji: "🛡️",
          default: selected === "security",
        },
        {
          label: "Assets",
          description: "Emojis, stickers, icono y banner",
          value: "assets",
          emoji: "🎨",
          default: selected === "assets",
        },
      ]),
  );
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription(
      "🏠 Reporte del servidor — miembros, canales, seguridad y assets",
    ),
  cooldown: 8,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "❌ Este comando solo funciona en un servidor.",
        ephemeral: true,
      });
      return;
    }

    await guild.fetch().catch(() => null);
    // Stickers may need fetch
    await guild.stickers.fetch().catch(() => null);
    await guild.emojis.fetch().catch(() => null);

    const msg = await interaction.reply({
      embeds: [buildEmbed("general", guild, client)],
      components: [menu(interaction.user.id, "general")],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (sel) => {
      if (sel.user.id !== interaction.user.id) {
        await sel.reply({
          content: "❌ Este panel es solo para quien ejecutó el comando.",
          ephemeral: true,
        });
        return;
      }
      const section = (sel.values[0] ?? "general") as Section;
      await sel.update({
        embeds: [buildEmbed(section, guild, client)],
        components: [menu(interaction.user.id, section)],
      });
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
