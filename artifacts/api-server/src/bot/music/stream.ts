/**
 * Stream audio via yt-dlp → ffmpeg (libopus/ogg) → @discordjs/voice
 * Avoids broken @discordjs/opus native builds on Windows (uses ffmpeg encoder instead).
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  createAudioResource,
  StreamType,
  type AudioResource,
} from "@discordjs/voice";
import ffmpegStatic from "ffmpeg-static";
import { logger } from "../../lib/logger.js";

function findYtDlp(): string | null {
  const candidates = [
    process.env.YTDLP_PATH?.trim(),
    path.join(process.cwd(), "bin", "yt-dlp.exe"),
    path.join(process.cwd(), "..", "bin", "yt-dlp.exe"),
    path.join(process.cwd(), "..", "..", "bin", "yt-dlp.exe"),
    "H:\\Discord\\02\\bin\\yt-dlp.exe",
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findFfmpeg(): string {
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
  const winget = "C:\\Users\\ari\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe";
  if (fs.existsSync(winget)) return winget;
  return "ffmpeg";
}

function findCookiesFile(): string | null {
  const fromEnv =
    process.env.YOUTUBE_COOKIES_PATH?.trim() ||
    process.env.YOUTUBE_COOKIE_PATH?.trim();
  const candidates = [
    fromEnv,
    "H:\\Discord\\02\\cookies.txt",
    path.join(process.cwd(), "cookies.txt"),
    path.join(process.cwd(), "..", "cookies.txt"),
    path.join(process.cwd(), "..", "..", "cookies.txt"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      const useful = raw
        .split(/\r?\n/)
        .some((l) => l.trim() && !l.trim().startsWith("#") && l.includes("\t"));
      const headerStyle =
        raw.includes("SID=") ||
        raw.includes("LOGIN_INFO=") ||
        raw.includes("__Secure-");
      if (useful || headerStyle) return p;
    } catch {
      /* */
    }
  }
  return null;
}

function cookieArgs(): string[] {
  const file = findCookiesFile();
  if (!file) return [];

  try {
    const raw = fs.readFileSync(file, "utf8");
    const isNetscape =
      raw.includes("\t") ||
      raw.includes("# Netscape") ||
      raw.includes("# HTTP Cookie File");
    if (isNetscape) return ["--cookies", file];

    const header = raw.replace(/\r?\n/g, " ").trim();
    if (header.includes("=")) {
      return ["--add-header", `Cookie: ${header}`];
    }
  } catch {
    /* */
  }
  return [];
}

/** YouTube needs a JS runtime to solve n/sig challenges (else only storyboards). */
function youtubeJsArgs(): string[] {
  const node =
    process.execPath ||
    process.env.NODE_PATH ||
    "C:\\Program Files\\nodejs\\node.exe";
  // Prefer full path to node for Windows
  const nodePath = fs.existsSync(process.execPath)
    ? process.execPath
    : fs.existsSync("C:\\Program Files\\nodejs\\node.exe")
      ? "C:\\Program Files\\nodejs\\node.exe"
      : "node";

  return [
    "--js-runtimes",
    `node:${nodePath}`,
    // Download challenge solver scripts from GitHub when missing
    "--remote-components",
    "ejs:github",
  ];
}

function baseYtDlpArgs(
  pageUrl: string,
  format: string,
  startSec = 0,
): string[] {
  const args = [
    "-f",
    format,
    "--no-playlist",
    "--no-warnings",
    "-o",
    "-",
    ...cookieArgs(),
    ...youtubeJsArgs(),
    // web works with cookies; android skips cookies
    "--extractor-args",
    "youtube:player_client=web,default,ios",
  ];
  // Resume from position (yt-dlp section download)
  if (startSec > 2) {
    args.push("--download-sections", `*${Math.floor(startSec)}-inf`);
  }
  args.push(pageUrl);
  return args;
}

export type StreamHandle = {
  resource: AudioResource;
  kill: () => void;
};

/**
 * yt-dlp downloads audio → pipe to ffmpeg → Ogg/Opus for Discord voice
 * (no @discordjs/opus / opusscript required)
 */
export async function createTrackResource(
  pageUrl: string,
  volumePercent: number,
  startSec = 0,
): Promise<StreamHandle> {
  const ytdlp = findYtDlp();
  if (!ytdlp) {
    throw new Error(
      "yt-dlp no encontrado. Debe existir H:\\Discord\\02\\bin\\yt-dlp.exe",
    );
  }
  const ffmpeg = findFfmpeg();

  logger.info(
    {
      ytdlp,
      ffmpeg,
      cookies: findCookiesFile() ? "yes" : "no",
      startSec,
      url: pageUrl.slice(0, 90),
    },
    "music: yt-dlp | ffmpeg → OggOpus",
  );

  // Try several format strategies — after EJS, bestaudio/best usually works
  const formatAttempts = [
    "bestaudio/best",
    "bestaudio*",
    "140/251/250/249/bestaudio/best", // common m4a/webm audio itags
    "18/22/best", // progressive mp4 fallback
  ];

  let lastErr: Error | null = null;
  for (const format of formatAttempts) {
    try {
      return await spawnPipeline(
        ytdlp,
        ffmpeg,
        pageUrl,
        format,
        volumePercent,
        startSec,
      );
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        { format, err: lastErr.message.slice(0, 220) },
        "music: format attempt failed",
      );
      // If section seek fails, retry from start once
      if (startSec > 0) {
        try {
          return await spawnPipeline(
            ytdlp,
            ffmpeg,
            pageUrl,
            format,
            volumePercent,
            0,
          );
        } catch (err2) {
          lastErr = err2 instanceof Error ? err2 : new Error(String(err2));
        }
      }
    }
  }
  throw lastErr ?? new Error("No se pudo abrir stream de audio");
}

function spawnPipeline(
  ytdlp: string,
  ffmpeg: string,
  pageUrl: string,
  format: string,
  volumePercent: number,
  startSec = 0,
): Promise<StreamHandle> {
  const ytdlpArgs = baseYtDlpArgs(pageUrl, format, startSec);

  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    "pipe:0",
    "-vn", // audio only (ignore video if progressive format)
    "-acodec",
    "libopus",
    "-f",
    "opus",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-b:a",
    "96k",
    "pipe:1",
  ];

  return new Promise<StreamHandle>((resolve, reject) => {
    const ytdlpProc: ChildProcessWithoutNullStreams = spawn(ytdlp, ytdlpArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const ffmpegProc: ChildProcessWithoutNullStreams = spawn(
      ffmpeg,
      ffmpegArgs,
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    // Swallow EPIPE when the other side closes (skip/stop/end) — must not crash Node
    const ignorePipeError = (err: NodeJS.ErrnoException) => {
      if (err?.code === "EPIPE" || err?.code === "ECONNRESET" || err?.code === "ERR_STREAM_PREMATURE_CLOSE") {
        return;
      }
      logger.warn({ err: err?.message, code: err?.code }, "music: stream pipe error");
    };

    for (const s of [
      ytdlpProc.stdout,
      ytdlpProc.stderr,
      ffmpegProc.stdin,
      ffmpegProc.stdout,
      ffmpegProc.stderr,
    ]) {
      s.on("error", ignorePipeError);
    }
    ytdlpProc.on("error", ignorePipeError);
    ffmpegProc.on("error", ignorePipeError);

    // Manual pipe with destroy handling (avoids unhandled EPIPE on write)
    ytdlpProc.stdout.on("data", (chunk: Buffer) => {
      if (ffmpegProc.stdin.destroyed || !ffmpegProc.stdin.writable) return;
      try {
        const ok = ffmpegProc.stdin.write(chunk);
        if (!ok) ytdlpProc.stdout.pause();
      } catch {
        /* EPIPE */
      }
    });
    ffmpegProc.stdin.on("drain", () => ytdlpProc.stdout.resume());
    ytdlpProc.stdout.on("end", () => {
      try {
        if (!ffmpegProc.stdin.destroyed) ffmpegProc.stdin.end();
      } catch {
        /* */
      }
    });

    let ytdlpErr = "";
    let ffmpegErr = "";
    ytdlpProc.stderr.on("data", (c: Buffer) => {
      ytdlpErr += c.toString();
      if (ytdlpErr.length > 2000) ytdlpErr = ytdlpErr.slice(-2000);
    });
    ffmpegProc.stderr.on("data", (c: Buffer) => {
      ffmpegErr += c.toString();
      if (ffmpegErr.length > 1500) ffmpegErr = ffmpegErr.slice(-1500);
    });

    const kill = () => {
      try {
        ytdlpProc.stdout.unpipe?.();
        ytdlpProc.stdout.destroy();
      } catch {
        /* */
      }
      try {
        if (!ffmpegProc.stdin.destroyed) {
          ffmpegProc.stdin.end();
          ffmpegProc.stdin.destroy();
        }
      } catch {
        /* */
      }
      try {
        if (!ytdlpProc.killed) ytdlpProc.kill("SIGTERM");
      } catch {
        /* */
      }
      try {
        if (!ffmpegProc.killed) ffmpegProc.kill("SIGTERM");
      } catch {
        /* */
      }
      // Force kill after a tick if still alive
      setTimeout(() => {
        try {
          if (!ytdlpProc.killed) ytdlpProc.kill("SIGKILL");
        } catch {
          /* */
        }
        try {
          if (!ffmpegProc.killed) ffmpegProc.kill("SIGKILL");
        } catch {
          /* */
        }
      }, 400);
    };

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      kill();
      reject(
        new Error(
          ytdlpErr.trim().slice(0, 280) ||
            ffmpegErr.trim().slice(0, 200) ||
            "Timeout abriendo stream",
        ),
      );
    }, 40_000);

    const ok = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const resource = createAudioResource(ffmpegProc.stdout, {
        inputType: StreamType.OggOpus,
        inlineVolume: true,
      });
      // Guard resource stream errors (player stop mid-play)
      resource.playStream?.on?.("error", ignorePipeError);
      resource.volume?.setVolume(Math.max(0, Math.min(1, volumePercent / 100)));

      ffmpegProc.on("close", (code) => {
        if (code && code !== 0) {
          logger.warn(
            {
              code,
              format,
              ffmpegErr: ffmpegErr.slice(0, 200),
              ytdlpErr: ytdlpErr.slice(0, 200),
            },
            "music: ffmpeg closed with error",
          );
        }
      });

      resolve({ resource, kill });
    };

    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      kill();
      reject(new Error(msg));
    };

    ytdlpProc.once("error", (e) => {
      if (!settled) fail(`yt-dlp: ${e.message}`);
    });
    ffmpegProc.once("error", (e) => {
      if (!settled) fail(`ffmpeg: ${e.message}`);
    });
    ffmpegProc.stdout.once("readable", () => ok());

    ffmpegProc.once("close", (code) => {
      if (!settled && code && code !== 0) {
        fail(
          `ffmpeg exit ${code}: ${
            ffmpegErr.trim().slice(0, 200) ||
            ytdlpErr.trim().slice(0, 200) ||
            "error"
          }`,
        );
      }
    });
    ytdlpProc.once("close", (code) => {
      if (!settled && code && code !== 0) {
        fail(
          `yt-dlp exit ${code}: ${
            ytdlpErr.trim().slice(0, 300) || "falló la descarga"
          }`,
        );
      }
    });
  });
}

/** ytsearch1 via yt-dlp → watch URL */
export async function ytdlpSearchUrl(query: string): Promise<string | null> {
  const hit = await ytdlpSearchMeta(query);
  return hit?.url ?? null;
}

export type YtSearchMeta = {
  url: string;
  title: string;
  durationSec: number;
  thumbnail: string | null;
};

/**
 * Resolve metadata with yt-dlp (search or direct URL).
 * Avoids play-dl browseId / innertube breakage.
 * @param timeoutMs kill slow yt-dlp (default 25s; use lower for playlist batches)
 */
export async function ytdlpSearchMeta(
  query: string,
  opts?: { timeoutMs?: number },
): Promise<YtSearchMeta | null> {
  const ytdlp = findYtDlp();
  if (!ytdlp) return null;

  const isHttp = /^https?:\/\//i.test(query.trim());
  // Direct URL → metadata of that video; otherwise ytsearch1
  const target = isHttp ? query.trim() : `ytsearch1:${query}`;
  const timeoutMs = opts?.timeoutMs ?? 25_000;

  return new Promise((resolve) => {
    // Use a rare separator so titles with tabs don't break parsing
    const sep = "|||";
    const args = [
      target,
      "--print",
      `%(id)s${sep}%(title)s${sep}%(duration)s${sep}%(thumbnail)s`,
      "--skip-download",
      "--no-warnings",
      "--no-playlist",
      ...cookieArgs(),
      ...youtubeJsArgs(),
    ];
    const proc = spawn(ytdlp, args, { windowsHide: true });
    let out = "";
    proc.stdout.on("data", (c) => (out += c.toString()));
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* */
      }
      resolve(null);
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      const line = out
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.includes(sep) || /^[\w-]{6,}/.test(l));
      if (code !== 0 || !line) {
        resolve(null);
        return;
      }
      const parts = line.split(sep);
      const id = parts[0]?.trim();
      const title = parts[1]?.trim();
      const durationRaw = parts[2]?.trim();
      const thumb = parts[3]?.trim();
      if (!id || !/^[\w-]{6,}$/.test(id)) {
        resolve(null);
        return;
      }
      const durationSec = Math.max(0, Math.floor(Number(durationRaw) || 0));
      resolve({
        url: `https://www.youtube.com/watch?v=${id}`,
        title: (title && title !== "NA" ? title : query).slice(0, 200),
        durationSec,
        thumbnail:
          thumb && thumb !== "NA" && /^https?:\/\//i.test(thumb) ? thumb : null,
      });
    });
    proc.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

/**
 * Expand a YouTube playlist / Mix / radio (list=RD…) into multiple entries.
 * Uses yt-dlp --flat-playlist (does NOT use --no-playlist).
 */
export async function ytdlpPlaylistEntries(
  urlOrList: string,
  max = 50,
): Promise<YtSearchMeta[]> {
  const ytdlp = findYtDlp();
  if (!ytdlp) return [];

  const target = urlOrList.trim();
  if (!target) return [];

  return new Promise((resolve) => {
    const sep = "|||";
    const args = [
      target,
      "--flat-playlist",
      "--yes-playlist",
      "--print",
      `%(id)s${sep}%(title)s${sep}%(duration)s${sep}%(thumbnail)s`,
      "--skip-download",
      "--no-warnings",
      "--playlist-end",
      String(Math.max(1, Math.min(100, max))),
      ...cookieArgs(),
      ...youtubeJsArgs(),
    ];
    const proc = spawn(ytdlp, args, { windowsHide: true });
    let out = "";
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* */
      }
      // still parse whatever we got
      resolve(parsePlaylistPrint(out, sep));
    }, 45_000);

    proc.stdout.on("data", (c) => (out += c.toString()));
    proc.on("close", () => {
      clearTimeout(timer);
      resolve(parsePlaylistPrint(out, sep));
    });
    proc.on("error", () => {
      clearTimeout(timer);
      resolve([]);
    });
  });
}

function parsePlaylistPrint(out: string, sep: string): YtSearchMeta[] {
  const seen = new Set<string>();
  const items: YtSearchMeta[] = [];
  for (const raw of out.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.includes(sep)) continue;
    const parts = line.split(sep);
    const id = parts[0]?.trim();
    if (!id || !/^[\w-]{6,}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const title = parts[1]?.trim();
    const durationRaw = parts[2]?.trim();
    const thumb = parts[3]?.trim();
    const durationSec = Math.max(0, Math.floor(Number(durationRaw) || 0));
    items.push({
      url: `https://www.youtube.com/watch?v=${id}`,
      title: title && title !== "NA" ? title.slice(0, 200) : id,
      durationSec,
      thumbnail:
        thumb && thumb !== "NA" && /^https?:\/\//i.test(thumb) ? thumb : null,
    });
  }
  return items;
}

/** Detect playlist / Mix / radio URL (list= param or /playlist). */
export function isYoutubePlaylistOrMixUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (!/youtube\.com|youtu\.be|music\.youtube\.com/i.test(host)) return false;
    if (u.pathname.includes("/playlist")) return true;
    const list = u.searchParams.get("list");
    if (list && list.length > 2) return true;
    // /watch/videoseries etc.
    if (u.searchParams.get("start_radio") === "1") return true;
    return false;
  } catch {
    return /[?&]list=[\w-]+/i.test(url) || /\/playlist\?/i.test(url);
  }
}

export function getStreamDiagnostics(): {
  ytdlp: string | null;
  cookies: string | null;
  ffmpeg: string;
} {
  return {
    ytdlp: findYtDlp(),
    cookies: findCookiesFile(),
    ffmpeg: findFfmpeg(),
  };
}
