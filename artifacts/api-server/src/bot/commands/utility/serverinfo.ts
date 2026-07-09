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
} from "discord.js";
import { Command } from "../../types.js";

const VERIFICATION: Record<number, string> = {
  [GuildVerificationLevel.None]: "🟢 Ninguno (Libre)",
  [GuildVerificationLevel.Low]: "🟡 Bajo (Email verificado)",
  [GuildVerificationLevel.Medium]: "🟠 Medio (Registro +5 min)",
  [GuildVerificationLevel.High]: "🔴 Alto (10 min en el servidor)",
  [GuildVerificationLevel.VeryHigh]: "🔴 Muy alto (Teléfono verificado)",
};

const CONTENT_FILTER: Record<number, string> = {
  [GuildExplicitContentFilter.Disabled]: "❌ Desactivado",
  [GuildExplicitContentFilter.MembersWithoutRoles]: "⚠️ Sin roles",
  [GuildExplicitContentFilter.AllMembers]: "✅ Todos los miembros",
};

const MFA: Record<number, string> = {
  [GuildMFALevel.None]: "❌ No requerida",
  [GuildMFALevel.Elevated]: "✅ Obligatoria para mods",
};

const BOOST_TIER: Record<number, string> = {
  [GuildPremiumTier.None]: "Sin tier",
  [GuildPremiumTier.Tier1]: "Tier 1",
  [GuildPremiumTier.Tier2]: "Tier 2",
  [GuildPremiumTier.Tier3]: "Tier 3",
};

const BOOST_PERKS: Record<number, string> = {
  [GuildPremiumTier.None]: "Sin beneficios activos",
  [GuildPremiumTier.Tier1]: "Audio 128kbps · Emoji +50 · Stickers +15",
  [GuildPremiumTier.Tier2]: "Audio 256kbps · Emoji +100 · Banner · Stickers +30",
  [GuildPremiumTier.Tier3]: "Audio 384kbps · Emoji +200 · Stickers +60 · Vanity URL",
};

function buildEmbed(
  section: string,
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  client: Client,
): EmbedBuilder {
  const base = new EmbedBuilder()
    .setColor(0xff2d6b)
    .setAuthor({
      name: `Análisis de Entorno // ${guild.name}`,
      iconURL: client.user?.displayAvatarURL(),
    })
    .setThumbnail(guild.iconURL({ size: 512 }) ?? null)
    .setTimestamp()
    .setFooter({
      text: `ID: ${guild.id}`,
      iconURL: client.user?.displayAvatarURL(),
    });

  const created = Math.floor(guild.createdTimestamp / 1000);

  if (section === "general") {
    base.setTitle("🌐 Información General");
    base.addFields(
      { name: "🏷️ Nombre", value: guild.name, inline: true },
      { name: "🆔 ID", value: `\`${guild.id}\``, inline: true },
      {
        name: "👑 Comandante",
        value: `<@${guild.ownerId}>`,
        inline: true,
      },
      {
        name: "📅 Fundación",
        value: `<t:${created}:D>\n<t:${created}:R>`,
        inline: true,
      },
      {
        name: "🌍 Idioma",
        value: `\`${guild.preferredLocale}\``,
        inline: true,
      },
      {
        name: "💬 Descripción",
        value: guild.description ?? "*Sin descripción*",
        inline: false,
      },
    );
    if (guild.bannerURL()) base.setImage(guild.bannerURL({ size: 1024 }) ?? null);
  }

  if (section === "members") {
    const total = guild.memberCount;
    const cached = guild.members.cache;
    const bots = cached.filter((m) => m.user.bot).size;
    const humans = cached.filter((m) => !m.user.bot).size;
    const online = cached.filter(
      (m) =>
        m.presence?.status === "online" ||
        m.presence?.status === "idle" ||
        m.presence?.status === "dnd",
    ).size;

    base.setTitle("👥 Estadísticas de Miembros");
    base.addFields(
      { name: "📊 Total", value: `\`${total.toLocaleString()}\``, inline: true },
      {
        name: "🟢 En línea (caché)",
        value: `\`${online.toLocaleString()}\``,
        inline: true,
      },
      { name: "\u200b", value: "\u200b", inline: true },
      {
        name: "🧑 Humanos (caché)",
        value: `\`${humans.toLocaleString()}\``,
        inline: true,
      },
      {
        name: "🤖 Bots (caché)",
        value: `\`${bots.toLocaleString()}\``,
        inline: true,
      },
      { name: "\u200b", value: "\u200b", inline: true },
    );

    if (guild.maximumMembers) {
      base.addFields({
        name: "🔢 Capacidad máxima",
        value: `\`${guild.maximumMembers.toLocaleString()}\``,
        inline: true,
      });
    }
  }

  if (section === "channels") {
    const channels = guild.channels.cache;
    const text = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voice = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
    const category = channels.filter((c) => c.type === ChannelType.GuildCategory).size;
    const announce = channels.filter(
      (c) => c.type === ChannelType.GuildAnnouncement,
    ).size;
    const stage = channels.filter(
      (c) => c.type === ChannelType.GuildStageVoice,
    ).size;
    const forum = channels.filter((c) => c.type === ChannelType.GuildForum).size;
    const thread = channels.filter(
      (c) =>
        c.type === ChannelType.PublicThread ||
        c.type === ChannelType.PrivateThread ||
        c.type === ChannelType.AnnouncementThread,
    ).size;

    base.setTitle("💬 Mapa de Canales");
    base.addFields(
      { name: "📋 Total de canales", value: `\`${channels.size}\``, inline: true },
      { name: "💬 Texto", value: `\`${text}\``, inline: true },
      { name: "🔊 Voz", value: `\`${voice}\``, inline: true },
      { name: "📁 Categorías", value: `\`${category}\``, inline: true },
      { name: "📢 Anuncios", value: `\`${announce}\``, inline: true },
      { name: "🎤 Escenario", value: `\`${stage}\``, inline: true },
      { name: "💬 Foros", value: `\`${forum}\``, inline: true },
      { name: "🧵 Hilos activos", value: `\`${thread}\``, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
    );
  }

  if (section === "roles") {
    const roles = guild.roles.cache
      .filter((r) => r.id !== guild.id)
      .sort((a, b) => b.position - a.position);

    const topRoles = roles.first(15);
    const roleList =
      topRoles.map((r) => `<@&${r.id}>`).join(" ") || "*Sin roles*";

    base.setTitle("🔮 Protocolos y Rangos");
    base.addFields(
      {
        name: "📊 Total de roles",
        value: `\`${roles.size}\``,
        inline: true,
      },
      {
        name: "🏅 Rol más alto",
        value: roles.first()
          ? `<@&${roles.first()!.id}>`
          : "*Ninguno*",
        inline: true,
      },
      { name: "\u200b", value: "\u200b", inline: true },
      {
        name: `🔮 Roles (top ${Math.min(roles.size, 15)})`,
        value: roleList,
        inline: false,
      },
    );
  }

  if (section === "security") {
    const features = guild.features;
    const featList =
      features.length > 0
        ? features.map((f) => `\`${f}\``).join(", ")
        : "*Ninguna*";

    base.setTitle("🛡️ Seguridad & Nitro Boost");
    base.addFields(
      {
        name: "🔒 Verificación",
        value: VERIFICATION[guild.verificationLevel] ?? "Desconocido",
        inline: false,
      },
      {
        name: "🔞 Filtro de contenido",
        value: CONTENT_FILTER[guild.explicitContentFilter] ?? "Desconocido",
        inline: true,
      },
      {
        name: "🔐 2FA Moderadores",
        value: MFA[guild.mfaLevel] ?? "Desconocido",
        inline: true,
      },
      { name: "\u200b", value: "\u200b", inline: true },
      {
        name: "⚡ Nivel de Boost",
        value: `**${BOOST_TIER[guild.premiumTier] ?? "N/A"}** (${guild.premiumSubscriptionCount ?? 0} boosts)`,
        inline: true,
      },
      {
        name: "🎁 Beneficios activos",
        value: BOOST_PERKS[guild.premiumTier] ?? "*Sin beneficios*",
        inline: false,
      },
      {
        name: "✨ Características",
        value: featList,
        inline: false,
      },
    );
  }

  return base;
}

const MENU = (userId: string) =>
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`sinfo_section:${userId}`)
      .setPlaceholder("✦  Selecciona una sección")
      .addOptions([
        {
          label: "General",
          description: "Nombre, ID, dueño y fecha de creación",
          value: "general",
          emoji: "🌐",
        },
        {
          label: "Miembros",
          description: "Total, humanos, bots y estado en línea",
          value: "members",
          emoji: "👥",
        },
        {
          label: "Canales",
          description: "Texto, voz, categorías, foros y más",
          value: "channels",
          emoji: "💬",
        },
        {
          label: "Roles",
          description: "Cantidad y listado de rangos del servidor",
          value: "roles",
          emoji: "🔮",
        },
        {
          label: "Seguridad & Boost",
          description: "Verificación, filtros, 2FA y nivel de Nitro",
          value: "security",
          emoji: "🛡",
        },
      ]),
  );

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("🏠 Muestra el reporte analítico completo del servidor"),
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guild = interaction.guild!;
    await guild.fetch();

    const msg = await interaction.reply({
      embeds: [buildEmbed("general", guild, client)],
      components: [MENU(interaction.user.id)],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 180_000,
    });

    collector.on("collect", async (sel) => {
      if (sel.user.id !== interaction.user.id) {
        await sel.reply({
          content: "❌ Este panel es solo para quien ejecutó el comando.",
          ephemeral: true,
        });
        return;
      }

      const section = sel.values[0] ?? "general";
      await sel.update({
        embeds: [buildEmbed(section, guild, client)],
        components: [MENU(interaction.user.id)],
      });
    });

    collector.on("end", () => {
      interaction
        .editReply({ components: [] })
        .catch(() => null);
    });
  },
};

export default command;
