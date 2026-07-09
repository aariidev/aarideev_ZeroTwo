import { pgTable, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const economyTable = pgTable(
  "economy",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    balance: integer("balance").notNull().default(500),
    totalEarned: integer("total_earned").notNull().default(0),
    totalLost: integer("total_lost").notNull().default(0),
    gamesPlayed: integer("games_played").notNull().default(0),
    gamesWon: integer("games_won").notNull().default(0),
    streak: integer("streak").notNull().default(0),
    lastDaily: timestamp("last_daily"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.userId] })],
);

export type Economy = typeof economyTable.$inferSelect;

export const inventoryTable = pgTable(
  "inventory",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id").notNull(),
    itemId: text("item_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.userId, t.itemId] })],
);

export type InventoryRow = typeof inventoryTable.$inferSelect;

export const insertEconomySchema = createInsertSchema(economyTable).omit({ createdAt: true });
export type InsertEconomy = z.infer<typeof insertEconomySchema>;
