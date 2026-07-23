import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
} from "discord.js";
import { formatDuration, type LoopMode, type Track } from "./types.js";

const PINK = 0xff2d6b;
const CYAN = 0x22d3ee;

export function nowPlayingEmbed(
  client: Client,
  track: Track,
  opts: {
    position: number;
    queueLen: number;
    volume: number;
    loop: LoopMode;
    paused: boolean;
  },
): EmbedBuilder {
  const loopLabel =
    opts.loop === "track" ? "🔂 Track" : opts.loop === "queue" ? "🔁 Queue" : "➡️ Off";

  return new EmbedBuilder()
    .setColor(opts.paused ? 0xf59e0b : PINK)
    .setAuthor({
      name: opts.paused
        ? "⏸ Zero Two Music · Pausado"
        : "🎵 Zero Two Music · Reproduciendo",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle(track.title.slice(0, 250))
    .setURL(track.url)
    .setThumbnail(track.thumbnail)
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
        value: `\`${opts.queueLen}\` en espera · #${opts.position}`,
        inline: true,
      },
      {
        name: "🎧 Pedido por",
        value: `<@${track.requestedBy.id}>`,
        inline: true,
      },
      {
        name: "📡 Fuente",
        value: `\`${track.source}\``,
        inline: true,
      },
    )
    .setFooter({
      text: "Zero Two Music · estilo Jockie · botones abajo",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTimestamp();
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
      ? ["*Cola vacía*"]
      : slice.map((t, i) => {
          const n = (p - 1) * pageSize + i + 1;
          return `**${n}.** [${t.title.slice(0, 60)}](${t.url}) · \`${formatDuration(t.durationSec)}\` · <@${t.requestedBy.id}>`;
        });

  const emb = new EmbedBuilder()
    .setColor(CYAN)
    .setAuthor({
      name: "📋 Zero Two Music · Cola",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setDescription(lines.join("\n").slice(0, 4000))
    .setFooter({
      text: `Página ${p}/${totalPages} · ${queue.length} pista(s)`,
    })
    .setTimestamp();

  if (current) {
    emb.addFields({
      name: "▶️ Ahora",
      value: `[${current.title.slice(0, 80)}](${current.url}) · \`${formatDuration(current.durationSec)}\``,
    });
  }
  return emb;
}

export function musicControls(
  guildId: string,
  paused: boolean,
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:prev:${guildId}`)
      .setEmoji("⏮️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`music:pause:${guildId}`)
      .setEmoji(paused ? "▶️" : "⏸️")
      .setLabel(paused ? "Resume" : "Pause")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`music:skip:${guildId}`)
      .setEmoji("⏭️")
      .setLabel("Skip")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`music:stop:${guildId}`)
      .setEmoji("⏹️")
      .setLabel("Stop")
      .setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`music:loop:${guildId}`)
      .setEmoji("🔁")
      .setLabel("Loop")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:shuffle:${guildId}`)
      .setEmoji("🔀")
      .setLabel("Shuffle")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:queue:${guildId}`)
      .setEmoji("📋")
      .setLabel("Cola")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`music:np:${guildId}`)
      .setEmoji("🎵")
      .setLabel("NP")
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

export function addedToQueueEmbed(
  client: Client,
  track: Track,
  position: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setAuthor({
      name: "➕ Añadido a la cola",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle(track.title.slice(0, 250))
    .setURL(track.url)
    .setThumbnail(track.thumbnail)
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
    )
    .setTimestamp();
}
