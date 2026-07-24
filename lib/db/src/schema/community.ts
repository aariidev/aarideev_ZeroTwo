/**
 * Community systems: suggestions, antiraid, levels/XP.
 */
import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  int,
  primaryKey,
  index,
} from "drizzle-orm/mysql-core";

// ── Sugerencias ───────────────────────────────────────────────────────────────

export const guildSuggestionSettingsTable = mysqlTable(
  "guild_suggestion_settings",
  {
    guildId: varchar("guild_id", { length: 32 }).primaryKey(),
    channelId: varchar("channel_id", { length: 32 }),
    logChannelId: varchar("log_channel_id", { length: 32 }),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
);

export const suggestionsTable = mysqlTable(
  "suggestions",
  {
    id: int("id").autoincrement().primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    username: varchar("username", { length: 100 }).notNull(),
    content: text("content").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    // pending | approved | rejected | implemented
    messageId: varchar("message_id", { length: 32 }),
    channelId: varchar("channel_id", { length: 32 }),
    reviewedBy: varchar("reviewed_by", { length: 32 }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at"),
  },
  (t) => [
    index("suggestions_guild_status").on(t.guildId, t.status),
    index("suggestions_message").on(t.messageId),
    index("suggestions_user").on(t.guildId, t.userId),
  ],
);

// ── Antiraid ──────────────────────────────────────────────────────────────────

export const guildAntiraidSettingsTable = mysqlTable(
  "guild_antiraid_settings",
  {
    guildId: varchar("guild_id", { length: 32 }).primaryKey(),
    enabled: boolean("enabled").notNull().default(false),
    /** Joins needed within window to trip */
    threshold: int("threshold").notNull().default(5),
    /** Window in seconds */
    timeWindow: int("time_window").notNull().default(60),
    /** kick | ban | none */
    action: varchar("action", { length: 16 }).notNull().default("kick"),
    logChannelId: varchar("log_channel_id", { length: 32 }),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
);

// ── Niveles / XP ──────────────────────────────────────────────────────────────

export const guildLevelSettingsTable = mysqlTable("guild_level_settings", {
  guildId: varchar("guild_id", { length: 32 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  xpMin: int("xp_min").notNull().default(15),
  xpMax: int("xp_max").notNull().default(25),
  /** Cooldown between message XP grants (seconds) */
  cooldownSec: int("cooldown_sec").notNull().default(60),
  /** XP per minute in voice (approx) */
  voiceXpPerMin: int("voice_xp_per_min").notNull().default(5),
  announceChannelId: varchar("announce_channel_id", { length: 32 }),
  /** If true, announce level-up in the channel where XP was earned */
  announceInPlace: boolean("announce_in_place").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const userLevelsTable = mysqlTable(
  "user_levels",
  {
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    xp: int("xp").notNull().default(0),
    level: int("level").notNull().default(0),
    totalMessages: int("total_messages").notNull().default(0),
    voiceMinutes: int("voice_minutes").notNull().default(0),
    lastXpAt: timestamp("last_xp_at"),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.guildId, t.userId] }),
    index("user_levels_guild_xp").on(t.guildId, t.xp),
    index("user_levels_guild_level").on(t.guildId, t.level),
  ],
);

export type GuildSuggestionSettings =
  typeof guildSuggestionSettingsTable.$inferSelect;
export type Suggestion = typeof suggestionsTable.$inferSelect;
export type GuildAntiraidSettings =
  typeof guildAntiraidSettingsTable.$inferSelect;
export type GuildLevelSettings = typeof guildLevelSettingsTable.$inferSelect;
export type UserLevel = typeof userLevelsTable.$inferSelect;
