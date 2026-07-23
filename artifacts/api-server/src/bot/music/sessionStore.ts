/**
 * Persist / restore music sessions across bot restarts.
 */
import { db, musicSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import type { LoopMode, Track } from "./types.js";

export type SavedMusicSession = {
  guildId: string;
  voiceChannelId: string | null;
  textChannelId: string | null;
  current: Track | null;
  queue: Track[];
  history: Track[];
  volume: number;
  loop: LoopMode;
  playbackSec: number;
  updatedAt?: Date;
};

function safeParse(payload: string): Omit<
  SavedMusicSession,
  "guildId" | "voiceChannelId" | "textChannelId" | "playbackSec" | "updatedAt"
> | null {
  try {
    const j = JSON.parse(payload) as Record<string, unknown>;
    return {
      current: (j.current as Track) ?? null,
      queue: Array.isArray(j.queue) ? (j.queue as Track[]) : [],
      history: Array.isArray(j.history) ? (j.history as Track[]) : [],
      volume: typeof j.volume === "number" ? j.volume : 80,
      loop:
        j.loop === "track" || j.loop === "queue" || j.loop === "off"
          ? j.loop
          : "off",
    };
  } catch {
    return null;
  }
}

export async function saveMusicSession(
  snap: SavedMusicSession,
): Promise<void> {
  // Nothing useful to save
  if (!snap.current && snap.queue.length === 0) {
    await clearMusicSession(snap.guildId);
    return;
  }

  const payload = JSON.stringify({
    current: snap.current,
    queue: snap.queue,
    history: snap.history.slice(-25),
    volume: snap.volume,
    loop: snap.loop,
  });

  try {
    await db
      .insert(musicSessionsTable)
      .values({
        guildId: snap.guildId,
        voiceChannelId: snap.voiceChannelId,
        textChannelId: snap.textChannelId,
        payload,
        playbackSec: Math.max(0, Math.floor(snap.playbackSec || 0)),
      })
      .onDuplicateKeyUpdate({
        set: {
          voiceChannelId: snap.voiceChannelId,
          textChannelId: snap.textChannelId,
          payload,
          playbackSec: Math.max(0, Math.floor(snap.playbackSec || 0)),
        },
      });
  } catch (err) {
    logger.warn({ err, guildId: snap.guildId }, "music session: save failed");
  }
}

export async function loadMusicSession(
  guildId: string,
): Promise<SavedMusicSession | null> {
  try {
    const rows = await db
      .select()
      .from(musicSessionsTable)
      .where(eq(musicSessionsTable.guildId, guildId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const body = safeParse(row.payload);
    if (!body) return null;
    if (!body.current && body.queue.length === 0) return null;
    return {
      guildId,
      voiceChannelId: row.voiceChannelId,
      textChannelId: row.textChannelId,
      playbackSec: row.playbackSec ?? 0,
      updatedAt: row.updatedAt,
      ...body,
    };
  } catch (err) {
    logger.warn({ err, guildId }, "music session: load failed");
    return null;
  }
}

export async function clearMusicSession(guildId: string): Promise<void> {
  try {
    await db
      .delete(musicSessionsTable)
      .where(eq(musicSessionsTable.guildId, guildId));
  } catch (err) {
    logger.warn({ err, guildId }, "music session: clear failed");
  }
}

export async function listSavedMusicSessions(): Promise<SavedMusicSession[]> {
  try {
    const rows = await db.select().from(musicSessionsTable);
    const out: SavedMusicSession[] = [];
    for (const row of rows) {
      const body = safeParse(row.payload);
      if (!body) continue;
      if (!body.current && body.queue.length === 0) continue;
      out.push({
        guildId: row.guildId,
        voiceChannelId: row.voiceChannelId,
        textChannelId: row.textChannelId,
        playbackSec: row.playbackSec ?? 0,
        updatedAt: row.updatedAt,
        ...body,
      });
    }
    return out;
  } catch (err) {
    logger.warn({ err }, "music session: list failed");
    return [];
  }
}

export async function hasSavedMusicSession(guildId: string): Promise<boolean> {
  const s = await loadMusicSession(guildId);
  return Boolean(s);
}
