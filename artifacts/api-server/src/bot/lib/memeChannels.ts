/**
 * Canales de memes por guild (normal + humor negro).
 * Persistido en bot_config: meme_channels:<guildId>
 */
import { db, botConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type MemeChannelConfig = {
  /** Canal para memes normales */
  memeChannelId: string | null;
  /** Canal para humor negro (recomendado NSFW) */
  darkChannelId: string | null;
  updatedAt?: string;
};

const CONFIG_KEY = (guildId: string) => `meme_channels:${guildId}`;

const DEFAULT: MemeChannelConfig = {
  memeChannelId: null,
  darkChannelId: null,
};

export async function getMemeChannelConfig(
  guildId: string,
): Promise<MemeChannelConfig> {
  try {
    const rows = await db
      .select()
      .from(botConfigTable)
      .where(eq(botConfigTable.key, CONFIG_KEY(guildId)))
      .limit(1);
    if (!rows[0]?.value) return { ...DEFAULT };
    const parsed = JSON.parse(rows[0].value) as Partial<MemeChannelConfig>;
    return {
      memeChannelId: parsed.memeChannelId ?? null,
      darkChannelId: parsed.darkChannelId ?? null,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function setMemeChannelConfig(
  guildId: string,
  patch: Partial<Pick<MemeChannelConfig, "memeChannelId" | "darkChannelId">>,
): Promise<MemeChannelConfig> {
  const cur = await getMemeChannelConfig(guildId);
  const next: MemeChannelConfig = {
    memeChannelId:
      patch.memeChannelId !== undefined
        ? patch.memeChannelId
        : cur.memeChannelId,
    darkChannelId:
      patch.darkChannelId !== undefined
        ? patch.darkChannelId
        : cur.darkChannelId,
    updatedAt: new Date().toISOString(),
  };
  const value = JSON.stringify(next);
  await db
    .insert(botConfigTable)
    .values({ key: CONFIG_KEY(guildId), value })
    .onDuplicateKeyUpdate({ set: { value } });
  return next;
}

export async function clearMemeChannelConfig(
  guildId: string,
): Promise<void> {
  await setMemeChannelConfig(guildId, {
    memeChannelId: null,
    darkChannelId: null,
  });
}
