/**
 * Sistema de niveles / XP (mensajes + voz).
 */
import {
  EmbedBuilder,
  type Client,
  type Guild,
  type GuildMember,
  type Message,
  type TextChannel,
  type VoiceState,
} from "discord.js";
import {
  db,
  guildLevelSettingsTable,
  userLevelsTable,
  type GuildLevelSettings,
  type UserLevel,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { BOT_VERSION } from "./version.js";

const PINK = 0xff2d6b;
const GOLD = 0xffd700;

/** XP needed to go from level L to L+1 */
export function xpForLevel(level: number): number {
  // mild curve: 100, 125, 150… then faster
  return Math.floor(100 + level * 35 + level * level * 2);
}

export function levelFromTotalXp(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  xpNeeded: number;
} {
  let level = 0;
  let remaining = Math.max(0, totalXp);
  while (true) {
    const need = xpForLevel(level);
    if (remaining < need) {
      return { level, xpIntoLevel: remaining, xpNeeded: need };
    }
    remaining -= need;
    level++;
    if (level > 500) break; // safety
  }
  return { level, xpIntoLevel: 0, xpNeeded: xpForLevel(level) };
}

export function progressBar(current: number, max: number, len = 12): string {
  if (max <= 0) return "█".repeat(len);
  const filled = Math.round((Math.min(1, current / max) * len));
  return "█".repeat(filled) + "░".repeat(Math.max(0, len - filled));
}

export async function getLevelSettings(
  guildId: string,
): Promise<GuildLevelSettings> {
  const rows = await db
    .select()
    .from(guildLevelSettingsTable)
    .where(eq(guildLevelSettingsTable.guildId, guildId))
    .limit(1);
  if (rows[0]) return rows[0];
  await db
    .insert(guildLevelSettingsTable)
    .values({ guildId })
    .catch(() => null);
  const again = await db
    .select()
    .from(guildLevelSettingsTable)
    .where(eq(guildLevelSettingsTable.guildId, guildId))
    .limit(1);
  return (
    again[0] ?? {
      guildId,
      enabled: true,
      xpMin: 15,
      xpMax: 25,
      cooldownSec: 60,
      voiceXpPerMin: 5,
      announceChannelId: null,
      announceInPlace: true,
      updatedAt: new Date(),
    }
  );
}

export async function updateLevelSettings(
  guildId: string,
  patch: Partial<{
    enabled: boolean;
    xpMin: number;
    xpMax: number;
    cooldownSec: number;
    voiceXpPerMin: number;
    announceChannelId: string | null;
    announceInPlace: boolean;
  }>,
): Promise<GuildLevelSettings> {
  await getLevelSettings(guildId);
  const cur = await getLevelSettings(guildId);
  await db
    .update(guildLevelSettingsTable)
    .set({
      enabled: patch.enabled ?? cur.enabled,
      xpMin: patch.xpMin ?? cur.xpMin,
      xpMax: patch.xpMax ?? cur.xpMax,
      cooldownSec: patch.cooldownSec ?? cur.cooldownSec,
      voiceXpPerMin: patch.voiceXpPerMin ?? cur.voiceXpPerMin,
      announceChannelId:
        patch.announceChannelId !== undefined
          ? patch.announceChannelId
          : cur.announceChannelId,
      announceInPlace: patch.announceInPlace ?? cur.announceInPlace,
    })
    .where(eq(guildLevelSettingsTable.guildId, guildId));
  return getLevelSettings(guildId);
}

export async function getUserLevel(
  guildId: string,
  userId: string,
): Promise<UserLevel> {
  const rows = await db
    .select()
    .from(userLevelsTable)
    .where(
      and(
        eq(userLevelsTable.guildId, guildId),
        eq(userLevelsTable.userId, userId),
      ),
    )
    .limit(1);
  if (rows[0]) return rows[0];
  await db
    .insert(userLevelsTable)
    .values({ guildId, userId })
    .catch(() => null);
  const again = await db
    .select()
    .from(userLevelsTable)
    .where(
      and(
        eq(userLevelsTable.guildId, guildId),
        eq(userLevelsTable.userId, userId),
      ),
    )
    .limit(1);
  return (
    again[0] ?? {
      guildId,
      userId,
      xp: 0,
      level: 0,
      totalMessages: 0,
      voiceMinutes: 0,
      lastXpAt: null,
      updatedAt: new Date(),
    }
  );
}

export async function getLeaderboard(
  guildId: string,
  limit = 10,
): Promise<UserLevel[]> {
  return db
    .select()
    .from(userLevelsTable)
    .where(eq(userLevelsTable.guildId, guildId))
    .orderBy(desc(userLevelsTable.xp))
    .limit(limit);
}

async function announceLevelUp(
  client: Client,
  guild: Guild,
  userId: string,
  newLevel: number,
  settings: GuildLevelSettings,
  channelId?: string | null,
): Promise<void> {
  const emb = new EmbedBuilder()
    .setColor(GOLD)
    .setAuthor({
      name: "Zero Two · Niveles",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle("🎉 ¡Subiste de nivel!")
    .setDescription(
      `<@${userId}> alcanzó el **nivel ${newLevel}**.\nSigue hablando, Darling… me caes bien.`,
    )
    .setFooter({ text: `Zero Two ${BOT_VERSION}` })
    .setTimestamp();

  const targets: string[] = [];
  if (settings.announceChannelId) targets.push(settings.announceChannelId);
  if (settings.announceInPlace && channelId) targets.push(channelId);

  const seen = new Set<string>();
  for (const id of targets) {
    if (seen.has(id)) continue;
    seen.add(id);
    try {
      const ch = await client.channels.fetch(id);
      if (ch?.isTextBased() && !ch.isDMBased()) {
        await (ch as TextChannel).send({ embeds: [emb] });
      }
    } catch {
      /* optional */
    }
  }
}

/**
 * Grant XP; returns level-up info if any.
 */
export async function grantXp(input: {
  guildId: string;
  userId: string;
  amount: number;
  source: "message" | "voice" | "admin";
  bumpMessages?: boolean;
  bumpVoiceMin?: number;
  client?: Client;
  guild?: Guild;
  channelId?: string | null;
}): Promise<{
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  totalXp: number;
  user: UserLevel;
}> {
  const amount = Math.max(0, Math.floor(input.amount));
  const user = await getUserLevel(input.guildId, input.userId);
  const oldLevel = user.level;
  const newXp = user.xp + amount;
  const { level: newLevel } = levelFromTotalXp(newXp);

  await db
    .update(userLevelsTable)
    .set({
      xp: newXp,
      level: newLevel,
      totalMessages: user.totalMessages + (input.bumpMessages ? 1 : 0),
      voiceMinutes: user.voiceMinutes + (input.bumpVoiceMin ?? 0),
      lastXpAt: input.source === "message" ? new Date() : user.lastXpAt,
    })
    .where(
      and(
        eq(userLevelsTable.guildId, input.guildId),
        eq(userLevelsTable.userId, input.userId),
      ),
    );

  const updated = await getUserLevel(input.guildId, input.userId);
  const leveledUp = newLevel > oldLevel;

  if (leveledUp && input.client && input.guild) {
    const settings = await getLevelSettings(input.guildId);
    void announceLevelUp(
      input.client,
      input.guild,
      input.userId,
      newLevel,
      settings,
      input.channelId,
    );
  }

  return {
    leveledUp,
    oldLevel,
    newLevel,
    totalXp: newXp,
    user: updated,
  };
}

export async function handleMessageXp(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;
  if (!message.content || message.content.length < 2) return;

  const settings = await getLevelSettings(message.guild.id);
  if (!settings.enabled) return;

  const user = await getUserLevel(message.guild.id, message.author.id);
  const cooldownMs = Math.max(5, settings.cooldownSec) * 1000;
  if (user.lastXpAt && Date.now() - user.lastXpAt.getTime() < cooldownMs) {
    // Count message without granting XP (cooldown)
    await db
      .update(userLevelsTable)
      .set({ totalMessages: user.totalMessages + 1 })
      .where(
        and(
          eq(userLevelsTable.guildId, message.guild.id),
          eq(userLevelsTable.userId, message.author.id),
        ),
      )
      .catch(() => null);
    return;
  }

  const min = Math.min(settings.xpMin, settings.xpMax);
  const max = Math.max(settings.xpMin, settings.xpMax);
  const amount = min + Math.floor(Math.random() * (max - min + 1));

  await grantXp({
    guildId: message.guild.id,
    userId: message.author.id,
    amount,
    source: "message",
    bumpMessages: true,
    client: message.client,
    guild: message.guild,
    channelId: message.channelId,
  });
}

/** Voice: track join times and grant XP on leave / periodic tick */
const voiceJoinedAt = new Map<string, number>(); // key: guildId:userId

function voiceKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export async function handleVoiceXp(
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;
  const guild = newState.guild ?? oldState.guild;
  if (!guild) return;

  const settings = await getLevelSettings(guild.id);
  if (!settings.enabled || settings.voiceXpPerMin <= 0) return;

  const key = voiceKey(guild.id, member.id);
  const wasIn = Boolean(oldState.channelId) && !oldState.deaf && !oldState.selfDeaf;
  const nowIn =
    Boolean(newState.channelId) && !newState.deaf && !newState.selfDeaf;

  // left voice or went deaf
  if (wasIn && !nowIn) {
    const joined = voiceJoinedAt.get(key);
    voiceJoinedAt.delete(key);
    if (!joined) return;
    const mins = Math.floor((Date.now() - joined) / 60_000);
    if (mins < 1) return;
    const amount = mins * settings.voiceXpPerMin;
    await grantXp({
      guildId: guild.id,
      userId: member.id,
      amount,
      source: "voice",
      bumpVoiceMin: mins,
      client: guild.client,
      guild,
    });
    return;
  }

  // joined voice
  if (!wasIn && nowIn) {
    voiceJoinedAt.set(key, Date.now());
  }
}

export function registerLevels(client: Client): void {
  client.on("messageCreate", (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    void handleMessageXp(message).catch((err) =>
      logger.debug({ err }, "levels: message xp"),
    );
  });

  client.on("voiceStateUpdate", (oldS, newS) => {
    void handleVoiceXp(oldS, newS).catch((err) =>
      logger.debug({ err }, "levels: voice xp"),
    );
  });

  // Flush voice XP every 10 min for people still connected
  setInterval(() => {
    void flushVoiceXp(client).catch(() => null);
  }, 10 * 60_000).unref?.();

  logger.info("📊 Levels / XP listeners activos");
}

async function flushVoiceXp(client: Client): Promise<void> {
  const now = Date.now();
  for (const [key, joined] of voiceJoinedAt.entries()) {
    const mins = Math.floor((now - joined) / 60_000);
    if (mins < 5) continue; // only flush chunks ≥5 min
    const [guildId, userId] = key.split(":");
    if (!guildId || !userId) continue;
    const settings = await getLevelSettings(guildId);
    if (!settings.enabled) continue;
    const amount = mins * settings.voiceXpPerMin;
    voiceJoinedAt.set(key, now); // reset join anchor
    const guild = client.guilds.cache.get(guildId);
    await grantXp({
      guildId,
      userId,
      amount,
      source: "voice",
      bumpVoiceMin: mins,
      client,
      guild: guild ?? undefined,
    });
  }
}

export function rankTitle(level: number): string {
  if (level >= 100) return "👑 Legendaria";
  if (level >= 50) return "💎 Élite del nexo";
  if (level >= 25) return "🔥 Piloto veterano";
  if (level >= 10) return "⚔️ Partner";
  if (level >= 5) return "🌸 Aprendiz";
  return "🐣 Recruta";
}
