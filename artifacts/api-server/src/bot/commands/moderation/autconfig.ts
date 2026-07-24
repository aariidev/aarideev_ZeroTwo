/**
 * /autconfig — one-shot server setup:
 * color roles, utility roles, AutoMod pack, antiraid, logs & levels.
 * Al final pregunta si crear panel de colores con reacciones.
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  type Guild,
  type Role,
  type TextChannel,
  type Message,
} from "discord.js";
import { Command } from "../../types.js";
import { installAutomodPack } from "../../lib/automod.js";
import {
  updateAntiraidSettings,
  type AntiraidAction,
} from "../../lib/antiraid.js";
import {
  LOG_EVENT_KEYS,
  defaultLogEvents,
  setLogChannelId,
  setLogEvents,
} from "../../lib/modlog.js";
import { updateLevelSettings } from "../../lib/levels.js";
import { createColorReactionPanel } from "../../lib/colorRolesPanel.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;
const GREEN = 0x22c55e;
const AMBER = 0xf59e0b;
const CYAN = 0x22d3ee;

/** Marker in role reason / name prefix for idempotent re-runs */
const COLOR_REASON = "Zero Two /autconfig · roles de color";
const UTIL_REASON = "Zero Two /autconfig · roles de utilidad";

/**
 * Paleta amplia de roles de color.
 * `aliases`: nombres alternativos (sin emoji) para detectar roles ya creados
 * a mano o por otra versión del bot.
 */
export const COLOR_ROLES: {
  name: string;
  color: number;
  aliases?: string[];
}[] = [
  // Rojos / rosas
  { name: "🔴 Rojo", color: 0xed4245, aliases: ["rojo", "red", "rojo intenso"] },
  { name: "🟥 Rojo oscuro", color: 0x992d22, aliases: ["rojo oscuro", "granate", "burgundy"] },
  { name: "🩷 Rosa", color: 0xeb459e, aliases: ["rosa", "pink", "rosado"] },
  { name: "💗 Rosa claro", color: 0xf4a6c9, aliases: ["rosa claro", "light pink", "rosita"] },
  { name: "🌸 Sakura", color: 0xffb7c5, aliases: ["sakura", "cerezo", "pink sakura"] },
  { name: "💘 Magenta", color: 0xe91e8c, aliases: ["magenta", "fucsia", "fuchsia"] },
  // Naranjas / amarillos
  { name: "🟠 Naranja", color: 0xe67e22, aliases: ["naranja", "orange"] },
  { name: "🟧 Coral", color: 0xff7f50, aliases: ["coral"] },
  { name: "🍑 Melocotón", color: 0xffab91, aliases: ["melocoton", "melocotón", "peach"] },
  { name: "🟡 Amarillo", color: 0xfee75c, aliases: ["amarillo", "yellow"] },
  { name: "🟨 Dorado", color: 0xf1c40f, aliases: ["dorado", "gold", "oro"] },
  { name: "🍯 Ámbar", color: 0xf59e0b, aliases: ["ambar", "ámbar", "amber"] },
  // Verdes
  { name: "🟢 Verde", color: 0x57f287, aliases: ["verde", "green"] },
  { name: "🟩 Lima", color: 0xa3e635, aliases: ["lima", "lime", "verde lima"] },
  { name: "🌲 Verde bosque", color: 0x1f8b4c, aliases: ["verde bosque", "forest", "bosque"] },
  { name: "🫒 Oliva", color: 0x808000, aliases: ["oliva", "olive"] },
  { name: "🌿 Menta", color: 0x2dd4bf, aliases: ["menta", "mint", "verde menta"] },
  // Cianes / azules
  { name: "🩵 Cian", color: 0x1abc9c, aliases: ["cian", "cyan"] },
  { name: "💠 Turquesa", color: 0x00ced1, aliases: ["turquesa", "turquoise"] },
  { name: "🔵 Azul", color: 0x3498db, aliases: ["azul", "blue"] },
  { name: "💙 Azul cielo", color: 0x38bdf8, aliases: ["azul cielo", "sky", "sky blue", "celeste"] },
  { name: "🔹 Azul oscuro", color: 0x206694, aliases: ["azul oscuro", "dark blue", "navy"] },
  { name: "🧊 Hielo", color: 0xa5f3fc, aliases: ["hielo", "ice", "azul hielo"] },
  { name: "🌊 Océano", color: 0x0ea5e9, aliases: ["oceano", "océano", "ocean"] },
  // Morados
  { name: "🟣 Morado", color: 0x9b59b6, aliases: ["morado", "purple", "púrpura", "purpura"] },
  { name: "💜 Lila", color: 0xc27cff, aliases: ["lila", "lilac"] },
  { name: "🔮 Violeta", color: 0x8b5cf6, aliases: ["violeta", "violet"] },
  { name: "🍇 Uva", color: 0x6d28d9, aliases: ["uva", "grape"] },
  { name: "💟 Lavanda", color: 0xb794f4, aliases: ["lavanda", "lavender"] },
  // Neutros / tierra
  { name: "🤎 Marrón", color: 0xa0522d, aliases: ["marron", "marrón", "brown", "cafe", "café"] },
  { name: "🍫 Chocolate", color: 0x7b3f00, aliases: ["chocolate"] },
  { name: "🏜️ Beige", color: 0xd4a574, aliases: ["beige", "arena", "sand"] },
  { name: "⚫ Negro", color: 0x23272a, aliases: ["negro", "black"] },
  { name: "⬛ Gris oscuro", color: 0x4b5563, aliases: ["gris oscuro", "dark gray", "dark grey"] },
  { name: "⚪ Gris", color: 0x95a5a6, aliases: ["gris", "gray", "grey"] },
  { name: "⬜ Blanco", color: 0xdcddde, aliases: ["blanco", "white"] },
  { name: "✨ Plata", color: 0xc0c0c0, aliases: ["plata", "silver"] },
];

export const UTILITY_ROLES: { name: string; color: number; aliases?: string[] }[] =
  [
    {
      name: "🔇 Silenciado",
      color: 0x4b5563,
      aliases: ["silenciado", "muted", "mute", "muted role"],
    },
    {
      name: "🌸 Miembro",
      color: 0xff2d6b,
      aliases: ["miembro", "member", "members"],
    },
  ];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Strip emoji / symbols → lowercase alphanumeric+spaces for fuzzy name match */
function normalizeRoleLabel(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // accents
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // drop emoji/punct
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function rolePrimaryColor(role: Role): number {
  // discord.js v14+: role.colors.primaryColor; fallback role.color
  const c = (role as Role & { colors?: { primaryColor?: number } }).colors
    ?.primaryColor;
  if (typeof c === "number") return c;
  return typeof role.color === "number" ? role.color : 0;
}

/** Max channel distance (0–255 per channel) to treat two colors as "same" */
const COLOR_MATCH_THRESHOLD = 28;

function colorsNearlyEqual(a: number, b: number): boolean {
  if (a === b) return true;
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    Math.abs(ar - br) <= COLOR_MATCH_THRESHOLD &&
    Math.abs(ag - bg) <= COLOR_MATCH_THRESHOLD &&
    Math.abs(ab - bb) <= COLOR_MATCH_THRESHOLD
  );
}

function findRoleByName(guild: Guild, name: string): Role | undefined {
  const needle = name.toLowerCase();
  return guild.roles.cache.find((r) => r.name.toLowerCase() === needle);
}

/**
 * Detect if a role already exists by name:
 * 1) exact name (case-insensitive)
 * 2) normalized name / aliases (e.g. "Rojo" ≈ "🔴 Rojo")
 */
function findRoleByNameOrAlias(
  guild: Guild,
  def: { name: string; aliases?: string[] },
): Role | undefined {
  const exact = findRoleByName(guild, def.name);
  if (exact) return exact;

  const labels = new Set<string>([
    normalizeRoleLabel(def.name),
    ...(def.aliases ?? []).map((a) => normalizeRoleLabel(a)),
  ]);
  labels.delete("");

  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue; // @everyone
    if (role.managed) continue;

    const n = normalizeRoleLabel(role.name);
    // Solo coincidencia exacta del label (evita "Rojo" ≈ "Rojo oscuro")
    if (n && labels.has(n)) return role;
  }
  return undefined;
}

/**
 * Color roles: name/alias match, then near-identical hex among decorative roles.
 * Utility roles should use name-only (avoid Silenciado ≈ Gris oscuro).
 */
function findExistingColorRole(
  guild: Guild,
  def: { name: string; color: number; aliases?: string[] },
  opts: { matchColor?: boolean } = { matchColor: true },
): Role | undefined {
  const byName = findRoleByNameOrAlias(guild, def);
  if (byName) return byName;
  if (opts.matchColor === false) return undefined;

  // Color match: only decorative-looking roles (no admin-ish perms)
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id || role.managed) continue;
    if (role.permissions.has(PermissionFlagsBits.Administrator)) continue;
    if (role.permissions.has(PermissionFlagsBits.ManageGuild)) continue;
    // Skip utility roles so they don't block color palette entries
    const utilHit = UTILITY_ROLES.some(
      (u) => findRoleByNameOrAlias(guild, u)?.id === role.id,
    );
    if (utilHit) continue;
    const utilName = normalizeRoleLabel(role.name);
    if (
      utilName === "silenciado" ||
      utilName === "muted" ||
      utilName === "miembro" ||
      utilName === "member"
    ) {
      continue;
    }

    const pc = rolePrimaryColor(role);
    if (pc === 0) continue; // default grey — too ambiguous
    if (colorsNearlyEqual(pc, def.color)) return role;
  }

  return undefined;
}

async function ensureRole(
  guild: Guild,
  def: { name: string; color: number; aliases?: string[] },
  reason: string,
  mode: "color" | "utility" = "utility",
): Promise<"created" | "exists"> {
  const existing =
    mode === "color"
      ? findExistingColorRole(guild, def, { matchColor: true })
      : findRoleByNameOrAlias(guild, def);
  if (existing) return "exists";

  await guild.roles.create({
    name: def.name,
    colors: { primaryColor: def.color },
    hoist: false,
    mentionable: false,
    permissions: [],
    reason,
  });
  return "created";
}

/**
 * Apply muted role overwrites on text/voice channels so the role actually mutes.
 * Best-effort; skips channels we can't edit.
 */
async function applyMutedOverwrites(
  guild: Guild,
  mutedRole: Role,
): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  const allowed = new Set<number>([
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
    ChannelType.GuildCategory,
    ChannelType.GuildMedia,
  ]);

  for (const ch of guild.channels.cache.values()) {
    if (!allowed.has(ch.type)) continue;
    if (!("permissionOverwrites" in ch) || !ch.permissionOverwrites) continue;
    try {
      await ch.permissionOverwrites.edit(
        mutedRole,
        {
          SendMessages: false,
          AddReactions: false,
          Speak: false,
          Stream: false,
          SendMessagesInThreads: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
        },
        { reason: "Zero Two /autconfig · silenciado" },
      );
      ok++;
      if (ok % 8 === 0) await sleep(350);
    } catch {
      fail++;
    }
  }
  return { ok, fail };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autconfig")
    .setDescription(
      "⚙️ Auto-configura el servidor: colores, AutoMod, antiraid, logs y niveles",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((o) =>
      o
        .setName("canal_logs")
        .setDescription("Canal para logs del bot y alertas antiraid")
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
        )
        .setRequired(false),
    )
    .addBooleanOption((o) =>
      o
        .setName("colores")
        .setDescription("Crear roles de color (por defecto: sí)")
        .setRequired(false),
    )
    .addBooleanOption((o) =>
      o
        .setName("automod")
        .setDescription("Instalar pack AutoMod Zero Two (por defecto: sí)")
        .setRequired(false),
    )
    .addBooleanOption((o) =>
      o
        .setName("antiraid")
        .setDescription("Activar antiraid con valores seguros (por defecto: sí)")
        .setRequired(false),
    )
    .addBooleanOption((o) =>
      o
        .setName("roles_utilidad")
        .setDescription("Crear Silenciado + Miembro (por defecto: sí)")
        .setRequired(false),
    )
    .addBooleanOption((o) =>
      o
        .setName("niveles")
        .setDescription("Activar sistema de niveles/XP (por defecto: sí)")
        .setRequired(false),
    )
    .addIntegerOption((o) =>
      o
        .setName("umbral_antiraid")
        .setDescription("Joins para disparar antiraid (2–50, defecto 5)")
        .setMinValue(2)
        .setMaxValue(50)
        .setRequired(false),
    )
    .addStringOption((o) =>
      o
        .setName("accion_antiraid")
        .setDescription("Acción ante raid (defecto: kick)")
        .addChoices(
          { name: "Kick", value: "kick" },
          { name: "Ban", value: "ban" },
          { name: "Solo alerta", value: "none" },
        )
        .setRequired(false),
    )
    .addBooleanOption((o) =>
      o
        .setName("todos_eventos_logs")
        .setDescription(
          "Si hay canal_logs: activar TODOS los eventos (defecto: catálogo recomendado)",
        )
        .setRequired(false),
    ) as SlashCommandBuilder,

  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Solo funciona en un servidor.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.reply({
        content: "❌ Necesitas **Administrador** para ejecutar `/autconfig`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guild = interaction.guild;
    const me = guild.members.me;
    if (!me) {
      await interaction.reply({
        content: "❌ No pude leer mi propio miembro en el servidor.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const missing: string[] = [];
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      missing.push("Gestionar roles");
    }
    if (!me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      missing.push("Gestionar servidor");
    }
    if (missing.length) {
      await interaction.reply({
        content: `❌ Al bot le faltan permisos: **${missing.join("**, **")}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const doColors = interaction.options.getBoolean("colores") ?? true;
    const doAutomod = interaction.options.getBoolean("automod") ?? true;
    const doAntiraid = interaction.options.getBoolean("antiraid") ?? true;
    const doUtil = interaction.options.getBoolean("roles_utilidad") ?? true;
    const doLevels = interaction.options.getBoolean("niveles") ?? true;
    const allLogEvents =
      interaction.options.getBoolean("todos_eventos_logs") ?? false;
    const logsCh = interaction.options.getChannel("canal_logs");
    const umbral = interaction.options.getInteger("umbral_antiraid") ?? 5;
    const accion =
      (interaction.options.getString("accion_antiraid") as AntiraidAction | null) ??
      "kick";

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const lines: string[] = [];
    const errors: string[] = [];

    // ── 1) Color roles ──────────────────────────────────────────────────────
    if (doColors) {
      // Cache fresco para detectar roles ya creados (nombre / alias / color)
      await guild.roles.fetch().catch(() => null);

      let created = 0;
      let exists = 0;
      const skippedNames: string[] = [];
      // Separator (cosmetic)
      const sepName = "━━━━ Colores ━━━━";
      const sepAliases = ["colores", "color roles", "roles de color"];
      if (
        !findRoleByNameOrAlias(guild, {
          name: sepName,
          aliases: sepAliases,
        })
      ) {
        try {
          await guild.roles.create({
            name: sepName,
            colors: { primaryColor: 0x2b2d31 },
            hoist: false,
            mentionable: false,
            permissions: [],
            reason: COLOR_REASON,
          });
          created++;
          await sleep(400);
        } catch (e) {
          errors.push(
            `Separador colores: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      } else {
        exists++;
        skippedNames.push(sepName);
      }

      for (const def of COLOR_ROLES) {
        try {
          const r = await ensureRole(guild, def, COLOR_REASON, "color");
          if (r === "created") {
            created++;
            await sleep(400);
          } else {
            exists++;
            skippedNames.push(def.name);
          }
        } catch (e) {
          errors.push(
            `Rol ${def.name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      const skipPreview =
        skippedNames.length > 0
          ? `\n└ omitidos: ${skippedNames
              .slice(0, 10)
              .join(", ")}${skippedNames.length > 10 ? `… +${skippedNames.length - 10}` : ""}`
          : "";
      lines.push(
        `🎨 **Colores:** ${created} creados · ${exists} omitidos (ya existían) · paleta ${COLOR_ROLES.length}${skipPreview}`,
      );
    } else {
      lines.push("🎨 **Colores:** omitido");
    }

    // ── 2) Utility roles ────────────────────────────────────────────────────
    let mutedRole: Role | null = null;
    if (doUtil) {
      let created = 0;
      let exists = 0;
      for (const def of UTILITY_ROLES) {
        try {
          const before = findRoleByNameOrAlias(guild, def);
          const r = await ensureRole(guild, def, UTIL_REASON, "utility");
          if (r === "created") {
            created++;
            await sleep(400);
          } else {
            exists++;
          }
          if (def.name.includes("Silenciado")) {
            mutedRole = findRoleByNameOrAlias(guild, def) ?? before ?? null;
          }
        } catch (e) {
          errors.push(
            `Rol ${def.name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      // Refresh cache for muted
      if (!mutedRole) {
        await guild.roles.fetch().catch(() => null);
        mutedRole =
          findRoleByNameOrAlias(guild, UTILITY_ROLES[0]!) ??
          findRoleByName(guild, "🔇 Silenciado") ??
          null;
      }

      let muteOw = "";
      if (mutedRole && me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        const ow = await applyMutedOverwrites(guild, mutedRole);
        muteOw = ` · overwrites ${ow.ok} ok / ${ow.fail} fail`;
      } else if (mutedRole) {
        muteOw = " · (sin Manage Channels: no se aplicaron overwrites)";
      }

      lines.push(
        `🛠️ **Utilidad:** ${created} creados · ${exists} ya existían${muteOw}`,
      );
    } else {
      lines.push("🛠️ **Utilidad:** omitido");
    }

    // ── 3) AutoMod ──────────────────────────────────────────────────────────
    if (doAutomod) {
      try {
        const r = await installAutomodPack(guild);
        lines.push(
          `🛡️ **AutoMod:** ${r.created} nuevas · ${r.skipped} omitidas` +
            (r.errors.length ? ` · ⚠️ ${r.errors.length} avisos` : ""),
        );
        for (const e of r.errors.slice(0, 4)) {
          errors.push(`AutoMod: ${e}`);
        }
      } catch (e) {
        lines.push("🛡️ **AutoMod:** error");
        errors.push(
          `AutoMod: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } else {
      lines.push("🛡️ **AutoMod:** omitido");
    }

    // ── 4) Antiraid ─────────────────────────────────────────────────────────
    if (doAntiraid) {
      try {
        const s = await updateAntiraidSettings(guild.id, {
          enabled: true,
          threshold: umbral,
          timeWindow: 60,
          action: accion,
          logChannelId: logsCh?.id ?? undefined,
        });
        lines.push(
          `🚨 **Antiraid:** ON · umbral \`${s.threshold}\` / \`${s.timeWindow}s\` · \`${s.action}\`` +
            (s.logChannelId ? ` · logs <#${s.logChannelId}>` : ""),
        );
      } catch (e) {
        lines.push("🚨 **Antiraid:** error");
        errors.push(
          `Antiraid: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } else {
      lines.push("🚨 **Antiraid:** omitido");
    }

    // ── 5) Logs ─────────────────────────────────────────────────────────────
    if (logsCh) {
      try {
        await setLogChannelId(guild.id, logsCh.id);
        const events = allLogEvents
          ? ([...LOG_EVENT_KEYS] as (typeof LOG_EVENT_KEYS)[number][])
          : defaultLogEvents();
        await setLogEvents(guild.id, events);
        lines.push(
          `📡 **Logs:** canal <#${logsCh.id}> · **${events.length}** eventos`,
        );
      } catch (e) {
        lines.push("📡 **Logs:** error");
        errors.push(`Logs: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      lines.push(
        "📡 **Logs:** sin canal (pásalo con `canal_logs` o usa `/cfglogs set`)",
      );
    }

    // ── 6) Levels ───────────────────────────────────────────────────────────
    if (doLevels) {
      try {
        await updateLevelSettings(guild.id, {
          enabled: true,
          announceInPlace: true,
        });
        lines.push("📊 **Niveles:** activados (XP mensajes + voz)");
      } catch (e) {
        lines.push("📊 **Niveles:** error");
        errors.push(
          `Niveles: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } else {
      lines.push("📊 **Niveles:** omitido");
    }

    const hasHardErrors = errors.length > 0;
    const embed = new EmbedBuilder()
      .setColor(hasHardErrors ? AMBER : GREEN)
      .setAuthor({
        name: "Zero Two · Auto-config",
        iconURL: client.user?.displayAvatarURL({ size: 64 }),
      })
      .setTitle(
        hasHardErrors
          ? "⚙️ Setup terminado con avisos"
          : "✅ Servidor auto-configurado",
      )
      .setDescription(
        [
          `**${guild.name}** · ejecutado por <@${interaction.user.id}>`,
          "",
          ...lines,
          "",
          "**Siguiente:**",
          "• ¿Panel de colores? → usa los botones de abajo",
          "• Ajustes finos → `/automod status` · `/antiraid status` · `/cfglogs status`",
          "• Welcome → `/welcome set`",
          logsCh
            ? null
            : "• Recomendado: vuelve a correr con `canal_logs:#tu-canal`",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .setFooter({ text: `Zero Two ${BOT_VERSION} · /autconfig` })
      .setTimestamp();

    if (errors.length) {
      embed.addFields({
        name: "⚠️ Avisos",
        value: errors
          .slice(0, 12)
          .map((e) => `• ${e}`)
          .join("\n")
          .slice(0, 1000),
        inline: false,
      });
    }

    const askEmbed = new EmbedBuilder()
      .setColor(CYAN)
      .setTitle("🎨 ¿Crear panel de colores con reacciones?")
      .setDescription(
        [
          "Zero Two puede publicar un **embed** en un canal y añadir **reacciones**.",
          "Los miembros reaccionan y reciben el rol de color automáticamente.",
          "",
          "• Un color a la vez (al elegir otro se quita el anterior)",
          "• Quitar la reacción = quitar el color",
          "• Si hay muchos colores, se reparten en varios mensajes (máx. 20 reacciones c/u)",
          "",
          doColors
            ? "Pulsa **Sí** y elige el canal del panel."
            : "⚠️ No se crearon colores en este run. Aun así puedes crear el panel si los roles ya existen.",
        ].join("\n"),
      );

    const yesNoRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("autconfig_colorpanel_yes")
        .setLabel("Sí, crear panel")
        .setEmoji("🎨")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("autconfig_colorpanel_no")
        .setLabel("No, gracias")
        .setStyle(ButtonStyle.Secondary),
    );

    const replyMsg = (await interaction.editReply({
      embeds: [embed, askEmbed],
      components: [yesNoRow],
    })) as Message;

    // Best-effort staff ping in logs channel
    if (logsCh && "id" in logsCh) {
      try {
        const ch = await client.channels.fetch(logsCh.id);
        if (ch?.isTextBased() && !ch.isDMBased()) {
          await (ch as TextChannel).send({
            embeds: [
              new EmbedBuilder()
                .setColor(CYAN)
                .setTitle("⚙️ /autconfig aplicado")
                .setDescription(
                  [`Por <@${interaction.user.id}>`, lines.join("\n")].join(
                    "\n",
                  ),
                )
                .setFooter({ text: `Zero Two ${BOT_VERSION}` })
                .setTimestamp(),
            ],
          });
        }
      } catch {
        /* ignore */
      }
    }

    // ── Collector: ¿panel de colores? ───────────────────────────────────────
    const collector = replyMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 3 * 60_000,
    });

    collector.on("collect", async (i) => {
      try {
        if (i.isButton() && i.customId === "autconfig_colorpanel_no") {
          collector.stop("no");
          await i.update({
            embeds: [
              embed,
              new EmbedBuilder()
                .setColor(AMBER)
                .setTitle("🎨 Panel de colores omitido")
                .setDescription(
                  "No se creó el panel. Puedes volver a usar `/autconfig` más tarde o crear roles a mano.",
                ),
            ],
            components: [],
          });
          return;
        }

        if (i.isButton() && i.customId === "autconfig_colorpanel_yes") {
          const channelRow =
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId("autconfig_colorpanel_channel")
                .setPlaceholder("Elige el canal del panel de colores…")
                .setMinValues(1)
                .setMaxValues(1)
                .addChannelTypes(
                  ChannelType.GuildText,
                  ChannelType.GuildAnnouncement,
                ),
            );

          await i.update({
            embeds: [
              embed,
              new EmbedBuilder()
                .setColor(CYAN)
                .setTitle("📺 ¿En qué canal publico el panel?")
                .setDescription(
                  "Selecciona un canal de texto. Allí enviaré el embed y las reacciones de color.",
                ),
            ],
            components: [channelRow],
          });
          return;
        }

        if (
          i.isChannelSelectMenu() &&
          i.customId === "autconfig_colorpanel_channel"
        ) {
          const channelId = i.values[0]!;
          await i.deferUpdate();

          const ch = await client.channels.fetch(channelId).catch(() => null);
          if (!ch || !ch.isTextBased() || ch.isDMBased()) {
            await interaction.editReply({
              embeds: [
                embed,
                new EmbedBuilder()
                  .setColor(PINK)
                  .setTitle("❌ Canal inválido")
                  .setDescription(
                    "Elige un canal de texto o anuncios del servidor.",
                  ),
              ],
              components: [],
            });
            collector.stop("bad_channel");
            return;
          }

          const panel = await createColorReactionPanel(
            guild,
            ch as TextChannel,
            COLOR_ROLES,
            client.user,
          );

          collector.stop("done");

          await interaction.editReply({
            embeds: [
              embed,
              new EmbedBuilder()
                .setColor(panel.ok ? GREEN : PINK)
                .setTitle(
                  panel.ok
                    ? "✅ Panel de colores publicado"
                    : "⚠️ No se pudo crear el panel",
                )
                .setDescription(
                  [
                    panel.ok
                      ? `Canal: <#${panel.channelId}>\nMensajes: **${panel.messages}** · Roles enlazados: **${panel.roles}**`
                      : "Revisa permisos del bot en el canal (Enviar mensajes, Embeds, Añadir reacciones).",
                    panel.messageUrls.length
                      ? `\n${panel.messageUrls.map((u, n) => `[Mensaje ${n + 1}](${u})`).join(" · ")}`
                      : "",
                    panel.errors.length
                      ? `\n\n**Avisos:**\n${panel.errors
                          .slice(0, 8)
                          .map((e) => `• ${e}`)
                          .join("\n")}`
                      : "",
                    panel.ok
                      ? "\n\nLos miembros ya pueden reaccionar para obtener su color 🌸"
                      : "",
                  ].join(""),
                ),
            ],
            components: [],
          });
        }
      } catch (err) {
        await i
          .reply({
            content: `❌ Error en el panel: ${err instanceof Error ? err.message : String(err)}`,
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => null);
      }
    });

    collector.on("end", async (_c, reason) => {
      if (reason === "time") {
        await interaction
          .editReply({
            components: [],
            embeds: [
              embed,
              new EmbedBuilder()
                .setColor(AMBER)
                .setTitle("⏳ Tiempo agotado")
                .setDescription(
                  "No respondiste a tiempo. Usa `/autconfig` otra vez si quieres el panel de colores.",
                ),
            ],
          })
          .catch(() => null);
      }
    });
  },
};

export default command;
