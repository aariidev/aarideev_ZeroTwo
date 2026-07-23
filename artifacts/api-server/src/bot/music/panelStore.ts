/**
 * Persistencia del panel de música por servidor (canal + mensaje + rol DJ + cap bots).
 */
import { db, guildMusicSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export type MusicPanelConfig = {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  djRoleId: string | null;
  /** Zero Two primary music bot — disconnect competing music bots */
  capOtherBots: boolean;
  enabled: boolean;
};

const cache = new Map<string, MusicPanelConfig>();

function rowToConfig(row: {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  djRoleId?: string | null;
  capOtherBots?: boolean | number;
  enabled: boolean | number;
}): MusicPanelConfig {
  return {
    guildId: row.guildId,
    channelId: row.channelId,
    messageId: row.messageId,
    djRoleId: row.djRoleId ?? null,
    capOtherBots: Boolean(row.capOtherBots ?? false),
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

export async function isCapOtherBotsEnabled(guildId: string): Promise<boolean> {
  const cfg = await getMusicPanelConfig(guildId);
  return Boolean(cfg?.capOtherBots);
}

export async function saveMusicPanelConfig(
  cfg: MusicPanelConfig,
): Promise<void> {
  try {
    await db
      .insert(guildMusicSettingsTable)
      .values({
        guildId: cfg.guildId,
        channelId: cfg.channelId,
        messageId: cfg.messageId,
        djRoleId: cfg.djRoleId,
        capOtherBots: cfg.capOtherBots,
        enabled: cfg.enabled,
      })
      .onDuplicateKeyUpdate({
        set: {
          channelId: cfg.channelId,
          messageId: cfg.messageId,
          djRoleId: cfg.djRoleId,
          capOtherBots: cfg.capOtherBots,
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
  const prev = await getMusicPanelConfig(guildId);
  await saveMusicPanelConfig({
    guildId,
    channelId: null,
    messageId: null,
    djRoleId: prev?.djRoleId ?? null,
    capOtherBots: prev?.capOtherBots ?? false,
    enabled: false,
  });
}

export function invalidateMusicPanelCache(guildId?: string): void {
  if (guildId) cache.delete(guildId);
  else cache.clear();
}
