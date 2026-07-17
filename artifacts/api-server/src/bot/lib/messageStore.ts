/**
 * Persist Discord messages to MySQL so logs don't depend on discord.js cache.
 */
import {
  db,
  messageSnapshotsTable,
  type MessageSnapshot,
} from "@workspace/db";
import { eq, inArray, lt } from "drizzle-orm";
import type { Message, PartialMessage } from "discord.js";
import { logger } from "../../lib/logger.js";

const MAX_CONTENT = 3500;
/** Keep snapshots this long (days) for delete/edit reconstruction */
const RETENTION_DAYS = 14;
/** Skip indexing DMs / empty system noise optionally */
const PRUNE_EVERY_MS = 30 * 60 * 1000;

export type AttachmentMeta = {
  name: string;
  url: string;
  proxyUrl?: string;
  size?: number;
  contentType?: string | null;
};

export type StoredMessage = {
  messageId: string;
  guildId: string;
  channelId: string;
  authorId: string;
  authorTag: string;
  authorBot: boolean;
  content: string;
  attachments: AttachmentMeta[];
  stickers: string[];
  embedCount: number;
  webhookId: string | null;
  messageCreatedAt: Date;
  messageUpdatedAt: Date;
};

function tagOf(msg: Message | PartialMessage): string {
  const u = msg.author;
  if (!u) return "unknown";
  return "tag" in u && u.tag ? u.tag : u.username ?? u.id;
}

function attachmentsOf(msg: Message | PartialMessage): AttachmentMeta[] {
  if (!msg.attachments?.size) return [];
  return [...msg.attachments.values()].slice(0, 15).map((a) => ({
    name: a.name ?? "file",
    url: a.url,
    proxyUrl: a.proxyURL,
    size: a.size,
    contentType: a.contentType ?? null,
  }));
}

function stickersOf(msg: Message | PartialMessage): string[] {
  if (!msg.stickers?.size) return [];
  return [...msg.stickers.values()].map((s) => s.name).slice(0, 10);
}

function rowToStored(row: MessageSnapshot): StoredMessage {
  let attachments: AttachmentMeta[] = [];
  let stickers: string[] = [];
  try {
    attachments = JSON.parse(row.attachments || "[]");
  } catch {
    /* */
  }
  try {
    stickers = JSON.parse(row.stickers || "[]");
  } catch {
    /* */
  }
  return {
    messageId: row.messageId,
    guildId: row.guildId,
    channelId: row.channelId,
    authorId: row.authorId,
    authorTag: row.authorTag,
    authorBot: Boolean(row.authorBot),
    content: row.content ?? "",
    attachments,
    stickers,
    embedCount: row.embedCount ?? 0,
    webhookId: row.webhookId,
    messageCreatedAt: row.messageCreatedAt,
    messageUpdatedAt: row.messageUpdatedAt,
  };
}

/** Index a message (create or update content). Fire-and-forget safe. */
export async function indexMessage(
  message: Message | PartialMessage,
): Promise<void> {
  try {
    if (!message.guildId || !message.channelId || !message.id) return;
    if (!message.author && !message.webhookId) return;
    // Skip pure empty system? still index for completeness if author exists
    const content = (message.content ?? "").slice(0, MAX_CONTENT);
    const now = new Date();
    const created =
      message.createdAt instanceof Date ? message.createdAt : now;
    const updated =
      "editedAt" in message && message.editedAt instanceof Date
        ? message.editedAt
        : created;

    await db
      .insert(messageSnapshotsTable)
      .values({
        messageId: message.id,
        guildId: message.guildId,
        channelId: message.channelId,
        authorId: message.author?.id ?? message.webhookId ?? "0",
        authorTag: tagOf(message).slice(0, 120),
        authorBot: Boolean(message.author?.bot || message.webhookId),
        content,
        attachments: JSON.stringify(attachmentsOf(message)),
        stickers: JSON.stringify(stickersOf(message)),
        embedCount: message.embeds?.length ?? 0,
        webhookId: message.webhookId ?? null,
        messageCreatedAt: created,
        messageUpdatedAt: updated,
        indexedAt: now,
      })
      .onDuplicateKeyUpdate({
        set: {
          content,
          attachments: JSON.stringify(attachmentsOf(message)),
          stickers: JSON.stringify(stickersOf(message)),
          embedCount: message.embeds?.length ?? 0,
          authorTag: tagOf(message).slice(0, 120),
          messageUpdatedAt: updated,
          indexedAt: now,
        },
      });
  } catch (err) {
    logger.warn({ err, id: message.id }, "messageStore.indexMessage failed");
  }
}

export async function getMessageSnapshot(
  messageId: string,
): Promise<StoredMessage | null> {
  try {
    const rows = await db
      .select()
      .from(messageSnapshotsTable)
      .where(eq(messageSnapshotsTable.messageId, messageId))
      .limit(1);
    return rows[0] ? rowToStored(rows[0]) : null;
  } catch (err) {
    logger.warn({ err, messageId }, "messageStore.get failed");
    return null;
  }
}

export async function getMessageSnapshots(
  messageIds: string[],
): Promise<Map<string, StoredMessage>> {
  const map = new Map<string, StoredMessage>();
  if (!messageIds.length) return map;
  try {
    // chunk inArray for large bulk deletes
    const chunk = 100;
    for (let i = 0; i < messageIds.length; i += chunk) {
      const slice = messageIds.slice(i, i + chunk);
      const rows = await db
        .select()
        .from(messageSnapshotsTable)
        .where(inArray(messageSnapshotsTable.messageId, slice));
      for (const r of rows) map.set(r.messageId, rowToStored(r));
    }
  } catch (err) {
    logger.warn({ err }, "messageStore.getMany failed");
  }
  return map;
}

export async function deleteMessageSnapshot(messageId: string): Promise<void> {
  try {
    await db
      .delete(messageSnapshotsTable)
      .where(eq(messageSnapshotsTable.messageId, messageId));
  } catch {
    /* ignore */
  }
}

export async function deleteMessageSnapshots(
  messageIds: string[],
): Promise<void> {
  if (!messageIds.length) return;
  try {
    const chunk = 100;
    for (let i = 0; i < messageIds.length; i += chunk) {
      const slice = messageIds.slice(i, i + chunk);
      await db
        .delete(messageSnapshotsTable)
        .where(inArray(messageSnapshotsTable.messageId, slice));
    }
  } catch (err) {
    logger.warn({ err }, "messageStore.deleteMany failed");
  }
}

/**
 * Merge live message + DB snapshot (DB fills gaps when partial/uncached).
 */
export async function resolveMessageData(
  message: Message | PartialMessage | null | undefined,
  messageId?: string,
): Promise<StoredMessage | null> {
  const id = message?.id ?? messageId;
  if (!id) return null;

  const snap = await getMessageSnapshot(id);

  if (!message || message.partial) {
    return snap;
  }

  // Prefer live data when available, fall back to snap fields
  const liveContent = message.content;
  const hasLiveAuthor = Boolean(message.author);

  if (!snap) {
    // Build from live only
    if (!message.guildId || !message.channelId || !hasLiveAuthor) return null;
    return {
      messageId: id,
      guildId: message.guildId,
      channelId: message.channelId,
      authorId: message.author!.id,
      authorTag: tagOf(message),
      authorBot: Boolean(message.author!.bot),
      content: liveContent ?? "",
      attachments: attachmentsOf(message),
      stickers: stickersOf(message),
      embedCount: message.embeds?.length ?? 0,
      webhookId: message.webhookId ?? null,
      messageCreatedAt: message.createdAt ?? new Date(),
      messageUpdatedAt: message.editedAt ?? message.createdAt ?? new Date(),
    };
  }

  return {
    messageId: id,
    guildId: message.guildId ?? snap.guildId,
    channelId: message.channelId ?? snap.channelId,
    authorId: message.author?.id ?? snap.authorId,
    authorTag: hasLiveAuthor ? tagOf(message) : snap.authorTag,
    authorBot: hasLiveAuthor
      ? Boolean(message.author?.bot)
      : snap.authorBot,
    content:
      liveContent !== null && liveContent !== undefined
        ? liveContent
        : snap.content,
    attachments:
      message.attachments?.size
        ? attachmentsOf(message)
        : snap.attachments,
    stickers: message.stickers?.size ? stickersOf(message) : snap.stickers,
    embedCount: message.embeds?.length ?? snap.embedCount,
    webhookId: message.webhookId ?? snap.webhookId,
    messageCreatedAt: message.createdAt ?? snap.messageCreatedAt,
    messageUpdatedAt:
      message.editedAt ?? message.createdAt ?? snap.messageUpdatedAt,
  };
}

export async function pruneOldSnapshots(): Promise<number> {
  try {
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    // MySQL delete with limit via subquery is awkward — delete by indexed_at
    await db
      .delete(messageSnapshotsTable)
      .where(lt(messageSnapshotsTable.indexedAt, cutoff));
    return 1;
  } catch (err) {
    logger.warn({ err }, "messageStore.prune failed");
    return 0;
  }
}

let pruneTimer: NodeJS.Timeout | null = null;

export function startMessageStoreMaintenance(): void {
  if (pruneTimer) return;
  // Initial delay then interval
  setTimeout(() => {
    pruneOldSnapshots().catch(() => null);
  }, 15_000);
  pruneTimer = setInterval(() => {
    pruneOldSnapshots().catch(() => null);
  }, PRUNE_EVERY_MS);
  if (typeof pruneTimer.unref === "function") pruneTimer.unref();
}
