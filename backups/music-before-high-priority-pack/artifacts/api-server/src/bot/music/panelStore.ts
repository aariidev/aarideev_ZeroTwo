/**
 * Persistencia del panel de música por servidor (canal + mensaje editable).
 * SNAPSHOT: antes del pack de alta prioridad (sin rol DJ).
 */
import { db, guildMusicSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export type MusicPanelConfig = {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  enabled: boolean;
};

const cache = new Map<string, MusicPanelConfig>();

function rowToConfig(row: {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  enabled: boolean | number;
}): MusicPanelConfig {
  return {
    guildId: row.guildId,
    channelId: row.channelId,
    messageId: row.messageId,
    enabled: Boolean(row.enabled),
  };
}

export async function getMusicPanelConfig(
  guildId: string,
): Promise<MusicPanelConfig | null> {
  const hit = cache.get(guildId);
  if (hit) return hit;
  try {
    const rows = await db
      .select()
      .from(guildMusicSettingsTable)
      .where(eq(guildMusicSettingsTable.guildId, guildId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const cfg = rowToConfig(row);
    cache.set(guildId, cfg);
    return cfg;
  } catch (err) {
    logger.warn({ err, guildId }, "music panel: get config failed");
    return null;
  }
}

export async function hasActiveMusicPanel(guildId: string): Promise<boolean> {
  const cfg = await getMusicPanelConfig(guildId);
  return Boolean(cfg?.enabled && cfg.channelId);
}

export async function saveMusicPanelConfig(cfg: MusicPanelConfig): Promise<void> {
  try {
    await db
      .insert(guildMusicSettingsTable)
      .values({
        guildId: cfg.guildId,
        channelId: cfg.channelId,
        messageId: cfg.messageId,
        enabled: cfg.enabled,
      })
      .onDuplicateKeyUpdate({
        set: {
          channelId: cfg.channelId,
          messageId: cfg.messageId,
          enabled: cfg.enabled,
        },
      });
    cache.set(cfg.guildId, cfg);
  } catch (err) {
    logger.error({ err, guildId: cfg.guildId }, "music panel: save failed");
    throw err;
  }
}

export async function disableMusicPanel(guildId: string): Promise<void> {
  await saveMusicPanelConfig({
    guildId,
    channelId: null,
    messageId: null,
    enabled: false,
  });
}

export function invalidateMusicPanelCache(guildId?: string): void {
  if (guildId) cache.delete(guildId);
  else cache.clear();
}
