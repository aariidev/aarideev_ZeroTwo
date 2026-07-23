import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type AttachmentBuilder,
  type Client,
} from "discord.js";
import { BOT_VERSION } from "../lib/version.js";
import { musicBanner, musicBannerFiles } from "./assets.js";
import { formatDuration, type LoopMode, type Track } from "./types.js";

const PINK = 0xff2d6b;
const CYAN = 0x22d3ee;
const GREEN = 0x22c55e;
const AMBER = 0xf59e0b;
/** Spotify brand-ish green for playlist flow */
const SPOTIFY = 0x1db954;

const SOURCE_LABEL: Record<Track["source"], string> = {
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  spotify: "Spotify → YT",
  url: "URL",
  search: "Búsqueda",
};

const SOURCE_EMOJI: Record<Track["source"], string> = {
  youtube: "▶️",
  soundcloud: "☁️",
  spotify: "💚",
  url: "🔗",
  search: "🔎",
};

/** Apply animated banner as large image; keeps song art as thumbnail. */
function withBanner(embed: EmbedBuilder): EmbedBuilder {
  const { url } = musicBanner();
  if (url) embed.setImage(url);
  return embed;
}

/** Progress bar (visual only; no live seek unless position provided). */
function progressBar(positionSec: number | null, durationSec: number): string {
  const total = 14;
  if (!durationSec || durationSec <= 0) {
    return "`" + "░".repeat(total) + "`  `live / ?:??`";
  }
  const pos =
    positionSec == null
      ? 0
      : Math.min(Math.max(0, positionSec), durationSec);
  const ratio = pos / durationSec;
  const filled = Math.round(ratio * total);
  const head = filled > 0 && filled < total ? "▓" : filled >= total ? "█" : "";
  const solid = Math.max(0, filled - (head ? 1 : 0));
  const bar =
    "█".repeat(solid) +
    head +
    "░".repeat(Math.max(0, total - solid - (head ? 1 : 0)));
  return `\`${bar}\`  \`${formatDuration(pos)} / ${formatDuration(durationSec)}\``;
}

/** Mini bar for playlist load progress (0–1). */
function loadBar(done: number, total: number): string {
  const n = 10;
  if (total <= 0) return "`" + "░".repeat(n) + "`";
  const filled = Math.min(n, Math.round((done / total) * n));
  return (
    "`" +
    "█".repeat(filled) +
    "░".repeat(n - filled) +
    "`" +
    `  \`${done}/${total}\``
  );
}

export function nowPlayingEmbed(
  client: Client,
  track: Track,
  opts: {
    position: number;
    queueLen: number;
    volume: number;
    loop: LoopMode;
    paused: boolean;
    /** Playback position in seconds (optional). */
    playbackSec?: number | null;
    hasHistory?: boolean;
  },
): EmbedBuilder {
  const loopLabel =
    opts.loop === "track"
      ? "🔂 Pista"
      : opts.loop === "queue"
        ? "🔁 Cola"
        : "➡️ Off";

  const statusLine = opts.paused
    ? "⏸ **Pausado**"
    : "▶️ **Reproduciendo ahora**";

  const emb = new EmbedBuilder()
    .setColor(opts.paused ? AMBER : PINK)
    .setAuthor({
      name: opts.paused
        ? "Zero Two Music · Pausado"
        : "Zero Two Music · En directo",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle(track.title.slice(0, 250))
    .setURL(track.url)
    .setDescription(
      [
        statusLine,
        "",
        progressBar(opts.playbackSec ?? 0, track.durationSec),
      ].join("\n"),
    )
    .addFields(
      {
        name: "⏱️ Duración",
        value: `\`${formatDuration(track.durationSec)}\``,
        inline: true,
      },
      {
        name: "🔊 Volumen",
        value: `\`${opts.volume}%\``,
        inline: true,
      },
      {
        name: "🔁 Loop",
        value: loopLabel,
        inline: true,
      },
      {
        name: "📋 Cola",
        value: `\`${opts.queueLen}\` en espera · **#${opts.position}**`,
        inline: true,
      },
      {
        name: "🎧 Pedido por",
        value: `<@${track.requestedBy.id}>`,
        inline: true,
      },
      {
        name: "📡 Fuente",
        value: `${SOURCE_EMOJI[track.source] ?? "📡"} \`${SOURCE_LABEL[track.source] ?? track.source}\``,
        inline: true,
      },
    )
    .setFooter({
      text:
        track.source === "spotify"
          ? "Zero Two Music · Spotify → YouTube · botones ↓"
          : "Zero Two Music · usa los botones de abajo",
      iconURL:
        track.requestedBy.avatarURL ??
        client.user?.displayAvatarURL() ??
        undefined,
    })
    .setTimestamp();

  if (track.thumbnail) {
    emb.setThumbnail(track.thumbnail);
  }
  if (track.spotifyUrl) {
    emb.addFields({
      name: "💚 Spotify",
      value: `[Abrir en Spotify](${track.spotifyUrl})`,
      inline: false,
    });
  }

  return withBanner(emb);
}

/**
 * Embeds del flujo progressive Spotify (loading → first → complete).
 * Verde Spotify + banner Zero Two.
 */
export function spotifyLoadingEmbed(
  client: Client,
  phase: "reading" | "mirrors",
): EmbedBuilder {
  const emb = new EmbedBuilder()
    .setColor(SPOTIFY)
    .setAuthor({
      name: "Zero Two Music · Spotify",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle(
      phase === "reading"
        ? "💚 Escaneando playlist…"
        : "🔎 Buscando mirrors en YouTube…",
    )
    .setDescription(
      phase === "reading"
        ? [
            "Leyendo pistas desde el **embed público** de Spotify.",
            "Sin OAuth, sin drama — solo listo para el mirror.",
            "",
            "*Un momento, darling…*",
          ].join("\n")
        : [
            "Conectando cada pista con un mirror de **YouTube**.",
            "La primera suena enseguida; el resto entra en cola en paralelo.",
          ].join("\n"),
    )
    .setFooter({
      text: `Zero Two Music · ${BOT_VERSION} · Spotify progressive`,
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTimestamp();
  return withBanner(emb);
}

export function spotifyPlaylistBootEmbed(
  client: Client,
  first: Track,
  opts: {
    totalItems: number;
    remaining: number;
    volume: number;
    loop: LoopMode;
    queueLen: number;
  },
): EmbedBuilder {
  const emb = new EmbedBuilder()
    .setColor(SPOTIFY)
    .setAuthor({
      name: "Zero Two Music · Playlist Spotify",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle("▶️ Ya suena · cargando el resto")
    .setURL(first.url)
    .setDescription(
      [
        `**[${first.title.slice(0, 100)}](${first.url})**`,
        progressBar(0, first.durationSec),
        "",
        loadBar(1, opts.totalItems),
        "",
        `Resolviendo **${opts.remaining}** pistas más en segundo plano…`,
        "Puedes saltar, pausar o mezclar mientras cargo el resto.",
      ].join("\n"),
    )
    .addFields(
      {
        name: "📜 Playlist",
        value: `\`${opts.totalItems}\` pistas en Spotify`,
        inline: true,
      },
      {
        name: "📋 Cola",
        value: `\`${opts.queueLen}\` en espera`,
        inline: true,
      },
      {
        name: "🔊 Vol",
        value: `\`${opts.volume}%\``,
        inline: true,
      },
      {
        name: "🎧 Pedido por",
        value: `<@${first.requestedBy.id}>`,
        inline: true,
      },
      {
        name: "📡 Fuente",
        value: "💚 `Spotify → YT`",
        inline: true,
      },
      {
        name: "🔁 Loop",
        value:
          opts.loop === "track"
            ? "🔂 Pista"
            : opts.loop === "queue"
              ? "🔁 Cola"
              : "➡️ Off",
        inline: true,
      },
    )
    .setFooter({
      text: `Zero Two Music · ${BOT_VERSION} · progressive load`,
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTimestamp();

  if (first.thumbnail) emb.setThumbnail(first.thumbnail);
  return withBanner(emb);
}

export function spotifyPlaylistReadyEmbed(
  client: Client,
  opts: {
    resolved: number;
    totalItems: number;
    queueLen: number;
    firstTitle?: string;
  },
): EmbedBuilder {
  const missed = Math.max(0, opts.totalItems - opts.resolved);
  const emb = new EmbedBuilder()
    .setColor(SPOTIFY)
    .setAuthor({
      name: "Zero Two Music · Playlist lista",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle("📜 Playlist de Spotify en cola")
    .setDescription(
      [
        loadBar(opts.resolved, opts.totalItems),
        "",
        `**${opts.resolved}** mirrors listos de **${opts.totalItems}** pistas.`,
        opts.firstTitle
          ? `Primera: \`${opts.firstTitle.slice(0, 80)}\``
          : null,
        missed > 0
          ? `⚠️ \`${missed}\` sin mirror en YouTube (omitidas).`
          : "✨ Todas las pistas encontraron mirror.",
        "",
        "Controla con el **panel** o los botones de abajo.",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .addFields(
      {
        name: "✅ Resueltas",
        value: `\`${opts.resolved}\``,
        inline: true,
      },
      {
        name: "📋 En cola ahora",
        value: `\`${opts.queueLen}\``,
        inline: true,
      },
      {
        name: "💚 Origen",
        value: "`Spotify embed → YT`",
        inline: true,
      },
    )
    .setFooter({
      text: `Zero Two Music · ${BOT_VERSION} · mix cargada`,
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTimestamp();
  return withBanner(emb);
}

export function queueEmbed(
  client: Client,
  current: Track | null,
  queue: Track[],
  page: number,
  pageSize = 10,
): EmbedBuilder {
  const { embed } = buildQueuePage(client, current, queue, page, pageSize);
  return embed;
}

/** Embed + meta de página (para botones de paginación). */
export function buildQueuePage(
  client: Client,
  current: Track | null,
  queue: Track[],
  page: number,
  pageSize = 10,
): { embed: EmbedBuilder; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(queue.length / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const slice = queue.slice((p - 1) * pageSize, p * pageSize);

  const lines =
    slice.length === 0
      ? ["*Cola vacía — usa `/play` para añadir pistas.*"]
      : slice.map((t, i) => {
          const n = (p - 1) * pageSize + i + 1;
          return `**${n}.** [${t.title.slice(0, 55)}](${t.url}) · \`${formatDuration(t.durationSec)}\` · <@${t.requestedBy.id}>`;
        });

  const emb = new EmbedBuilder()
    .setColor(CYAN)
    .setAuthor({
      name: "Zero Two Music · Cola de reproducción",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setDescription(lines.join("\n").slice(0, 3900))
    .setFooter({
      text: `Página ${p}/${totalPages} · ${queue.length} pista(s) en cola`,
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTimestamp();

  if (current) {
    emb.addFields({
      name: "▶️ Sonando ahora",
      value: `[${current.title.slice(0, 80)}](${current.url}) · \`${formatDuration(current.durationSec)}\` · <@${current.requestedBy.id}>`,
    });
    if (current.thumbnail) emb.setThumbnail(current.thumbnail);
  }

  return { embed: withBanner(emb), page: p, totalPages };
}

/** Botones ◀️ ▶️ cuando hay más de una página. customId: music:qpage:guildId:page */
export function queuePageButtons(
  guildId: string,
  page: number,
  totalPages: number,
): ActionRowBuilder<ButtonBuilder>[] {
  if (totalPages <= 1) return [];

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:qpage:${guildId}:${page - 1}`)
      .setEmoji("◀️")
      .setLabel("Anterior")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`music:qinfo:${guildId}:${page}`)
      .setLabel(`${page} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`music:qpage:${guildId}:${page + 1}`)
      .setEmoji("▶️")
      .setLabel("Siguiente")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
  );
  return [row];
}

export function musicControls(
  guildId: string,
  paused: boolean,
  hasHistory = false,
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:prev:${guildId}`)
      .setEmoji("⏮️")
      .setLabel("Anterior")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasHistory),
    new ButtonBuilder()
      .setCustomId(`music:pause:${guildId}`)
      .setEmoji(paused ? "▶️" : "⏸️")
      .setLabel(paused ? "Reanudar" : "Pausa")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`music:skip:${guildId}`)
      .setEmoji("⏭️")
      .setLabel("Saltar")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`music:stop:${guildId}`)
      .setEmoji("⏹️")
      .setLabel("Parar")
      .setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:voldown:${guildId}`)
      .setEmoji("🔉")
      .setLabel("-10")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:volup:${guildId}`)
      .setEmoji("🔊")
      .setLabel("+10")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:loop:${guildId}`)
      .setEmoji("🔁")
      .setLabel("Loop")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:shuffle:${guildId}`)
      .setEmoji("🔀")
      .setLabel("Mezclar")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:queue:${guildId}`)
      .setEmoji("📋")
      .setLabel("Cola")
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

/**
 * Controles del panel persistente del servidor.
 * @param hasSavedSession — show Continuar after bot restart
 * @param isLive — session actively playing (vs only saved)
 */
export function musicPanelControls(
  guildId: string,
  paused: boolean,
  hasHistory = false,
  opts?: { hasSavedSession?: boolean; isLive?: boolean },
): ActionRowBuilder<ButtonBuilder>[] {
  const isLive = opts?.isLive !== false;
  const hasSaved = Boolean(opts?.hasSavedSession);

  // Idle panel with a snapshot waiting to resume
  if (!isLive && hasSaved) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`music:continue:${guildId}`)
          .setEmoji("▶️")
          .setLabel("Continuar sesión")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`music:add:${guildId}`)
          .setEmoji("➕")
          .setLabel("Añadir")
          .setStyle(ButtonStyle.Primary),
      ),
    ];
  }

  const row0 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:add:${guildId}`)
      .setEmoji("➕")
      .setLabel("Añadir")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`music:prev:${guildId}`)
      .setEmoji("⏮️")
      .setLabel("Anterior")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasHistory),
    new ButtonBuilder()
      .setCustomId(`music:pause:${guildId}`)
      .setEmoji(paused ? "▶️" : "⏸️")
      .setLabel(paused ? "Reanudar" : "Pausa")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`music:skip:${guildId}`)
      .setEmoji("⏭️")
      .setLabel("Saltar")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`music:stop:${guildId}`)
      .setEmoji("⏹️")
      .setLabel("Parar")
      .setStyle(ButtonStyle.Danger),
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:voldown:${guildId}`)
      .setEmoji("🔉")
      .setLabel("-10")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:volup:${guildId}`)
      .setEmoji("🔊")
      .setLabel("+10")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:loop:${guildId}`)
      .setEmoji("🔁")
      .setLabel("Loop")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:shuffle:${guildId}`)
      .setEmoji("🔀")
      .setLabel("Mezclar")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:queue:${guildId}`)
      .setEmoji("📋")
      .setLabel("Cola")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2Buttons = [
    new ButtonBuilder()
      .setCustomId(`music:clear:${guildId}`)
      .setEmoji("🗑️")
      .setLabel("Vaciar cola")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:leave:${guildId}`)
      .setEmoji("🚪")
      .setLabel("Salir")
      .setStyle(ButtonStyle.Secondary),
  ];
  if (hasSaved && isLive) {
    // rarely both — keep continue available only when not live
  }
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...row2Buttons,
  );

  return [row0, row1, row2];
}

/** Embed del panel fijo (estado en vivo + banner). */
export function musicPanelEmbed(
  client: Client,
  opts: {
    current: Track | null;
    queueLen: number;
    volume: number;
    loop: LoopMode;
    paused: boolean;
    voiceChannelId: string | null;
    playbackSec?: number | null;
    hasHistory?: boolean;
    djRoleId?: string | null;
    /** Snapshot waiting after bot restart */
    savedSession?: {
      title: string;
      queueLen: number;
      playbackSec: number;
      voiceChannelId: string | null;
    } | null;
  },
): EmbedBuilder {
  const loopLabel =
    opts.loop === "track"
      ? "🔂 Pista"
      : opts.loop === "queue"
        ? "🔁 Cola"
        : "➡️ Off";

  const saved = opts.savedSession;
  const emb = new EmbedBuilder()
    .setColor(
      opts.current
        ? opts.paused
          ? AMBER
          : PINK
        : saved
          ? AMBER
          : CYAN,
    )
    .setAuthor({
      name: "Zero Two Music · Panel del servidor",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle(
      opts.current
        ? opts.paused
          ? "⏸ Pausado"
          : "🎵 Reproduciendo"
        : saved
          ? "💾 Sesión guardada"
          : "🎧 Panel de música",
    )
    .setDescription(
      opts.current
        ? [
            `**[${opts.current.title.slice(0, 120)}](${opts.current.url})**`,
            progressBar(opts.playbackSec ?? 0, opts.current.durationSec),
            "",
            `Pedido por <@${opts.current.requestedBy.id}> · \`${SOURCE_LABEL[opts.current.source] ?? opts.current.source}\``,
          ].join("\n")
        : saved
          ? [
              "El bot se reinició con una sesión de música activa.",
              "",
              `**Última pista:** ${saved.title.slice(0, 100)}`,
              saved.playbackSec > 0
                ? `**Posición:** \`${formatDuration(saved.playbackSec)}\``
                : null,
              `**Cola guardada:** \`${saved.queueLen}\` pista(s)`,
              saved.voiceChannelId
                ? `**Canal:** <#${saved.voiceChannelId}>`
                : null,
              "",
              "Pulsa **Continuar sesión** o usa `/continue`.",
            ]
              .filter(Boolean)
              .join("\n")
          : [
              "No hay nada en reproducción.",
              "",
              "• Entra a un **canal de voz**",
              "• Pulsa **Añadir** o usa `/play`",
              "• Controla todo desde este panel",
            ].join("\n"),
    )
    .addFields(
      {
        name: "📋 Cola",
        value: `\`${opts.queueLen}\` en espera`,
        inline: true,
      },
      {
        name: "🔊 Volumen",
        value: `\`${opts.volume}%\``,
        inline: true,
      },
      {
        name: "🔁 Loop",
        value: loopLabel,
        inline: true,
      },
      {
        name: "🎙️ Voz",
        value: opts.voiceChannelId
          ? `<#${opts.voiceChannelId}>`
          : "`desconectado`",
        inline: true,
      },
      {
        name: "⏮️ Historial",
        value: opts.hasHistory ? "`disponible`" : "`vacío`",
        inline: true,
      },
      {
        name: "🎚️ DJ",
        value: opts.djRoleId ? `<@&${opts.djRoleId}>` : "`cualquiera en voz`",
        inline: true,
      },
    )
    .setFooter({
      text: "Panel fijo · progreso ~cada 12s · rol DJ opcional",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTimestamp();

  if (opts.current?.thumbnail) {
    emb.setThumbnail(opts.current.thumbnail);
  }

  return withBanner(emb);
}

export function addedToQueueEmbed(
  client: Client,
  track: Track,
  position: number,
): EmbedBuilder {
  const emb = new EmbedBuilder()
    .setColor(GREEN)
    .setAuthor({
      name: "Zero Two Music · Añadido a la cola",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle(track.title.slice(0, 250))
    .setURL(track.url)
    .setDescription(
      `La pista entrará en **#${position}**. Mientras tanto, disfruta de lo que suena.`,
    )
    .addFields(
      {
        name: "⏱️ Duración",
        value: `\`${formatDuration(track.durationSec)}\``,
        inline: true,
      },
      {
        name: "📍 Posición",
        value: `\`#${position}\``,
        inline: true,
      },
      {
        name: "🎧 Por",
        value: `<@${track.requestedBy.id}>`,
        inline: true,
      },
      {
        name: "📡 Fuente",
        value: `${SOURCE_EMOJI[track.source] ?? "📡"} \`${SOURCE_LABEL[track.source] ?? track.source}\``,
        inline: true,
      },
    )
    .setFooter({
      text: `Zero Two Music · ${BOT_VERSION}`,
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTimestamp();

  if (track.thumbnail) emb.setThumbnail(track.thumbnail);
  return withBanner(emb);
}

export function stoppedEmbed(client?: Client): EmbedBuilder {
  const emb = new EmbedBuilder()
    .setColor(PINK)
    .setAuthor({
      name: "Zero Two Music · Detenido",
      iconURL: client?.user?.displayAvatarURL() ?? undefined,
    })
    .setDescription("⏹️ Reproducción detenida y cola vaciada.")
    .setFooter({ text: "Zero Two Music" })
    .setTimestamp();
  return withBanner(emb);
}

export function idleQueueEmbed(client?: Client): EmbedBuilder {
  const emb = new EmbedBuilder()
    .setColor(CYAN)
    .setAuthor({
      name: "Zero Two Music · Cola vacía",
      iconURL: client?.user?.displayAvatarURL() ?? undefined,
    })
    .setDescription(
      "📭 No hay más pistas en la cola.\n\nUsa **`/play`** para seguir escuchando o **`/leave`** para desconectar el bot.",
    )
    .setFooter({ text: "Zero Two Music" })
    .setTimestamp();
  return withBanner(emb);
}

export type MusicNoticeKind = "error" | "ok" | "info" | "warn";

const NOTICE_COLOR: Record<MusicNoticeKind, number> = {
  error: 0xef4444,
  ok: GREEN,
  info: CYAN,
  warn: AMBER,
};

const NOTICE_TITLE: Record<MusicNoticeKind, string> = {
  error: "Zero Two Music · Error",
  ok: "Zero Two Music",
  info: "Zero Two Music",
  warn: "Zero Two Music · Aviso",
};

/**
 * Embed genérico para errores, avisos y estados (todo el sistema de música).
 * `banner: true` adjunta el GIF grande (éxitos / info pública).
 */
export function musicNoticeEmbed(
  description: string,
  opts?: {
    title?: string;
    kind?: MusicNoticeKind;
    client?: Client;
    banner?: boolean;
  },
): EmbedBuilder {
  const kind = opts?.kind ?? "info";
  const emb = new EmbedBuilder()
    .setColor(NOTICE_COLOR[kind])
    .setAuthor({
      name: opts?.title ?? NOTICE_TITLE[kind],
      iconURL: opts?.client?.user?.displayAvatarURL() ?? undefined,
    })
    .setDescription(description)
    .setFooter({ text: "Zero Two Music" })
    .setTimestamp();

  return opts?.banner ? withBanner(emb) : emb;
}

/** Payload listo para reply/edit/send con embed (+ banner opcional). */
export function musicNoticePayload(
  description: string,
  opts?: {
    title?: string;
    kind?: MusicNoticeKind;
    client?: Client;
    banner?: boolean;
    ephemeral?: boolean;
  },
): {
  embeds: EmbedBuilder[];
  files?: AttachmentBuilder[];
  flags?: number;
  ephemeral?: boolean;
} {
  const banner = opts?.banner === true;
  const embed = musicNoticeEmbed(description, {
    title: opts?.title,
    kind: opts?.kind,
    client: opts?.client,
    banner,
  });
  const files = banner ? musicBannerFiles() : [];
  return {
    embeds: [embed],
    ...(files.length ? { files } : {}),
    ...(opts?.ephemeral ? { ephemeral: true } : {}),
  };
}

/** Convenience: files to attach whenever a music embed with banner is sent. */
export function musicEmbedFiles(): AttachmentBuilder[] {
  return musicBannerFiles();
}
