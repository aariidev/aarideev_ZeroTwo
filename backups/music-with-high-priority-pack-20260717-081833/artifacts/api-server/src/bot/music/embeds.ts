import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type AttachmentBuilder,
  type Client,
} from "discord.js";
import { musicBanner, musicBannerFiles } from "./assets.js";
import { formatDuration, type LoopMode, type Track } from "./types.js";

const PINK = 0xff2d6b;
const CYAN = 0x22d3ee;
const GREEN = 0x22c55e;
const AMBER = 0xf59e0b;

const SOURCE_LABEL: Record<Track["source"], string> = {
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  url: "URL",
  search: "Búsqueda",
};

/** Apply animated banner as large image; keeps song art as thumbnail. */
function withBanner(embed: EmbedBuilder): EmbedBuilder {
  const { url } = musicBanner();
  if (url) embed.setImage(url);
  return embed;
}

/** Progress bar (visual only; no live seek unless position provided). */
function progressBar(positionSec: number | null, durationSec: number): string {
  const total = 12;
  if (!durationSec || durationSec <= 0) {
    return "`" + "░".repeat(total) + "`  `?:??`";
  }
  const pos =
    positionSec == null
      ? 0
      : Math.min(Math.max(0, positionSec), durationSec);
  const ratio = pos / durationSec;
  const filled = Math.round(ratio * total);
  const bar =
    "█".repeat(Math.min(filled, total)) +
    "░".repeat(Math.max(0, total - filled));
  return `\`${bar}\`  \`${formatDuration(pos)} / ${formatDuration(durationSec)}\``;
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
        value: `\`${SOURCE_LABEL[track.source] ?? track.source}\``,
        inline: true,
      },
    )
    .setFooter({
      text: "Zero Two Music · usa los botones de abajo",
      iconURL:
        track.requestedBy.avatarURL ??
        client.user?.displayAvatarURL() ??
        undefined,
    })
    .setTimestamp();

  if (track.thumbnail) {
    emb.setThumbnail(track.thumbnail);
  }

  return withBanner(emb);
}

export function queueEmbed(
  client: Client,
  current: Track | null,
  queue: Track[],
  page: number,
  pageSize = 10,
): EmbedBuilder {
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

  return withBanner(emb);
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
 */
export function musicPanelControls(
  guildId: string,
  paused: boolean,
  hasHistory = false,
): ActionRowBuilder<ButtonBuilder>[] {
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

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
  },
): EmbedBuilder {
  const loopLabel =
    opts.loop === "track"
      ? "🔂 Pista"
      : opts.loop === "queue"
        ? "🔁 Cola"
        : "➡️ Off";

  const emb = new EmbedBuilder()
    .setColor(opts.current ? (opts.paused ? AMBER : PINK) : CYAN)
    .setAuthor({
      name: "Zero Two Music · Panel del servidor",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle(
      opts.current
        ? opts.paused
          ? "⏸ Pausado"
          : "🎵 Reproduciendo"
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
        value: `\`${SOURCE_LABEL[track.source] ?? track.source}\``,
        inline: true,
      },
    )
    .setFooter({
      text: "Zero Two Music",
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
