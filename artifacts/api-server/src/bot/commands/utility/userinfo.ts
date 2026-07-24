/**
 * /userinfo — ficha de usuario con secciones (perfil · servidor · permisos).
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  UserFlags,
  PermissionFlagsBits,
  type GuildMember,
  type User,
} from "discord.js";
import { Command } from "../../types.js";
import {
  isSpecialUserId,
  specialTreatmentLabel,
  isBetaTesterId,
  ownerUserIds,
} from "../../lib/specialUser.js";
import { countWarns } from "../../lib/warns.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;
const COLLECTOR_MS = 120_000;

const FLAG_CHECKS: { flag: UserFlags; label: string }[] = [
  { flag: UserFlags.Staff, label: "👷 Staff Discord" },
  { flag: UserFlags.Partner, label: "🤝 Partner" },
  { flag: UserFlags.Hypesquad, label: "🏠 HypeSquad Events" },
  { flag: UserFlags.BugHunterLevel1, label: "🐛 Bug Hunter" },
  { flag: UserFlags.BugHunterLevel2, label: "🐛 Bug Hunter Gold" },
  { flag: UserFlags.HypeSquadOnlineHouse1, label: "🛡️ Bravery" },
  { flag: UserFlags.HypeSquadOnlineHouse2, label: "⚡ Brilliance" },
  { flag: UserFlags.HypeSquadOnlineHouse3, label: "⚖️ Balance" },
  { flag: UserFlags.PremiumEarlySupporter, label: "👑 Early Supporter" },
  { flag: UserFlags.VerifiedDeveloper, label: "💻 Verified Bot Dev" },
  { flag: UserFlags.CertifiedModerator, label: "🛡️ Moderator Programs" },
  { flag: UserFlags.ActiveDeveloper, label: "⚙️ Active Developer" },
];

type Section = "profile" | "server" | "perms";

function badges(user: User): string {
  const flags = user.flags;
  const list: string[] = [];
  if (user.bot) list.push("🤖 Bot");
  if (user.system) list.push("⚙️ System");
  if (flags) {
    for (const { flag, label } of FLAG_CHECKS) {
      if (flags.has(flag)) list.push(label);
    }
  }
  return list.length ? list.join("\n") : "— Sin insignias públicas";
}

function statusEmoji(member?: GuildMember | null): string {
  const s = member?.presence?.status;
  switch (s) {
    case "online":
      return "🟢 En línea";
    case "idle":
      return "🟡 Ausente";
    case "dnd":
      return "🔴 No molestar";
    case "offline":
    case "invisible":
      return "⚫ Desconectado / invisible";
    default:
      return "⚫ Desconocido (sin Presence)";
  }
}

function activitiesLine(member?: GuildMember | null): string {
  const acts = member?.presence?.activities ?? [];
  if (!acts.length) return "— Ninguna actividad visible";
  return acts
    .slice(0, 4)
    .map((a) => {
      const type =
        a.type === 0
          ? "🎮"
          : a.type === 1
            ? "📺"
            : a.type === 2
              ? "🎵"
              : a.type === 3
                ? "👀"
                : a.type === 5
                  ? "🏆"
                  : a.type === 4
                    ? "💬"
                    : "•";
      const name = a.state && a.type === 4 ? a.state : a.name;
      return `${type} ${name}${a.details ? ` — ${a.details}` : ""}`;
    })
    .join("\n")
    .slice(0, 1020);
}

function keyPerms(member: GuildMember): string {
  const p = member.permissions;
  if (p.has(PermissionFlagsBits.Administrator)) {
    return "🔑 **Administrador** (todos los permisos)";
  }
  const checks: [string, bigint][] = [
    ["Gestionar servidor", PermissionFlagsBits.ManageGuild],
    ["Gestionar roles", PermissionFlagsBits.ManageRoles],
    ["Gestionar canales", PermissionFlagsBits.ManageChannels],
    ["Kick", PermissionFlagsBits.KickMembers],
    ["Ban", PermissionFlagsBits.BanMembers],
    ["Moderar miembros", PermissionFlagsBits.ModerateMembers],
    ["Gestionar mensajes", PermissionFlagsBits.ManageMessages],
    ["Mencionar @everyone", PermissionFlagsBits.MentionEveryone],
    ["Mover miembros", PermissionFlagsBits.MoveMembers],
  ];
  const yes = checks
    .filter(([, bit]) => p.has(bit))
    .map(([n]) => `✅ ${n}`);
  return yes.length ? yes.join("\n") : "— Sin permisos clave destacados";
}

function natureLabel(user: User, member?: GuildMember | null): string {
  if (ownerUserIds().includes(user.id)) return "👑 Owner del bot";
  if (isBetaTesterId(user.id)) return "🧪 Beta tester";
  if (isSpecialUserId(user.id)) return "🌸 Trato especial";
  if (user.bot) return "🤖 Bot / aplicación";
  if (member?.premiumSince) return "💎 Booster del servidor";
  return "👤 Miembro";
}

async function buildEmbed(
  section: Section,
  user: User,
  member: GuildMember | null | undefined,
  client: Client,
  guildId: string | null,
): Promise<EmbedBuilder> {
  // Refresh user for banner / accent when possible
  let full = user;
  try {
    full = await user.fetch(true);
  } catch {
    /* use cached */
  }

  const color =
    member?.displayColor && member.displayColor !== 0
      ? member.displayColor
      : full.accentColor && full.accentColor !== 0
        ? full.accentColor
        : PINK;

  const created = Math.floor(full.createdTimestamp / 1000);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: "Zero Two · Ficha de usuario",
      iconURL: client.user?.displayAvatarURL({ size: 64 }) ?? undefined,
    })
    .setThumbnail(full.displayAvatarURL({ size: 512 }))
    .setTimestamp()
    .setFooter({
      text: `Zero Two ${BOT_VERSION} · ID ${full.id}`,
      iconURL: client.user?.displayAvatarURL({ size: 32 }) ?? undefined,
    });

  const banner = full.bannerURL({ size: 1024 });
  if (banner && section === "profile") embed.setImage(banner);

  if (section === "profile") {
    embed
      .setTitle(`${full.bot ? "🤖" : "👤"} ${full.displayName}`)
      .setDescription(
        [
          `**@${full.username}**${full.discriminator !== "0" ? `#${full.discriminator}` : ""}`,
          `**Tag global:** ${full.globalName ?? "—"}`,
          `**Naturaleza:** ${natureLabel(full, member)}`,
        ].join("\n"),
      )
      .addFields(
        {
          name: "🆔 Identificador",
          value: `\`${full.id}\``,
          inline: true,
        },
        {
          name: "📅 Cuenta creada",
          value: `<t:${created}:D>\n(<t:${created}:R>)`,
          inline: true,
        },
        {
          name: "🎨 Color de acento",
          value: full.hexAccentColor ?? "`por defecto`",
          inline: true,
        },
        {
          name: "🏅 Insignias",
          value: badges(full),
          inline: false,
        },
        {
          name: "🔗 Avatar",
          value: `[Abrir](${full.displayAvatarURL({ size: 1024 })})`,
          inline: true,
        },
        {
          name: "🖼️ Banner",
          value: banner ? `[Abrir](${banner})` : "`sin banner`",
          inline: true,
        },
      );

    if (member && isSpecialUserId(full.id)) {
      embed.addFields({
        name: "🌸 Trato especial en el nexo",
        value: `${specialTreatmentLabel(full.id)}\nSin cooldowns · acceso en mantenimiento.`,
        inline: false,
      });
    }
  }

  if (section === "server") {
    if (!member || !guildId) {
      embed
        .setTitle("🏠 Datos del servidor")
        .setDescription(
          "Este usuario no está en el servidor actual (o el comando se usó fuera de un guild).",
        );
      return embed;
    }

    const joined = member.joinedTimestamp
      ? Math.floor(member.joinedTimestamp / 1000)
      : null;
    const boost = member.premiumSince
      ? Math.floor(member.premiumSinceTimestamp! / 1000)
      : null;
    const timeout = member.communicationDisabledUntilTimestamp
      ? Math.floor(member.communicationDisabledUntilTimestamp / 1000)
      : null;

    const roles = member.roles.cache
      .filter((r) => r.id !== guildId)
      .sort((a, b) => b.position - a.position);
    const roleMentions = roles.map((r) => `<@&${r.id}>`).slice(0, 20);
    const roleValue =
      roleMentions.length > 0
        ? `${roleMentions.join(" ")}${roles.size > 20 ? `\n… +${roles.size - 20} más` : ""}`
        : "`Sin roles`";

    let warns = 0;
    try {
      warns = await countWarns(guildId, full.id);
    } catch {
      /* DB optional */
    }

    embed
      .setTitle(`🏠 En este servidor · ${member.displayName}`)
      .addFields(
        {
          name: "🏷️ Apodo",
          value: member.nickname ? `\`${member.nickname}\`` : "`ninguno`",
          inline: true,
        },
        {
          name: "📥 Se unió",
          value: joined
            ? `<t:${joined}:D>\n(<t:${joined}:R>)`
            : "`desconocido`",
          inline: true,
        },
        {
          name: "📡 Estado",
          value: statusEmoji(member),
          inline: true,
        },
        {
          name: "💎 Boost",
          value: boost
            ? `Desde <t:${boost}:R>`
            : "`no está impulsando`",
          inline: true,
        },
        {
          name: "⏳ Timeout",
          value:
            timeout && timeout * 1000 > Date.now()
              ? `Hasta <t:${timeout}:R>`
              : "`no`",
          inline: true,
        },
        {
          name: "⚠️ Warns",
          value: `\`${warns}\``,
          inline: true,
        },
        {
          name: `🛡️ Roles (${roles.size})`,
          value: roleValue.slice(0, 1024),
          inline: false,
        },
        {
          name: "🎯 Actividad",
          value: activitiesLine(member),
          inline: false,
        },
      );

    if (member.avatar) {
      embed.addFields({
        name: "🖼️ Avatar del servidor",
        value: `[Abrir](${member.displayAvatarURL({ size: 512 })})`,
        inline: true,
      });
    }
  }

  if (section === "perms") {
    if (!member) {
      embed
        .setTitle("🔑 Permisos")
        .setDescription("Solo disponible para miembros del servidor actual.");
      return embed;
    }

    const highest = member.roles.highest;
    embed
      .setTitle("🔑 Permisos clave")
      .addFields(
        {
          name: "📌 Rol más alto",
          value: highest.id === guildId ? "`@everyone`" : `<@&${highest.id}>`,
          inline: true,
        },
        {
          name: "🎨 Color de rol",
          value: highest.hexColor !== "#000000" ? highest.hexColor : "`default`",
          inline: true,
        },
        {
          name: "📋 Posición",
          value: `\`${highest.position}\``,
          inline: true,
        },
        {
          name: "⚡ Permisos destacados",
          value: keyPerms(member),
          inline: false,
        },
        {
          name: "🧩 Bitfield",
          value: `\`${member.permissions.bitfield.toString()}\``,
          inline: false,
        },
      );
  }

  return embed;
}

function menu(userId: string, selected: Section) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`uinfo_section:${userId}`)
      .setPlaceholder("✦  Elige una sección del perfil…")
      .addOptions([
        {
          label: "Perfil Discord",
          description: "Cuenta, insignias, avatar y banner",
          value: "profile",
          emoji: "👤",
          default: selected === "profile",
        },
        {
          label: "En este servidor",
          description: "Apodo, roles, join, warns y actividad",
          value: "server",
          emoji: "🏠",
          default: selected === "server",
        },
        {
          label: "Permisos",
          description: "Rol alto y permisos clave",
          value: "perms",
          emoji: "🔑",
          default: selected === "perms",
        },
      ]),
  );
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription(
      "👤 Ficha completa de un usuario — perfil, servidor y permisos",
    )
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Usuario a inspeccionar (por defecto: tú)")
        .setRequired(false),
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const user = interaction.options.getUser("usuario") ?? interaction.user;
    let member = interaction.guild?.members.cache.get(user.id) ?? null;
    if (interaction.guild && !member) {
      member = await interaction.guild.members.fetch(user.id).catch(() => null);
    }

    const guildId = interaction.guild?.id ?? null;
    const embed = await buildEmbed("profile", user, member, client, guildId);

    const msg = await interaction.reply({
      embeds: [embed],
      components: [menu(interaction.user.id, "profile")],
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
      const section = (sel.values[0] ?? "profile") as Section;
      const next = await buildEmbed(section, user, member, client, guildId);
      await sel.update({
        embeds: [next],
        components: [menu(interaction.user.id, section)],
      });
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
