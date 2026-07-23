import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ticketsTable = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  channelId: varchar("channel_id", { length: 32 }).notNull(),
  userId: varchar("user_id", { length: 32 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  category: varchar("category", { length: 32 }).notNull().default("soporte"),
  subject: text("subject"),
  status: varchar("status", { length: 16 }).notNull().default("open"),
  claimedBy: varchar("claimed_by", { length: 32 }),
  claimedByName: varchar("claimed_by_name", { length: 100 }),
  closedBy: varchar("closed_by", { length: 32 }),
  closedByName: varchar("closed_by_name", { length: 100 }),
  closeReason: text("close_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
