import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const warnsTable = mysqlTable("warns", {
  id: int("id").autoincrement().primaryKey(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  userId: varchar("user_id", { length: 32 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  moderatorId: varchar("moderator_id", { length: 32 }).notNull(),
  moderatorName: varchar("moderator_name", { length: 100 }).notNull(),
  reason: text("reason").notNull(),
  // Always write createdAt from app to avoid MySQL/timezone edge cases
  createdAt: timestamp("created_at").notNull(),
});

export const insertWarnSchema = createInsertSchema(warnsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWarn = z.infer<typeof insertWarnSchema>;
export type Warn = typeof warnsTable.$inferSelect;

export const activityTable = mysqlTable("activity", {
  id: int("id").autoincrement().primaryKey(),
  command: varchar("command", { length: 64 }).notNull(),
  userId: varchar("user_id", { length: 32 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  guildName: varchar("guild_name", { length: 150 }).notNull(),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  success: boolean("success").notNull().default(true),
});

export const insertActivitySchema = createInsertSchema(activityTable).omit({
  id: true,
  executedAt: true,
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityTable.$inferSelect;

export const commandStatsTable = mysqlTable("command_stats", {
  id: int("id").autoincrement().primaryKey(),
  command: varchar("command", { length: 64 }).notNull().unique(),
  count: int("count").notNull().default(0),
  lastUsed: timestamp("last_used").defaultNow().notNull(),
});

export const insertCommandStatSchema = createInsertSchema(
  commandStatsTable,
).omit({ id: true });
export type InsertCommandStat = z.infer<typeof insertCommandStatSchema>;
export type CommandStat = typeof commandStatsTable.$inferSelect;

export const botConfigTable = mysqlTable("bot_config", {
  key: varchar("key", { length: 191 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type BotConfig = typeof botConfigTable.$inferSelect;

export const logsTable = mysqlTable("bot_logs", {
  id: int("id").autoincrement().primaryKey(),
  level: varchar("level", { length: 16 }).notNull().default("info"),
  event: varchar("event", { length: 64 }).notNull(),
  details: text("details").notNull(),
  guildId: varchar("guild_id", { length: 32 }),
  guildName: varchar("guild_name", { length: 150 }),
  userId: varchar("user_id", { length: 32 }),
  username: varchar("username", { length: 100 }),
  moderatorId: varchar("moderator_id", { length: 32 }),
  moderatorName: varchar("moderator_name", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Log = typeof logsTable.$inferSelect;

export const changelogsTable = mysqlTable("changelogs", {
  id: int("id").autoincrement().primaryKey(),
  version: varchar("version", { length: 32 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  type: varchar("type", { length: 32 }).notNull().default("feature"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChangelogSchema = createInsertSchema(changelogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertChangelog = z.infer<typeof insertChangelogSchema>;
export type Changelog = typeof changelogsTable.$inferSelect;
