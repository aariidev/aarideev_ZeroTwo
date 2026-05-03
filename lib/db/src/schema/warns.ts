import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const warnsTable = pgTable("warns", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  moderatorId: text("moderator_id").notNull(),
  moderatorName: text("moderator_name").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWarnSchema = createInsertSchema(warnsTable).omit({ id: true, createdAt: true });
export type InsertWarn = z.infer<typeof insertWarnSchema>;
export type Warn = typeof warnsTable.$inferSelect;

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  command: text("command").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  guildId: text("guild_id").notNull(),
  guildName: text("guild_name").notNull(),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  success: boolean("success").notNull().default(true),
});

export const insertActivitySchema = createInsertSchema(activityTable).omit({ id: true, executedAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityTable.$inferSelect;

export const commandStatsTable = pgTable("command_stats", {
  id: serial("id").primaryKey(),
  command: text("command").notNull().unique(),
  count: integer("count").notNull().default(0),
  lastUsed: timestamp("last_used").defaultNow().notNull(),
});

export const insertCommandStatSchema = createInsertSchema(commandStatsTable).omit({ id: true });
export type InsertCommandStat = z.infer<typeof insertCommandStatSchema>;
export type CommandStat = typeof commandStatsTable.$inferSelect;

// Dev config: key-value store for bot settings
export const botConfigTable = pgTable("bot_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BotConfig = typeof botConfigTable.$inferSelect;

// Dev changelogs: update history posted from the dashboard
export const changelogsTable = pgTable("changelogs", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("feature"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChangelogSchema = createInsertSchema(changelogsTable).omit({ id: true, createdAt: true });
export type InsertChangelog = z.infer<typeof insertChangelogSchema>;
export type Changelog = typeof changelogsTable.$inferSelect;
