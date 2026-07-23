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
  staffRoleId: varchar("staff_role_id", { length: 32 }),
  logChannelId: varchar("log_channel_id", { length: 32 }),
  maxOpen: int("max_open").notNull().default(1),
  deleteAfterCloseSec: int("delete_after_close_sec").notNull().default(10),
  panelTitle: varchar("panel_title", { length: 150 }).notNull(),
  panelDescription: text("panel_description").notNull(),
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
    enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type GuildLogSettingsRow = typeof guildLogSettingsTable.$inferSelect;
export type GuildTicketSettingsRow = typeof guildTicketSettingsTable.$inferSelect;
export type AppSettingRow = typeof appSettingsTable.$inferSelect;
export type GuildMusicSettingsRow = typeof guildMusicSettingsTable.$inferSelect;
