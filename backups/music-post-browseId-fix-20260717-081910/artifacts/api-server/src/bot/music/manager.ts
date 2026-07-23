/**
 * Zero Two Music — guild queues (Jockie-style).
 * Uses @discordjs/voice + play-dl for YouTube/search streaming.
 */
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
} from "@discordjs/voice";
import {
  ChannelType,
  Client,
  EmbedBuilder,
  GuildMember,
  TextChannel,
  VoiceBasedChannel,
} from "discord.js";
import play from "play-dl";
import ffmpegPath from "ffmpeg-static";
import { logger } from "../../lib/logger.js";
import {
  idleQueueEmbed,
  musicControls,
  musicEmbedFiles,
  musicNoticeEmbed,
  nowPlayingEmbed,
} from "./embeds.js";
import { type LoopMode, type Track } from "./types.js";
import {
  createTrackResource,
  ytdlpSearchUrl,
  ytdlpSearchMeta,
  getStreamDiagnostics,
} from "./stream.js";

// Ensure ffmpeg is discoverable by @discordjs/voice / prism
if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
  process.env.FFMPEG_BIN = ffmpegPath;
}

const HISTORY_MAX = 25;
const PROGRESS_TICK_MS = 12_000;

export class GuildMusicSession {
  readonly guildId: string;
  queue: Track[] = [];
  current: Track | null = null;
  /** Recently played tracks (most recent at the end). */
  history: Track[] = [];
  volume = 80;
  loop: LoopMode = "off";
  textChannelId: string | null = null;
  voiceChannelId: string | null = null;
  private player: AudioPlayer;
  private connection: VoiceConnection | null = null;
  private resource: AudioResource | null = null;
  private streamKill: (() => void) | null = null;
  private destroyed = false;
  /** Avoid double-advance on idle */
  private advancing = false;
  /** Skip idle handler (previous / internal restarts) */
  private suppressIdleAdvance = false;
  /** First track of a /play is announced by the slash reply */
  suppressNextAnnounce = false;
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    guildId: string,
    private client: Client,
  ) {
    this.guildId = guildId;
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      void this.onTrackEnd();
    });

    this.player.on("error", (err) => {
      // EPIPE / stream destroy while skipping is expected — don't spam as crash
      const msg = err?.message ?? String(err);
      if (/EPIPE|PREMATURE_CLOSE|ECONNRESET/i.test(msg)) {
        logger.warn({ guildId, msg }, "music:player stream closed");
      } else {
        logger.error({ err, guildId }, "music:player error");
      }
      void this.onTrackEnd(true);
    });
  }

  get paused(): boolean {
    return this.player.state.status === AudioPlayerStatus.Paused;
  }

  get playing(): boolean {
    return (
      this.player.state.status === AudioPlayerStatus.Playing ||
      this.player.state.status === AudioPlayerStatus.Buffering
    );
  }

  /** Playback position in seconds (from @discordjs/voice resource). */
  get playbackSec(): number {
    const ms = this.resource?.playbackDuration ?? 0;
    return Math.max(0, Math.floor(ms / 1000));
  }

  get hasHistory(): boolean {
    return this.history.length > 0;
  }

  private pushHistory(track: Track): void {
    this.history.push(track);
    while (this.history.length > HISTORY_MAX) this.history.shift();
  }

  private startProgressTicker(): void {
    this.stopProgressTicker();
    this.progressTimer = setInterval(() => {
      if (this.destroyed || !this.current || this.paused) return;
      void this.refreshPanel();
    }, PROGRESS_TICK_MS);
  }

  private stopProgressTicker(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  connect(channel: VoiceBasedChannel): VoiceConnection {
    this.voiceChannelId = channel.id;
    const existing = getVoiceConnection(this.guildId);
    if (existing) {
      this.connection = existing;
      existing.subscribe(this.player);
      return existing;
    }

    const conn = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    conn.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(conn, VoiceConnectionStatus.Signalling, 5_000),
          entersState(conn, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });

    conn.subscribe(this.player);
    this.connection = conn;
    return conn;
  }

  async enqueue(tracks: Track[], textChannelId: string): Promise<number> {
    this.textChannelId = textChannelId;
    const wasEmpty = !this.current && this.queue.length === 0;
    this.queue.push(...tracks);
    if (wasEmpty && !this.playing) {
      await this.playNext();
    }
    return this.queue.length + (this.current ? 1 : 0);
  }

  async playNext(force = false): Promise<void> {
    if (this.destroyed) return;
    this.advancing = false;

    if (!force && this.loop === "track" && this.current) {
      await this.playTrack(this.current);
      return;
    }

    // Leave current track → history (+ queue if loop queue)
    if (this.current) {
      if (this.loop === "queue") {
        this.queue.push(this.current);
      }
      this.pushHistory(this.current);
    }

    const next = this.queue.shift() ?? null;
    this.current = next;
    if (!next) {
      this.stopProgressTicker();
      this.suppressIdleAdvance = true;
      try {
        this.player.stop(true);
      } catch {
        /* */
      }
      this.suppressIdleAdvance = false;
      await this.announceIdle();
      return;
    }

    await this.playTrack(next);
  }

  /**
   * Go back one track from history. Current goes to front of queue.
   */
  async previous(): Promise<boolean> {
    if (this.history.length === 0) return false;

    const prev = this.history.pop()!;
    if (this.current) {
      this.queue.unshift(this.current);
    }

    this.suppressIdleAdvance = true;
    try {
      this.streamKill?.();
    } catch {
      /* */
    }
    this.streamKill = null;
    try {
      this.player.stop(true);
    } catch {
      /* */
    }
    this.suppressIdleAdvance = false;

    this.current = prev;
    await this.playTrack(prev);
    return true;
  }

  private async playTrack(track: Track): Promise<void> {
    // Kill previous yt-dlp process
    try {
      this.streamKill?.();
    } catch {
      /* */
    }
    this.streamKill = null;

    try {
      // Ensure we have a real watch URL (not undefined / bad)
      let url = track.url;
      if (!url || url === "undefined" || !/^https?:\/\//i.test(url)) {
        const found =
          (await ytdlpSearchUrl(track.title)) ||
          (await play.search(track.title, { limit: 1 }).then((r) => r[0]?.url));
        if (!found) throw new Error("URL de vídeo inválida y búsqueda falló");
        url = found;
        track.url = found;
      }

      let handle;
      try {
        handle = await createTrackResource(url, this.volume);
      } catch (firstErr) {
        // Refresh URL via yt-dlp search and retry once
        logger.warn({ firstErr, url }, "music: stream retry via search");
        const alt = await ytdlpSearchUrl(track.title);
        if (!alt) throw firstErr;
        track.url = alt;
        handle = await createTrackResource(alt, this.volume);
      }

      this.streamKill = handle.kill;
      this.resource = handle.resource;
      this.player.play(handle.resource);
      this.startProgressTicker();

      if (this.connection) {
        await entersState(
          this.connection,
          VoiceConnectionStatus.Ready,
          15_000,
        ).catch(() => null);
      }

      if (this.suppressNextAnnounce) {
        this.suppressNextAnnounce = false;
        void this.refreshPanel();
      } else {
        await this.announceNowPlaying();
      }
    } catch (err) {
      logger.error({ err, title: track.title }, "music:playTrack failed");
      const diag = getStreamDiagnostics();
      const hint = !diag.cookies
        ? " (exporta cookies Netscape de youtube.com → H:\\Discord\\02\\cookies.txt)"
        : "";
      await this.sendEmbed(
        musicNoticeEmbed(
          `❌ No se pudo reproducir **${track.title.slice(0, 80)}**.${hint}\n\nSaltando a la siguiente…`,
          { kind: "error", client: this.client, banner: true },
        ),
        true,
      );
      await this.playNext(true);
    }
  }

  private async onTrackEnd(error = false): Promise<void> {
    if (this.suppressIdleAdvance || this.advancing || this.destroyed) return;
    this.advancing = true;
    // Always tear down yt-dlp/ffmpeg so pipes don't throw EPIPE
    try {
      this.streamKill?.();
    } catch {
      /* */
    }
    this.streamKill = null;
    if (error) {
      await this.playNext(true);
      return;
    }
    await this.playNext(false);
  }

  skip(): boolean {
    if (!this.current && this.queue.length === 0) return false;
    try {
      this.streamKill?.();
    } catch {
      /* */
    }
    this.streamKill = null;
    this.player.stop(true);
    return true;
  }

  stop(): void {
    this.queue = [];
    this.current = null;
    this.history = [];
    this.loop = "off";
    this.stopProgressTicker();
    this.suppressIdleAdvance = true;
    try {
      this.streamKill?.();
    } catch {
      /* */
    }
    this.streamKill = null;
    try {
      this.player.stop(true);
    } catch {
      /* */
    }
    this.suppressIdleAdvance = false;
    void this.refreshPanel();
  }

  pause(): boolean {
    const ok = this.player.pause(true);
    void this.refreshPanel();
    return ok;
  }

  resume(): boolean {
    const ok = this.player.unpause();
    void this.refreshPanel();
    return ok;
  }

  setVolume(v: number): number {
    this.volume = Math.max(0, Math.min(150, Math.floor(v)));
    // resource volume is 0–1; allow boost up to 1.5 mapped as min(1.5, vol/100) but discordjs caps often at 1
    this.resource?.volume?.setVolume(Math.min(1.5, this.volume / 100));
    void this.refreshPanel();
    return this.volume;
  }

  adjustVolume(delta: number): number {
    return this.setVolume(this.volume + delta);
  }

  cycleLoop(): LoopMode {
    this.loop =
      this.loop === "off" ? "track" : this.loop === "track" ? "queue" : "off";
    return this.loop;
  }

  shuffle(): number {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j]!, this.queue[i]!];
    }
    return this.queue.length;
  }

  remove(index: number): Track | null {
    if (index < 1 || index > this.queue.length) return null;
    return this.queue.splice(index - 1, 1)[0] ?? null;
  }

  clearQueue(): number {
    const n = this.queue.length;
    this.queue = [];
    return n;
  }

  destroy(): void {
    this.destroyed = true;
    this.queue = [];
    this.current = null;
    this.history = [];
    this.voiceChannelId = null;
    this.stopProgressTicker();
    this.suppressIdleAdvance = true;
    try {
      this.streamKill?.();
    } catch {
      /* */
    }
    this.streamKill = null;
    try {
      this.player.stop(true);
    } catch {
      /* */
    }
    try {
      this.connection?.destroy();
    } catch {
      /* */
    }
    this.connection = null;
    musicManager.drop(this.guildId);
    void this.refreshPanel();
  }

  private async refreshPanel(): Promise<void> {
    try {
      const { schedulePanelRefresh } = await import("./panel.js");
      schedulePanelRefresh(this.client, this.guildId);
    } catch {
      /* panel optional */
    }
  }

  private async announceNowPlaying(): Promise<void> {
    // Always keep the fixed server panel in sync when configured
    await this.refreshPanel();

    // If a music panel channel is active, skip spamming the play channel
    try {
      const { hasActiveMusicPanel } = await import("./panelStore.js");
      if (await hasActiveMusicPanel(this.guildId)) return;
    } catch {
      /* continue with channel announce */
    }

    if (!this.current || !this.textChannelId) return;
    const ch = await this.client.channels
      .fetch(this.textChannelId)
      .catch(() => null);
    if (!ch || !ch.isTextBased()) return;

    const embed = nowPlayingEmbed(this.client, this.current, {
      position: 1,
      queueLen: this.queue.length,
      volume: this.volume,
      loop: this.loop,
      paused: this.paused,
      playbackSec: this.playbackSec,
      hasHistory: this.hasHistory,
    });
    const rows = musicControls(this.guildId, this.paused, this.hasHistory);
    const files = musicEmbedFiles();
    await (ch as TextChannel)
      .send({
        embeds: [embed],
        components: rows,
        files: files.length ? files : undefined,
      })
      .catch(() => null);
  }

  private async announceIdle(): Promise<void> {
    await this.refreshPanel();
    try {
      const { hasActiveMusicPanel } = await import("./panelStore.js");
      if (await hasActiveMusicPanel(this.guildId)) return;
    } catch {
      /* fall through */
    }
    await this.sendEmbed(idleQueueEmbed(this.client), true);
  }

  private async sendEmbed(
    embed: EmbedBuilder,
    withBanner = false,
  ): Promise<void> {
    if (!this.textChannelId) return;
    const ch = await this.client.channels
      .fetch(this.textChannelId)
      .catch(() => null);
    if (!ch || !ch.isTextBased()) return;
    const files = withBanner ? musicEmbedFiles() : [];
    await (ch as TextChannel)
      .send({
        embeds: [embed],
        files: files.length ? files : undefined,
      })
      .catch(() => null);
  }
}

class MusicManager {
  private sessions = new Map<string, GuildMusicSession>();

  get(guildId: string): GuildMusicSession | undefined {
    return this.sessions.get(guildId);
  }

  getOrCreate(guildId: string, client: Client): GuildMusicSession {
    let s = this.sessions.get(guildId);
    if (!s) {
      s = new GuildMusicSession(guildId, client);
      this.sessions.set(guildId, s);
    }
    return s;
  }

  drop(guildId: string): void {
    this.sessions.delete(guildId);
  }
}

export const musicManager = new MusicManager();

type Requester = Track["requestedBy"];

/**
 * YouTube search — prefer yt-dlp (stable). play-dl often throws
 * "Cannot read properties of undefined (reading 'browseId')" when YT changes.
 */
async function youtubeSearchOne(
  query: string,
  requester: Requester,
  source: Track["source"] = "search",
  spotifyUrl?: string,
): Promise<Track | null> {
  // 1) yt-dlp first
  try {
    const meta = await ytdlpSearchMeta(query);
    if (meta?.url) {
      return {
        title: meta.title,
        url: meta.url,
        durationSec: meta.durationSec,
        thumbnail: meta.thumbnail,
        requestedBy: requester,
        source,
        spotifyUrl,
      };
    }
  } catch (err) {
    logger.warn({ err, query }, "music: ytdlp search failed");
  }

  // 2) play-dl fallback (may break with innertube / browseId)
  try {
    const results = await play.search(query, {
      limit: 1,
      source: { youtube: "video" },
    });
    const v = results[0];
    if (v?.url) {
      return {
        title: v.title ?? query,
        url: v.url,
        durationSec: v.durationInSec ?? 0,
        thumbnail: v.thumbnails?.[0]?.url ?? null,
        requestedBy: requester,
        source,
        spotifyUrl,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ msg, query }, "music: play-dl search failed");
    if (/browseId/i.test(msg)) {
      // last chance: plain id print via ytdlp again without meta format
      const url = await ytdlpSearchUrl(query);
      if (url) {
        return {
          title: query,
          url,
          durationSec: 0,
          thumbnail: null,
          requestedBy: requester,
          source,
          spotifyUrl,
        };
      }
    }
  }

  return null;
}

async function resolveSpotifyViaOEmbed(
  url: string,
  requester: Requester,
): Promise<Track[]> {
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  const res = await fetch(oembedUrl, {
    headers: { "User-Agent": "ZeroTwoBot/2.3" },
    signal: AbortSignal.timeout(8_000),
  });
  const text = await res.text();
  let data: { title?: string; thumbnail_url?: string };
  try {
    data = JSON.parse(text) as { title?: string; thumbnail_url?: string };
  } catch {
    throw new Error(`oEmbed inválido (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(`oEmbed HTTP ${res.status}`);
  const title = data.title?.trim();
  if (!title) throw new Error("oEmbed sin título");
  const t = await youtubeSearchOne(
    title.replace(/·/g, " "),
    requester,
    "spotify",
    url,
  );
  if (!t) throw new Error(`No hay mirror en YouTube para: ${title}`);
  t.title = title;
  if (data.thumbnail_url) t.thumbnail = data.thumbnail_url;
  return [t];
}

/** Spotify track/album/playlist → YouTube playable tracks */
async function resolveSpotify(
  url: string,
  requester: Requester,
): Promise<Track[]> {
  const { isSpotifyConfigured, resolveSpotifyItems } = await import(
    "./spotify.js"
  );

  const isTrack =
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\//i.test(url) ||
    url.includes("spotify:track:");
  const isEpisode =
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?episode\//i.test(url) ||
    url.includes("spotify:episode:");

  // Tracks/episodes: oEmbed first (no Spotify Premium / Web API needed)
  if (isTrack || isEpisode) {
    try {
      return await resolveSpotifyViaOEmbed(url, requester);
    } catch (err) {
      logger.warn({ err }, "music:spotify oEmbed track failed, trying API");
    }
  }

  // Playlists / albums / track fallback: Web API
  if (isSpotifyConfigured()) {
    try {
      const items = await resolveSpotifyItems(url);
      const out: Track[] = [];
      for (const item of items) {
        const t = await youtubeSearchOne(
          item.searchQuery,
          requester,
          "spotify",
          item.spotifyUrl || url,
        );
        if (!t) continue;
        t.title = item.artists
          ? `${item.name} · ${item.artists}`
          : item.name;
        if (item.thumbnail) t.thumbnail = item.thumbnail;
        if (item.durationSec > 0) t.durationSec = item.durationSec;
        out.push(t);
      }
      if (out.length) return out;
      throw new Error(
        "Se leyeron pistas de Spotify pero no se encontraron mirrors en YouTube (¿cookies YT?).",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ err, url }, "music:spotify Web API falló");

      // Spotify now often requires Premium on the app owner account
      if (/premium|subscription|Active premium/i.test(msg)) {
        throw new Error(
          "Spotify API exige **Premium** en la cuenta dueña de la app del Developer Dashboard. " +
            "Mientras tanto: usa **/play** con un **track** individual (sí funciona) o pega el nombre de la canción / un link de YouTube. " +
            "Playlists necesitan Premium en la cuenta Spotify del dashboard.",
        );
      }
      throw new Error(`Spotify: ${msg}`);
    }
  }

  if (isTrack || isEpisode) {
    throw new Error(
      "No se pudo resolver el track de Spotify. Prueba el nombre de la canción con /play o un link de YouTube.",
    );
  }

  throw new Error(
    "Playlists/álbumes de Spotify necesitan API + a menudo **Premium** en la cuenta del Developer Dashboard. " +
      "Alternativa: /play con el nombre de la canción o un link de YouTube.",
  );
}

/** Resolve query/URL into one or more tracks */
export async function resolveTracks(
  query: string,
  member: GuildMember,
): Promise<Track[]> {
  const requester: Requester = {
    id: member.id,
    tag: member.user.tag,
    avatarURL: member.user.displayAvatarURL({ size: 128 }),
  };

  const isUrl = (() => {
    try {
      const u = new URL(query);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  })();

  if (isUrl) {
    // Spotify
    if (
      query.includes("open.spotify.com") ||
      query.includes("spotify.link") ||
      query.startsWith("spotify:")
    ) {
      return resolveSpotify(query, requester);
    }

    // Direct YouTube watch / shorts / youtu.be — don't depend on play-dl validate
    const ytWatch =
      query.match(
        /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/i,
      )?.[1] ?? null;
    if (ytWatch) {
      const url = `https://www.youtube.com/watch?v=${ytWatch}`;
      // Prefer light metadata via yt-dlp search of the URL/id
      try {
        const meta = await ytdlpSearchMeta(url);
        if (meta) {
          return [
            {
              title: meta.title,
              url: meta.url || url,
              durationSec: meta.durationSec,
              thumbnail: meta.thumbnail,
              requestedBy: requester,
              source: "youtube",
            },
          ];
        }
      } catch {
        /* fall through */
      }
      return [
        {
          title: query,
          url,
          durationSec: 0,
          thumbnail: null,
          requestedBy: requester,
          source: "youtube",
        },
      ];
    }

    try {
      const yt = play.yt_validate(query);
      if (yt === "playlist") {
        const pl = await play.playlist_info(query, { incomplete: true });
        const videos = await pl.all_videos();
        return videos.slice(0, 50).map((v) => ({
          title: v.title ?? "Unknown",
          url: v.url,
          durationSec: v.durationInSec ?? 0,
          thumbnail: v.thumbnails?.[0]?.url ?? null,
          requestedBy: requester,
          source: "youtube" as const,
        }));
      }
      if (yt === "video") {
        const info = await play.video_info(query);
        const v = info.video_details;
        return [
          {
            title: v.title ?? "Unknown",
            url: v.url,
            durationSec: v.durationInSec ?? 0,
            thumbnail: v.thumbnails?.[0]?.url ?? null,
            requestedBy: requester,
            source: "youtube",
          },
        ];
      }
    } catch (err) {
      logger.warn({ err, query }, "music: play-dl URL resolve failed, raw URL");
      // If it's still a youtube-ish link, queue raw
      if (/youtu(\.be|be\.com)/i.test(query)) {
        return [
          {
            title: query,
            url: query,
            durationSec: 0,
            thumbnail: null,
            requestedBy: requester,
            source: "youtube",
          },
        ];
      }
    }

    // SoundCloud etc.
    try {
      const so = play.so_validate(query);
      if (so === "track" || so === "playlist") {
        const sc = await play.soundcloud(query);
        if (sc.type === "track") {
          return [
            {
              title: sc.name,
              url: sc.url,
              durationSec: Math.floor((sc.durationInMs ?? 0) / 1000),
              thumbnail: sc.thumbnail ?? null,
              requestedBy: requester,
              source: "soundcloud",
            },
          ];
        }
      }
    } catch {
      /* ignore */
    }

    // generic url attempt
    return [
      {
        title: query,
        url: query,
        durationSec: 0,
        thumbnail: null,
        requestedBy: requester,
        source: "url",
      },
    ];
  }

  const t = await youtubeSearchOne(query, requester, "search");
  if (!t) {
    throw new Error(
      "No encontré resultados en YouTube. Prueba otro nombre o un enlace directo. " +
        "(Si ves browseId, es un fallo de play-dl — ya se usa yt-dlp como principal; " +
        "comprueba que `bin/yt-dlp.exe` exista y cookies.txt sea válido.)",
    );
  }
  return [t];
}

export function memberVoiceChannel(
  member: GuildMember,
): VoiceBasedChannel | null {
  const ch = member.voice.channel;
  if (!ch) return null;
  if (
    ch.type !== ChannelType.GuildVoice &&
    ch.type !== ChannelType.GuildStageVoice
  ) {
    return null;
  }
  return ch;
}
