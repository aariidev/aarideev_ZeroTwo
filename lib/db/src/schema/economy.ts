import {
  mysqlTable,
  varchar,
  int,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const economyTable = mysqlTable(
  "economy",
  {
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    balance: int("balance").notNull().default(500),
    totalEarned: int("total_earned").notNull().default(0),
    totalLost: int("total_lost").notNull().default(0),
    gamesPlayed: int("games_played").notNull().default(0),
    gamesWon: int("games_won").notNull().default(0),
    streak: int("streak").notNull().default(0),
    lastDaily: timestamp("last_daily"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.guildId, t.userId] }),
    index("economy_guild_balance").on(t.guildId, t.balance),
  ],
);

export type Economy = typeof economyTable.$inferSelect;

export const inventoryTable = mysqlTable(
  "inventory",
  {
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    itemId: varchar("item_id", { length: 64 }).notNull(),
    quantity: int("quantity").notNull().default(1),
    acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.userId, t.itemId] })],
);

export type InventoryRow = typeof inventoryTable.$inferSelect;

export const insertEconomySchema = createInsertSchema(economyTable).omit({
  createdAt: true,
});
export type InsertEconomy = z.infer<typeof insertEconomySchema>;
