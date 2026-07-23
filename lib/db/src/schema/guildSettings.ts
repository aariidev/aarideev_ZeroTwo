import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  int,
} from "drizzle-orm/mysql-core";

export const guildLogSettingsTable = mysqlTable("guild_log_settings", {
  guildId: varchar("guild_id", { length: 32 }).primaryKey(),
  channelId: varchar("channel_id", { length: 32 }),
  events: text("events").notNull(),
  ignoreBots: boolean("ignore_bots").notNull().default(true),
  ignoreWebhooks: boolean("ignore_webhooks").notNull().default(true),
  ignoreChannels: text("ignore_channels").notNull(),
  joinAlertDays: int("join_alert_days").notNull().default(7),
  includeAttachments: boolean("include_attachments").notNull().default(true),
  pingRoleId: varchar("ping_role_id", { length: 32 }),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const guildTicketSettingsTable = mysqlTable("guild_ticket_settings", {
  guildId: varchar("guild_id", { length: 32 }).primaryKey(),
  categoryId: varchar("category_id", { length: 32 }),
  /** Primary staff role (legacy compat). Kept for JOIN display. */
  staffRoleId: varchar("staff_role_id", { length: 32 }),
  /** JSON array of role IDs that count as staff. Superset of staffRoleId. */
  staffRoleIds: text("staff_role_ids").notNull().default("[]"),
  logChannelId: varchar("log_channel_id", { length: 32 }),
  maxOpen: int("max_open").notNull().default(1),
  deleteAfterCloseSec: int("delete_after_close_sec").notNull().default(10),
  panelTitle: varchar("panel_title", { length: 150 }).notNull().default("🎫 Centro de Tickets"),
  panelDescription: text("panel_description").notNull().default(""),
  /**
   * Who can close tickets.
   * "staff_only" | "owner_only" | "both" (default) | "staff_and_owner"
   */
  closePolicy: varchar("close_policy", { length: 32 }).notNull().default("both"),
  /**
   * Who can claim tickets.
   * "staff_only" (default) | "anyone"
   */
  claimPolicy: varchar("claim_policy", { length: 32 }).notNull().default("staff_only"),
  /**
   * Template for ticket channel name.
   * Vars: {username} {userid4} {category} {number}
   * Default: "ticket-{username}-{userid4}"
   */
  channelNameFormat: varchar("channel_name_format", { length: 80 }).notNull().default("ticket-{username}-{userid4}"),
  /** Welcome message sent inside the ticket channel. Supports {user} {category} {subject}. */
  welcomeMessage: text("welcome_message").notNull().default(""),
  /**
   * JSON array of custom category objects:
   * [{ id, label, emoji, description, staffRoleIds?: string[] }]
   * Empty = use built-in defaults.
   */
  customCategories: text("custom_categories").notNull().default("[]"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const appSettingsTable = mysqlTable("app_settings", {
  key: varchar("key", { length: 191 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/** Persistent music control panel per guild (channel + message to edit). */
export const guildMusicSettingsTable = mysqlTable("guild_music_settings", {
  guildId: varchar("guild_id", { length: 32 }).primaryKey(),
  channelId: varchar("channel_id", { length: 32 }),
  messageId: varchar("message_id", { length: 32 }),
  /** Optional role allowed to control music (null = anyone in the voice channel). */
  djRoleId: varchar("dj_role_id", { length: 32 }),
  /**
   * When true, Zero Two is the primary music bot: disconnects other bots
   * from the same voice channel while she is connected.
   */
  capOtherBots: boolean("cap_other_bots").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * Snapshot of an active music session so it can be resumed after bot restart.
 * payload JSON: { current, queue, history, volume, loop, voiceChannelId, textChannelId, playbackSec }
 */
export const musicSessionsTable = mysqlTable("music_sessions", {
  guildId: varchar("guild_id", { length: 32 }).primaryKey(),
  voiceChannelId: varchar("voice_channel_id", { length: 32 }),
  textChannelId: varchar("text_channel_id", { length: 32 }),
  payload: text("payload").notNull(),
  playbackSec: int("playback_sec").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type GuildLogSettingsRow = typeof guildLogSettingsTable.$inferSelect;
export type GuildTicketSettingsRow = typeof guildTicketSettingsTable.$inferSelect;
export type AppSettingRow = typeof appSettingsTable.$inferSelect;
export type GuildMusicSettingsRow = typeof guildMusicSettingsTable.$inferSelect;
export type MusicSessionRow = typeof musicSessionsTable.$inferSelect;
