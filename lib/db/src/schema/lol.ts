import { mysqlTable, varchar, text, timestamp, int, primaryKey, index } from "drizzle-orm/mysql-core";

export const lolTrackedTable = mysqlTable(
  "lol_tracked",
  {
    id: int("id").autoincrement().primaryKey(),
    summonerId: varchar("summoner_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    region: varchar("region", { length: 8 }).notNull(),
    discordUserId: varchar("discord_user_id", { length: 32 }).notNull(),
    note: text("note"),
    lastData: text("last_data"), // JSON string of last fetched payload
    lastFetchedAt: timestamp("last_fetched_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("lol_tracked_user_idx").on(t.discordUserId),
    index("lol_tracked_summoner_idx").on(t.summonerId),
  ],
);

export type LolTracked = typeof lolTrackedTable.$inferSelect;
