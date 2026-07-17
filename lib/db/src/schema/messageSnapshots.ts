import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  int,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Recent message snapshots for server logs.
 * Discord cache is incomplete on delete — we read content/author from MySQL.
 */
export const messageSnapshotsTable = mysqlTable(
  "message_snapshots",
  {
    messageId: varchar("message_id", { length: 32 }).primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    channelId: varchar("channel_id", { length: 32 }).notNull(),
    authorId: varchar("author_id", { length: 32 }).notNull(),
    authorTag: varchar("author_tag", { length: 120 }).notNull(),
    authorBot: boolean("author_bot").notNull().default(false),
    content: text("content").notNull(),
    /** JSON: [{ name, url, proxyUrl, size, contentType }] */
    attachments: text("attachments").notNull(),
    /** JSON: string[] sticker names */
    stickers: text("stickers").notNull(),
    embedCount: int("embed_count").notNull().default(0),
    webhookId: varchar("webhook_id", { length: 32 }),
    /** When the Discord message was created */
    messageCreatedAt: timestamp("message_created_at").notNull(),
    /** Last content edit we saw */
    messageUpdatedAt: timestamp("message_updated_at").notNull(),
    /** When we wrote/updated this row */
    indexedAt: timestamp("indexed_at").notNull(),
  },
  (t) => [
    index("msg_snap_guild_ch").on(t.guildId, t.channelId),
    index("msg_snap_author").on(t.authorId),
    index("msg_snap_indexed").on(t.indexedAt),
  ],
);

export type MessageSnapshot = typeof messageSnapshotsTable.$inferSelect;
