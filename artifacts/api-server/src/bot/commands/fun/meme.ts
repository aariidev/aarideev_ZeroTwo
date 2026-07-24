/**
 * /meme — memes desde subreddits de Reddit (p. ej. r/SpanishMeme/top).
 *
 * Fuente principal: meme-api.com (proxy en vivo de Reddit; el .json directo
 * suele devolver 403 sin OAuth).
 * Fallback: pullpush.io (archivo, orden por score ≈ “top”).
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  ComponentType,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
  type Message,
  type TextChannel,
} from "discord.js";
import { Command } from "../../types.js";
import { BOT_VERSION } from "../../lib/version.js";
import { logger } from "../../../lib/logger.js";
import {
  getMemeChannelConfig,
  setMemeChannelConfig,
  type MemeChannelConfig,
} from "../../lib/memeChannels.js";

const PINK = 0xff2d6b;
const AMBER = 0xf59e0b;
const DARK = 0x1a1a2e;
const RED = 0xef4444;
const GREEN = 0x22c55e;
const CYAN = 0x22d3ee;

/** Categoría → subreddits reales (prioridad en orden) */
const CATEGORIES: {
  id: string;
  label: string;
  emoji: string;
  /** Subs de Reddit; el primero es el “principal” (estilo /top) */
  subs: string[];
  /** Requiere aceptar disclaimer de humor negro */
  requiresDisclaimer?: boolean;
}[] = [
  {
    id: "spanish",
    label: "Español",
    emoji: "🇪🇸",
    // https://www.reddit.com/r/SpanishMeme/top/
    // https://www.reddit.com/r/BuenosMemesEsp/
    subs: [
      "SpanishMeme",
      "BuenosMemesEsp",
      "memesenespanol",
      "yo_ctm",
      "SpainMemes",
    ],
  },
  {
    id: "random",
    label: "Aleatorio",
    emoji: "🎲",
    subs: [
      "memes",
      "dankmemes",
      "me_irl",
      "funny",
      "SpanishMeme",
      "BuenosMemesEsp",
      "ProgrammerHumor",
      "Animemes",
    ],
  },
  {
    id: "programming",
    label: "Programación",
    emoji: "💻",
    // https://www.reddit.com/r/ProgrammerHumor/
    subs: ["ProgrammerHumor", "programmingmemes", "ProgrammerAnimemes"],
  },
  {
    id: "gaming",
    label: "Gaming",
    emoji: "🎮",
    subs: ["gamingmemes", "pcmasterrace", "Gamingcirclejerk"],
  },
  {
    id: "anime",
    label: "Anime",
    emoji: "🌸",
    // https://www.reddit.com/r/Animemes/
    subs: ["Animemes", "goodanimemes", "AnimeFunny", "animemes"],
  },
  {
    id: "wholesome",
    label: "Wholesome",
    emoji: "🥰",
    subs: ["wholesomememes", "MadeMeSmile"],
  },
  {
    id: "dank",
    label: "Dank",
    emoji: "🔥",
    subs: ["dankmemes", "okbuddyretard"],
  },
  {
    id: "cats",
    label: "Gatos",
    emoji: "🐱",
    subs: ["catmemes", "blep", "CatsOnKeyboards"],
  },
  // Humor negro DESACTIVADO (subs ban/403 en Reddit). No reactivar sin fuente estable.
];

/** Feature flag: humor negro desactivado (errores 403 / subs privados) */
const DARK_HUMOR_ENABLED = false;

/** Subs de humor negro bloqueados mientras la feature esté off */
const DARK_SUBS = new Set(
  [
    "darkmemes",
    "edgymemes",
    "imgoingtohellforthis",
    "darkjokes",
    "actualdarkhumor",
    "darkhumorandmemes",
    "cursedcomments",
  ].map((s) => s.toLowerCase()),
);

function hasDarkDisclaimer(_userId: string): boolean {
  return false;
}

function acceptDarkDisclaimer(_userId: string) {
  /* disabled */
}

function needsDisclaimer(
  categoryId: string,
  subreddit: string | null | undefined,
): boolean {
  if (!DARK_HUMOR_ENABLED) return false;
  const cat = categoryMeta(categoryId);
  if (cat.requiresDisclaimer) return true;
  if (subreddit && DARK_SUBS.has(subreddit.toLowerCase())) return true;
  return false;
}

function isDarkHumorBlocked(
  categoryId: string,
  subreddit: string | null | undefined,
): boolean {
  if (DARK_HUMOR_ENABLED) return false;
  if (categoryId === "dark") return true;
  if (subreddit && DARK_SUBS.has(subreddit.toLowerCase())) return true;
  return false;
}

function darkHumorDisabledEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(AMBER)
    .setTitle("🖤 Humor negro desactivado")
    .setDescription(
      [
        "La categoría de **humor negro** está temporalmente **desactivada**.",
        "",
        "Los subreddits (p. ej. `r/darkmemes`) devuelven **403** (privados o baneados) y el nexo fallaba.",
        "",
        "Puedes seguir con:",
        "• `/meme ver categoria:Español`",
        "• `/meme ver categoria:Dank`",
        "• `/meme ver categoria:Anime`",
      ].join("\n"),
    )
    .setFooter({ text: `Zero Two ${BOT_VERSION}` })
    .setTimestamp();
}

type SortMode = "top" | "hot" | "new";

type MemePayload = {
  title: string;
  imageUrl: string;
  postLink: string;
  subreddit: string;
  author: string;
  ups: number;
  nsfw: boolean;
  source: "reddit-live" | "reddit-top-archive";
};

/** Evita repetir el mismo post en la misma sesión del bot */
const recentUrls = new Map<string, number>();
const RECENT_TTL_MS = 45 * 60_000;
const RECENT_MAX = 80;

function rememberUrl(url: string) {
  const now = Date.now();
  recentUrls.set(url, now);
  if (recentUrls.size > RECENT_MAX) {
    for (const [k, t] of recentUrls) {
      if (now - t > RECENT_TTL_MS) recentUrls.delete(k);
    }
  }
}

function wasRecent(url: string): boolean {
  const t = recentUrls.get(url);
  if (!t) return false;
  if (Date.now() - t > RECENT_TTL_MS) {
    recentUrls.delete(url);
    return false;
  }
  return true;
}

function categoryMeta(categoryId: string) {
  return CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0]!;
}

function pickSub(categoryId: string, preferPrimary = false): string {
  const cat = categoryMeta(categoryId);
  if (preferPrimary || Math.random() < 0.55) return cat.subs[0]!;
  return cat.subs[Math.floor(Math.random() * cat.subs.length)]!;
}

function redditTopUrl(sub: string, t: string = "week"): string {
  return `https://www.reddit.com/r/${encodeURIComponent(sub)}/top/?t=${t}`;
}

function isImageUrl(url: string): boolean {
  if (!url) return false;
  const u = url.split("?")[0]!.toLowerCase();
  if (/\.(jpe?g|png|gif|webp)$/i.test(u)) return true;
  if (u.includes("i.redd.it") || u.includes("preview.redd.it")) return true;
  if (u.includes("i.imgur.com") || u.includes("imgur.com/")) return true;
  if (u.includes("redd.it/")) return true;
  return false;
}

function normalizeImageUrl(url: string): string {
  // preview.redd.it a veces necesita decodificar &amp;
  let u = url.replace(/&amp;/g, "&");
  if (u.startsWith("http://")) u = "https://" + u.slice(7);
  // imgur página → intento i.imgur directo si es id simple
  const imgur = u.match(/imgur\.com\/([a-zA-Z0-9]+)(?:\.[a-z]+)?$/i);
  if (imgur && !u.includes("i.imgur.com") && !u.includes("/a/")) {
    u = `https://i.imgur.com/${imgur[1]}.jpg`;
  }
  return u;
}

/** Subs ban/privados en Reddit vivo → ir directo al archivo */
const LIVE_BLOCKED_SUBS = new Set(
  [
    "darkmemes",
    "edgymemes",
    "imgoingtohellforthis",
    "actualdarkhumor",
    "darkhumorandmemes",
  ].map((s) => s.toLowerCase()),
);

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": `ZeroTwoBot/${BOT_VERSION} (Discord meme; +https://github.com/aariidev)`,
    },
    signal: AbortSignal.timeout(14_000),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { message?: string };
      detail = j.message ? `: ${j.message}` : "";
    } catch {
      /* */
    }
    throw new Error(`HTTP ${res.status}${detail}`);
  }
  return res.json();
}

/**
 * Reddit en vivo vía meme-api (gimme saca posts reales del subreddit).
 * Batch: /gimme/{sub}/{n}
 */
async function fetchLiveFromSub(
  subreddit: string,
  count = 24,
  allowNsfw = false,
): Promise<MemePayload[]> {
  const url = `https://meme-api.com/gimme/${encodeURIComponent(subreddit)}/${count}`;
  const data = (await fetchJson(url)) as {
    memes?: Array<{
      title?: string;
      url?: string;
      postLink?: string;
      subreddit?: string;
      author?: string;
      ups?: number;
      nsfw?: boolean;
      spoiler?: boolean;
    }>;
    // single response shape
    title?: string;
    url?: string;
    postLink?: string;
    author?: string;
    ups?: number;
    nsfw?: boolean;
    spoiler?: boolean;
  };

  const list = Array.isArray(data.memes)
    ? data.memes
    : data.url
      ? [data]
      : [];

  const out: MemePayload[] = [];
  for (const m of list) {
    if (!m?.url) continue;
    if (m.spoiler) continue;
    if (m.nsfw && !allowNsfw) continue;
    if (!isImageUrl(m.url)) continue;
    const imageUrl = normalizeImageUrl(m.url);
    out.push({
      title: (m.title ?? "Meme").slice(0, 250),
      imageUrl,
      postLink: m.postLink ?? imageUrl,
      subreddit: m.subreddit ?? subreddit,
      author: m.author ?? "?",
      ups: typeof m.ups === "number" ? m.ups : 0,
      nsfw: Boolean(m.nsfw),
      source: "reddit-live",
    });
  }
  return out;
}

/**
 * Archivo Reddit (top por score) — útil si el live falla.
 * https://api.pullpush.io
 */
async function fetchTopArchive(
  subreddit: string,
  allowNsfw = false,
): Promise<MemePayload[]> {
  const url =
    `https://api.pullpush.io/reddit/search/submission/` +
    `?subreddit=${encodeURIComponent(subreddit)}` +
    `&sort=desc&sort_type=score&size=40`;
  const data = (await fetchJson(url)) as {
    data?: Array<{
      title?: string;
      url?: string;
      permalink?: string;
      author?: string;
      score?: number;
      over_18?: boolean;
      spoiler?: boolean;
      is_video?: boolean;
    }>;
  };

  const out: MemePayload[] = [];
  for (const p of data.data ?? []) {
    if (!p || p.spoiler || p.is_video) continue;
    if (p.over_18 && !allowNsfw) continue;
    const raw = p.url ?? "";
    if (!isImageUrl(raw)) continue;
    const imageUrl = normalizeImageUrl(raw);
    const link = p.permalink
      ? p.permalink.startsWith("http")
        ? p.permalink
        : `https://www.reddit.com${p.permalink}`
      : imageUrl;
    out.push({
      title: (p.title ?? "Meme").slice(0, 250),
      imageUrl,
      postLink: link,
      subreddit,
      author: p.author ?? "?",
      ups: p.score ?? 0,
      nsfw: Boolean(p.over_18),
      source: "reddit-top-archive",
    });
  }
  // ya vienen por score; barajar el top 15 para variedad
  return out.slice(0, 25);
}

function pickFromPool(
  pool: MemePayload[],
  preferFresh: boolean,
): MemePayload | null {
  if (!pool.length) return null;
  const fresh = preferFresh
    ? pool.filter((m) => !wasRecent(m.imageUrl) && !wasRecent(m.postLink))
    : pool;
  const list = fresh.length ? fresh : pool;
  // sesgo hacia más ups (top)
  const sorted = [...list].sort((a, b) => b.ups - a.ups);
  const topSlice = sorted.slice(0, Math.min(12, sorted.length));
  return topSlice[Math.floor(Math.random() * topSlice.length)] ?? null;
}

async function tryPickFromSub(
  sub: string,
  allowNsfw: boolean,
  preferArchive: boolean,
): Promise<MemePayload | null> {
  const blockedLive = LIVE_BLOCKED_SUBS.has(sub.toLowerCase());
  const order: Array<"archive" | "live"> = preferArchive || blockedLive
    ? ["archive", "live"]
    : ["live", "archive"];

  for (const src of order) {
    try {
      if (src === "live") {
        if (blockedLive) continue;
        const live = await fetchLiveFromSub(sub, 30, allowNsfw);
        const picked = pickFromPool(live, true);
        if (picked) return picked;
      } else {
        const top = await fetchTopArchive(sub, allowNsfw);
        const picked = pickFromPool(top, true);
        if (picked) return picked;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 403 ban/private es esperado en dark clásicos — no spamear stack
      if (/HTTP 403|Locked or Private|does not exist/i.test(msg)) {
        logger.debug({ sub, src, msg }, "meme: sub no disponible (vivo)");
      } else {
        logger.debug({ err, sub, src }, "meme: fetch fail");
      }
    }
  }
  return null;
}

async function obtenerMeme(
  categoryId: string,
  opts?: {
    subreddit?: string | null;
    sort?: SortMode;
    /** Solo en canales NSFW + disclaimer aceptado */
    allowNsfw?: boolean;
  },
): Promise<MemePayload & { categoryId: string }> {
  const allowNsfw = Boolean(opts?.allowNsfw);
  const forcedSub = opts?.subreddit?.replace(/^r\//i, "").trim() || null;
  const effectiveCat =
    forcedSub && DARK_SUBS.has(forcedSub.toLowerCase())
      ? "dark"
      : categoryId;
  const isDark = effectiveCat === "dark" || categoryMeta(effectiveCat).requiresDisclaimer;

  // Dark: probar todos los subs de la categoría (archivo + vivos)
  let trySubs: string[];
  if (forcedSub) {
    trySubs = [forcedSub];
    // Si el forzado está ban, añadir backups de dark
    if (isDark || LIVE_BLOCKED_SUBS.has(forcedSub.toLowerCase())) {
      trySubs.push(...(CATEGORIES.find((c) => c.id === "dark")?.subs ?? []));
    }
  } else if (isDark) {
    // todos los dark, barajados pero priorizando primarios
    const darkSubs = [...(CATEGORIES.find((c) => c.id === "dark")?.subs ?? [])];
    trySubs = darkSubs;
  } else {
    trySubs = [
      pickSub(effectiveCat, true),
      pickSub(effectiveCat, false),
      pickSub(effectiveCat, false),
    ];
  }
  trySubs = [...new Set(trySubs.filter(Boolean))];

  for (const sub of trySubs) {
    const picked = await tryPickFromSub(sub, allowNsfw, isDark);
    if (picked) {
      rememberUrl(picked.imageUrl);
      rememberUrl(picked.postLink);
      return { ...picked, categoryId: effectiveCat };
    }
  }

  // Último recurso dark: allowNsfw false → reintentar archivo sin filtro estricto de vacío
  if (isDark && !allowNsfw) {
    for (const sub of trySubs.slice(0, 4)) {
      try {
        const top = await fetchTopArchive(sub, false);
        const picked = pickFromPool(top, false);
        if (picked) {
          rememberUrl(picked.imageUrl);
          return { ...picked, categoryId: effectiveCat };
        }
      } catch {
        /* */
      }
    }
  }

  logger.warn({ categoryId, trySubs, allowNsfw }, "meme: sin resultados");
  throw new Error(
    isDark
      ? "No hay memes de humor negro disponibles ahora (subs ban/privados o sin imágenes). Prueba de nuevo o usa canal NSFW."
      : "No hay memes de imagen en esos subreddits ahora mismo",
  );
}

function buildMemeEmbed(
  client: Client,
  meme: MemePayload & { categoryId: string },
  requesterTag: string,
): EmbedBuilder {
  const cat = categoryMeta(meme.categoryId);
  const topLink = redditTopUrl(meme.subreddit, "week");
  const sourceLabel =
    meme.source === "reddit-live"
      ? "Reddit (en vivo)"
      : "Reddit top (archivo)";

  return new EmbedBuilder()
    .setColor(PINK)
    .setAuthor({
      name: "Zero Two · Memes de Reddit",
      iconURL: client.user?.displayAvatarURL({ size: 64 }),
    })
    .setTitle(`${cat.emoji} ${meme.title}`.slice(0, 256))
    .setURL(meme.postLink)
    .setImage(meme.imageUrl)
    .addFields(
      {
        name: "📂 Categoría",
        value: `${cat.emoji} ${cat.label}`,
        inline: true,
      },
      {
        name: "📡 Subreddit",
        value: `[r/${meme.subreddit}](${topLink})`,
        inline: true,
      },
      {
        name: "⬆️ Ups",
        value: `\`${meme.ups.toLocaleString("es")}\``,
        inline: true,
      },
      {
        name: "🔗 Post",
        value: `[Abrir en Reddit](${meme.postLink}) · [Top de r/${meme.subreddit}](${topLink})`,
        inline: false,
      },
    )
    .setFooter({
      text: `u/${meme.author} · ${sourceLabel} · ${requesterTag} · Zero Two ${BOT_VERSION}`,
    })
    .setTimestamp();
}

function memeButtons(userId: string, categoryId: string, subreddit: string) {
  const sub = subreddit || "_";
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`meme:next:${userId}:${categoryId}:${sub}`)
      .setLabel("Otro meme")
      .setEmoji("🎲")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`meme:sub:${userId}:BuenosMemesEsp`)
      .setLabel("BuenosMemesEsp")
      .setEmoji("🇪🇸")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`meme:sub:${userId}:ProgrammerHumor`)
      .setLabel("ProgrammerHumor")
      .setEmoji("💻")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`meme:sub:${userId}:Animemes`)
      .setLabel("Animemes")
      .setEmoji("🌸")
      .setStyle(ButtonStyle.Secondary),
  );
}

function memeButtonsRow2(userId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`meme:sub:${userId}:SpanishMeme`)
      .setLabel("SpanishMeme")
      .setEmoji("🇪🇸")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`meme:random:${userId}`)
      .setLabel("Aleatorio")
      .setEmoji("🌀")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`meme:close:${userId}`)
      .setLabel("Cerrar")
      .setStyle(ButtonStyle.Secondary),
  );
}

function memeComponents(userId: string, categoryId: string, subreddit: string) {
  return [
    memeButtons(userId, categoryId, subreddit),
    memeButtonsRow2(userId),
  ];
}

function disclaimerEmbed(client: Client): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(DARK)
    .setAuthor({
      name: "Zero Two · Disclaimer",
      iconURL: client.user?.displayAvatarURL({ size: 64 }),
    })
    .setTitle("🖤 Humor negro — condiciones de acceso")
    .setDescription(
      [
        "Estás a punto de abrir la categoría de **humor negro / edgy**.",
        "",
        "**Al aceptar confirmas que:**",
        "• Tienes **+18** (o la edad legal de tu país)",
        "• Entiendes que el contenido puede ser **ofensivo, crudo o perturbador**",
        "• Zero Two **no respalda** el contenido: solo lo trae de Reddit",
        "• Eres **responsable** de lo que veas y de no reenviarlo a menores",
        "• En canales **no-NSFW** solo se muestran posts sin marca +18",
        "• En canales **NSFW** puede haber material marcado como tal",
        "",
        "Si no estás de acuerdo, pulsa **Rechazar**.",
        "",
        "_La aceptación dura **12 horas** en este bot (por usuario)._",
      ].join("\n"),
    )
    .setFooter({
      text: `Zero Two ${BOT_VERSION} · r/darkmemes · r/ImGoingToHellForThis · …`,
    })
    .setTimestamp();
}

function disclaimerButtons(userId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`meme:dark_accept:${userId}`)
      .setLabel("Acepto las condiciones")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`meme:dark_decline:${userId}`)
      .setLabel("Rechazar")
      .setEmoji("🚫")
      .setStyle(ButtonStyle.Secondary),
  );
}

function channelAllowsNsfw(
  interaction: ChatInputCommandInteraction,
): boolean {
  const ch = interaction.channel;
  if (!ch || ch.isDMBased()) return false;
  return "nsfw" in ch && Boolean((ch as { nsfw?: boolean }).nsfw);
}

async function resolveTargetChannel(
  interaction: ChatInputCommandInteraction,
  isDark: boolean,
  cfg: MemeChannelConfig,
): Promise<{ channel: TextChannel | null; viaConfig: boolean }> {
  const configuredId = isDark ? cfg.darkChannelId : cfg.memeChannelId;
  if (configuredId && interaction.guild) {
    try {
      const ch = await interaction.guild.channels.fetch(configuredId);
      if (ch && ch.isTextBased() && !ch.isDMBased()) {
        return { channel: ch as TextChannel, viaConfig: true };
      }
    } catch {
      /* fall through */
    }
  }
  const cur = interaction.channel;
  if (cur && cur.isTextBased() && !cur.isDMBased()) {
    return { channel: cur as TextChannel, viaConfig: false };
  }
  return { channel: null, viaConfig: false };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("😂 Memes de Reddit — ver y configurar canal de memes")
    .addSubcommand((s) =>
      s
        .setName("ver")
        .setDescription("🎲 Ver un meme (usa canales configurados si existen)")
        .addStringOption((o) =>
          o
            .setName("categoria")
            .setDescription(
              "📂 Categoría (🖤 Humor negro pide aceptar condiciones)",
            )
            .setRequired(false)
            .addChoices(
              ...CATEGORIES.map((c) => ({
                name: c.requiresDisclaimer
                  ? `${c.emoji} ${c.label} (18+ disclaimer)`
                  : `${c.emoji} ${c.label}`,
                value: c.id,
              })),
            ),
        )
        .addStringOption((o) =>
          o
            .setName("subreddit")
            .setDescription(
              "📡 Subreddit (SpanishMeme, darkmemes, Animemes…)",
            )
            .setRequired(false)
            .setMinLength(2)
            .setMaxLength(32),
        )
        .addBooleanOption((o) =>
          o
            .setName("aqui")
            .setDescription(
              "📍 Forzar respuesta en este canal (ignora config)",
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("config")
        .setDescription("⚙️ Configura el canal de memes del servidor (admin)")
        .addChannelOption((o) =>
          o
            .setName("canal_memes")
            .setDescription("😂 Canal donde publicar memes")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
            )
            .setRequired(false),
        )
        .addBooleanOption((o) =>
          o
            .setName("limpiar")
            .setDescription("🧹 Quitar la config de canales")
            .setRequired(false),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("status")
        .setDescription("📊 Ver canales de memes configurados"),
    ) as SlashCommandBuilder,

  cooldown: 4,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sub = interaction.options.getSubcommand(true);

    // ── config ─────────────────────────────────────────────────────────────
    if (sub === "config") {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      ) {
        await interaction.reply({
          content:
            "❌ Necesitas **Gestionar servidor** para configurar canales de memes.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!interaction.guild) {
        await interaction.reply({
          content: "❌ Solo en un servidor.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const clear = interaction.options.getBoolean("limpiar") ?? false;
      const memeCh = interaction.options.getChannel("canal_memes");

      if (clear) {
        await setMemeChannelConfig(interaction.guild.id, {
          memeChannelId: null,
          darkChannelId: null,
        });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(AMBER)
              .setAuthor({
                name: "Zero Two · Memes",
                iconURL: client.user?.displayAvatarURL({ size: 64 }),
              })
              .setTitle("🧹 Config de memes limpiada")
              .setDescription(
                "Ya no hay canal fijo. `/meme ver` responderá en el canal donde lo uses.",
              )
              .setFooter({ text: `Zero Two ${BOT_VERSION}` })
              .setTimestamp(),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!memeCh) {
        await interaction.reply({
          content: "❌ Pasa `canal_memes` o `limpiar:true`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const cfg = await setMemeChannelConfig(interaction.guild.id, {
        memeChannelId: memeCh.id,
        // humor negro desactivado: no se usa
        darkChannelId: null,
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setAuthor({
              name: "Zero Two · Memes",
              iconURL: client.user?.displayAvatarURL({ size: 64 }),
            })
            .setTitle("✅ Canal de memes actualizado")
            .setDescription(
              [
                `😂 **Canal:** ${cfg.memeChannelId ? `<#${cfg.memeChannelId}>` : "`sin configurar`"}`,
                "",
                "Cuando uses `/meme ver`, el bot publicará ahí (si está definido).",
                "Tip: `/meme ver aqui:true` fuerza el canal actual.",
                "",
                "_Humor negro está desactivado temporalmente._",
              ].join("\n"),
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION} · /meme status` })
            .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // ── status ─────────────────────────────────────────────────────────────
    if (sub === "status") {
      if (!interaction.guild) {
        await interaction.reply({
          content: "❌ Solo en un servidor.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const cfg = await getMemeChannelConfig(interaction.guild.id);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(CYAN)
            .setAuthor({
              name: "Zero Two · Memes",
              iconURL: client.user?.displayAvatarURL({ size: 64 }),
            })
            .setTitle("📊 Configuración de canales")
            .addFields({
              name: "😂 Canal de memes",
              value: cfg.memeChannelId
                ? `<#${cfg.memeChannelId}>`
                : "_No configurado — se usa el canal actual_",
              inline: false,
            })
            .setDescription(
              [
                "Configura con `/meme config` · requiere **Gestionar servidor**.",
                "",
                "🖤 Humor negro: **desactivado** (subs con errores 403).",
              ].join("\n"),
            )
            .setFooter({
              text: cfg.updatedAt
                ? `Actualizado ${cfg.updatedAt}`
                : `Zero Two ${BOT_VERSION}`,
            })
            .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // ── ver (default subcommand path) ──────────────────────────────────────
    let categoryId =
      interaction.options.getString("categoria") ?? "spanish";
    let subOpt = interaction.options.getString("subreddit");
    const forceHere = interaction.options.getBoolean("aqui") ?? false;
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id ?? "";
    const cfg = guildId
      ? await getMemeChannelConfig(guildId)
      : { memeChannelId: null, darkChannelId: null };

    // Bloqueo temprano: humor negro desactivado
    if (isDarkHumorBlocked(categoryId, subOpt)) {
      await interaction.reply({
        embeds: [darkHumorDisabledEmbed()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const isDarkRequest = false; // humor negro off
    // NSFW allow = target channel nsfw (config dark or current)
    let allowNsfw = channelAllowsNsfw(interaction);
    if (!forceHere && isDarkRequest && cfg.darkChannelId && interaction.guild) {
      try {
        const dch = await interaction.guild.channels.fetch(cfg.darkChannelId);
        if (dch && "nsfw" in dch) allowNsfw = Boolean((dch as { nsfw?: boolean }).nsfw);
      } catch {
        /* */
      }
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const publishMeme = async (
      meme: Awaited<ReturnType<typeof obtenerMeme>>,
      embed: EmbedBuilder,
    ) => {
      const dark =
        meme.categoryId === "dark" ||
        needsDisclaimer(meme.categoryId, meme.subreddit);
      if (dark) embed.setColor(DARK);

      const force = forceHere;
      const { channel, viaConfig } = force
        ? {
            channel:
              interaction.channel &&
              interaction.channel.isTextBased() &&
              !interaction.channel.isDMBased()
                ? (interaction.channel as TextChannel)
                : null,
            viaConfig: false,
          }
        : await resolveTargetChannel(interaction, dark, cfg);

      // Publicar en canal de destino
      if (channel && (viaConfig || force)) {
        try {
          const sent = await channel.send({
            embeds: [embed],
            components: memeComponents(
              userId,
              meme.categoryId,
              meme.subreddit,
            ),
          });
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(dark ? DARK : GREEN)
                .setTitle(dark ? "🖤 Meme de humor negro publicado" : "😂 Meme publicado")
                .setDescription(
                  [
                    `Canal: ${channel}`,
                    viaConfig
                      ? "_Usando canal configurado con `/meme config`._"
                      : "_Publicado aquí (`aqui:true`)._",
                    "",
                    `[Ir al mensaje](${sent.url})`,
                  ].join("\n"),
                )
                .setFooter({ text: `Zero Two ${BOT_VERSION}` }),
            ],
            components: [],
          });
          // Collector en el mensaje público
          attachMemeCollector(sent, {
            interaction,
            client,
            userId,
            categoryId: meme.categoryId,
            subOpt: meme.subreddit,
            allowNsfw:
              allowNsfw ||
              ("nsfw" in channel && Boolean((channel as { nsfw?: boolean }).nsfw)),
            lastEmbed: embed,
            publicMessage: true,
            targetChannelId: channel.id,
            forceHere: force,
            guildCfg: cfg,
          });
          return;
        } catch (err) {
          logger.warn({ err }, "meme: no se pudo publicar en canal config");
        }
      }

      // Fallback: respuesta ephemeral con botones (solo el usuario ve el panel)
      const replyMsg = await interaction.editReply({
        embeds: [embed],
        components: memeComponents(userId, meme.categoryId, meme.subreddit),
      });
      attachMemeCollector(replyMsg as Message, {
        interaction,
        client,
        userId,
        categoryId: meme.categoryId,
        subOpt: subOpt,
        allowNsfw,
        lastEmbed: embed,
        publicMessage: false,
        targetChannelId: null,
        forceHere: force,
        guildCfg: cfg,
      });
    };

    const showDisclaimerGate = async (
      pendingCat: string,
      pendingSub: string | null,
    ) => {
      const msg = await interaction.editReply({
        embeds: [disclaimerEmbed(client)],
        components: [disclaimerButtons(userId)],
      });

      const gate = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 3 * 60_000,
        max: 1,
      });

      gate.on("collect", async (i) => {
        if (i.user.id !== userId) {
          await i
            .reply({
              content: "❌ Este disclaimer no es tuyo.",
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => null);
          return;
        }
        const action = i.customId.split(":")[1];
        if (action === "dark_decline") {
          await i
            .update({
              embeds: [
                new EmbedBuilder()
                  .setColor(AMBER)
                  .setTitle("🚫 Acceso denegado")
                  .setDescription(
                    "No aceptaste las condiciones del humor negro.\nPuedes usar `/meme ver` con otras categorías cuando quieras.",
                  ),
              ],
              components: [],
            })
            .catch(() => null);
          return;
        }
        if (action === "dark_accept") {
          acceptDarkDisclaimer(userId);
          await i.deferUpdate().catch(() => null);
          try {
            const meme = await obtenerMeme(pendingCat, {
              subreddit: pendingSub,
              allowNsfw,
            });
            const embed = buildMemeEmbed(
              client,
              meme,
              interaction.user.username,
            );
            embed.setFooter({
              text: `🖤 Disclaimer aceptado · u/${meme.author} · ${interaction.user.username} · Zero Two ${BOT_VERSION}`,
            });
            await publishMeme(meme, embed);
          } catch (err) {
            logger.error({ err }, "meme dark after accept failed");
            await interaction
              .editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor(PINK)
                    .setTitle("❌ No pude cargar humor negro")
                    .setDescription(
                      "Aceptaste el disclaimer, pero Reddit no devolvió imágenes.\nPrueba de nuevo o configura un canal NSFW con `/meme config`.",
                    ),
                ],
                components: [],
              })
              .catch(() => null);
          }
        }
      });

      gate.on("end", async (_c, reason) => {
        if (reason === "time") {
          await interaction
            .editReply({
              components: [],
              embeds: [
                disclaimerEmbed(client).setFooter({
                  text: "⏳ Tiempo agotado — vuelve a usar /meme ver",
                }),
              ],
            })
            .catch(() => null);
        }
      });
    };

    // Gate disclaimer (desactivado con DARK_HUMOR_ENABLED=false)
    if (
      DARK_HUMOR_ENABLED &&
      needsDisclaimer(categoryId, subOpt) &&
      !hasDarkDisclaimer(userId)
    ) {
      await showDisclaimerGate(categoryId, subOpt);
      return;
    }

    try {
      const meme = await obtenerMeme(categoryId, {
        subreddit: subOpt,
        allowNsfw: false,
      });
      const embed = buildMemeEmbed(
        client,
        meme,
        interaction.user.username,
      );
      if (meme.categoryId === "dark" || meme.nsfw) {
        embed.setColor(DARK);
        if (meme.nsfw) {
          embed.addFields({
            name: "⚠️ NSFW",
            value: "Post marcado +18 · solo visible en canal NSFW",
            inline: false,
          });
        }
      }
      await publishMeme(meme, embed);
    } catch (err) {
      logger.error({ err }, "meme command failed");
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setTitle("❌ Error al cargar memes de Reddit")
            .setDescription(
              [
                "No pude leer el subreddit ahora mismo.",
                "Prueba:",
                "• `/meme ver categoria:Español`",
                "• `/meme ver categoria:Dank`",
                "• `/meme config` para fijar el canal",
              ].join("\n"),
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION}` }),
        ],
        components: [],
      });
    }
  },
};

function attachMemeCollector(
  msg: Message,
  ctx: {
    interaction: ChatInputCommandInteraction;
    client: Client;
    userId: string;
    categoryId: string;
    subOpt: string | null;
    allowNsfw: boolean;
    lastEmbed: EmbedBuilder;
    publicMessage?: boolean;
    targetChannelId?: string | null;
    forceHere?: boolean;
    guildCfg?: MemeChannelConfig;
  },
) {
  let categoryId = ctx.categoryId;
  let subOpt = ctx.subOpt;
  const { interaction, client, userId } = ctx;
  let allowNsfw = ctx.allowNsfw;
  let lastEmbed = ctx.lastEmbed;
  const publicMessage = ctx.publicMessage ?? false;
  const guildCfg = ctx.guildCfg ?? {
    memeChannelId: null,
    darkChannelId: null,
  };

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60_000,
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== userId) {
      await i
        .reply({
          content: "❌ Este panel de memes no es tuyo, parásito.",
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => null);
      return;
    }

    const parts = i.customId.split(":");
    const action = parts[1];

    if (action === "close") {
      collector.stop("close");
      await i
        .update({
          components: [],
          embeds: [
            EmbedBuilder.from(i.message.embeds[0] ?? lastEmbed).setFooter({
              text: `Cerrado · Zero Two ${BOT_VERSION}`,
            }),
          ],
        })
        .catch(() => null);
      return;
    }

    // Humor negro desactivado: ignorar botones legacy
    if (
      action === "disclaimer" ||
      action === "dark_decline" ||
      action === "dark_accept" ||
      action === "cat"
    ) {
      await i
        .update({
          embeds: [darkHumorDisabledEmbed()],
          components: memeComponents(userId, "spanish", "SpanishMeme"),
        })
        .catch(() => null);
      return;
    }

    let nextCat = categoryId;
    let nextSub: string | null = subOpt;

    if (action === "random") {
      nextCat = "random";
      nextSub = null;
    } else if (action === "sub") {
      nextSub = parts[3] ?? null;
      if (nextSub === "ProgrammerHumor") nextCat = "programming";
      else if (nextSub === "Animemes" || nextSub === "animemes")
        nextCat = "anime";
      else if (nextSub === "SpanishMeme" || nextSub === "BuenosMemesEsp")
        nextCat = "spanish";
      else if (nextSub && isDarkHumorBlocked("spanish", nextSub)) {
        await i
          .update({
            embeds: [darkHumorDisabledEmbed()],
            components: memeComponents(userId, "spanish", "SpanishMeme"),
          })
          .catch(() => null);
        return;
      }
    } else if (action === "next") {
      nextCat = parts[3] ?? categoryId;
      const s = parts[4];
      nextSub = s && s !== "_" ? s : subOpt;
      if (isDarkHumorBlocked(nextCat, nextSub)) {
        await i
          .update({
            embeds: [darkHumorDisabledEmbed()],
            components: memeComponents(userId, "spanish", "SpanishMeme"),
          })
          .catch(() => null);
        return;
      }
    }

    await i.deferUpdate().catch(() => null);

    try {
      if (isDarkHumorBlocked(nextCat, nextSub)) {
        await i
          .update({
            embeds: [darkHumorDisabledEmbed()],
            components: memeComponents(userId, "spanish", "SpanishMeme"),
          })
          .catch(() => null);
        return;
      }
      const next = await obtenerMeme(nextCat, {
        subreddit: nextSub,
        allowNsfw: false,
      });
      lastEmbed = buildMemeEmbed(
        client,
        next,
        interaction.user.username,
      );
      if (next.categoryId === "dark" || next.nsfw) {
        lastEmbed.setColor(DARK);
        if (next.nsfw) {
          lastEmbed.addFields({
            name: "⚠️ NSFW",
            value: "Post marcado +18",
            inline: false,
          });
        }
      }
      categoryId = next.categoryId;
      subOpt = nextSub;

      // Mensaje público en canal de memes: editar ese mensaje
      if (publicMessage) {
        await msg.edit({
          embeds: [lastEmbed],
          components: memeComponents(userId, next.categoryId, next.subreddit),
        });
      } else {
        await interaction.editReply({
          embeds: [lastEmbed],
          components: memeComponents(userId, next.categoryId, next.subreddit),
        });
      }
    } catch {
      const failEmbed = new EmbedBuilder()
        .setColor(AMBER)
        .setTitle("💢 El nexo de Reddit falló")
        .setDescription(
          "No pude traer otro post de imagen. Prueba de nuevo o cambia de categoría.",
        );
      if (publicMessage) {
        await msg
          .edit({
            embeds: [failEmbed],
            components: memeComponents(
              userId,
              nextCat,
              nextSub ?? "SpanishMeme",
            ),
          })
          .catch(() => null);
      } else {
        await interaction
          .editReply({
            embeds: [failEmbed],
            components: memeComponents(
              userId,
              nextCat,
              nextSub ?? "SpanishMeme",
            ),
          })
          .catch(() => null);
      }
    }
  });

  collector.on("end", async (_c, reason) => {
    if (reason === "close") return;
    if (publicMessage) {
      await msg.edit({ components: [] }).catch(() => null);
    } else {
      await interaction.editReply({ components: [] }).catch(() => null);
    }
  });
}

export default command;
