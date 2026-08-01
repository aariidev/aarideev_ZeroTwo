/**
 * Persist Discord messages to MySQL so logs don't depend on discord.js cache.
 * New messages are indexed live; historical messages via backfillGuildHistory.
 */
import {
  db,
  messageSnapshotsTable,
  type MessageSnapshot,
} from "@workspace/db";
import { count, eq, inArray, lt } from "drizzle-orm";
import {
  ChannelType,
  type Guild,
  type Message,
  type PartialMessage,
  type TextChannel,
} from "discord.js";
import { logger } from "../../lib/logger.js";

const MAX_CONTENT = 3500;
/** Keep snapshots this long (days) for delete/edit reconstruction */
const RETENTION_DAYS = 30;
const PRUNE_EVERY_MS = 30 * 60 * 1000;
/** Default / hard caps for history backfill */
export const BACKFILL_DEFAULT_PER_CHANNEL = 1_000;
export const BACKFILL_MAX_PER_CHANNEL = 5_000;
/** Delay between Discord fetch pages (rate-limit friendly) */
const FETCH_PAGE_DELAY_MS = 350;
const CHANNEL_DELAY_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

type SnapshotInsert = {
  messageId: string;
  guildId: string;
  channelId: string;
  authorId: string;
  authorTag: string;
  authorBot: boolean;
  content: string;
  attachments: string;
  stickers: string;
  embedCount: number;
  webhookId: string | null;
  messageCreatedAt: Date;
  messageUpdatedAt: Date;
  indexedAt: Date;
};

function messageToInsert(
  message: Message | PartialMessage,
): SnapshotInsert | null {
  if (!message.guildId || !message.channelId || !message.id) return null;
  if (!message.author && !message.webhookId) return null;
  // System messages without useful payload still ok if author exists
  if (message.system && !message.content && !message.attachments?.size) {
    return null;
  }
  const content = (message.content ?? "").slice(0, MAX_CONTENT);
  const now = new Date();
  const created =
    message.createdAt instanceof Date ? message.createdAt : now;
  const updated =
    "editedAt" in message && message.editedAt instanceof Date
      ? message.editedAt
      : created;

  return {
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
  };
}

async function upsertSnapshots(rows: SnapshotInsert[]): Promise<number> {
  if (!rows.length) return 0;
  // Upsert one-by-one in small parallel waves (MySQL-safe, rate-friendly)
  const wave = 8;
  let n = 0;
  for (let i = 0; i < rows.length; i += wave) {
    const slice = rows.slice(i, i + wave);
    await Promise.all(
      slice.map((row) =>
        db
          .insert(messageSnapshotsTable)
          .values(row)
          .onDuplicateKeyUpdate({
            set: {
              content: row.content,
              attachments: row.attachments,
              stickers: row.stickers,
              embedCount: row.embedCount,
              authorTag: row.authorTag,
              authorBot: row.authorBot,
              messageUpdatedAt: row.messageUpdatedAt,
              indexedAt: row.indexedAt,
            },
          }),
      ),
    );
    n += slice.length;
  }
  return n;
}

/** Index a message (create or update content). Fire-and-forget safe. */
export async function indexMessage(
  message: Message | PartialMessage,
): Promise<void> {
  try {
    const row = messageToInsert(message);
    if (!row) return;
    await upsertSnapshots([row]);
  } catch (err) {
    logger.warn({ err, id: message.id }, "messageStore.indexMessage failed");
  }
}

/**
 * Fetch up to `maxMessages` from a text channel (newest first) and store them.
 */
export async function backfillChannelHistory(
  channel: TextChannel,
  maxMessages = BACKFILL_DEFAULT_PER_CHANNEL,
): Promise<{ scanned: number; indexed: number }> {
  const limit = Math.max(
    1,
    Math.min(BACKFILL_MAX_PER_CHANNEL, Math.floor(maxMessages)),
  );
  let scanned = 0;
  let indexed = 0;
  let before: string | undefined;

  while (scanned < limit) {
    const pageSize = Math.min(100, limit - scanned);
    const batch = await channel.messages
      .fetch({ limit: pageSize, ...(before ? { before } : {}) })
      .catch((err) => {
        logger.debug(
          { err, channelId: channel.id },
          "messageStore: fetch page failed",
        );
        return null;
      });

    if (!batch || batch.size === 0) break;

    const rows: SnapshotInsert[] = [];
    const sorted = [...batch.values()].sort(
      (a, b) => b.createdTimestamp - a.createdTimestamp,
    );
    for (const msg of sorted) {
      const row = messageToInsert(msg);
      if (row) rows.push(row);
    }
    indexed += await upsertSnapshots(rows);
    scanned += batch.size;

    const oldest = sorted[sorted.length - 1];
    if (!oldest || batch.size < pageSize) break;
    before = oldest.id;
    await sleep(FETCH_PAGE_DELAY_MS);
  }

  return { scanned, indexed };
}

export type GuildBackfillResult = {
  channels: number;
  scanned: number;
  indexed: number;
  errors: string[];
  perChannel: { id: string; name: string; scanned: number; indexed: number }[];
};

/**
 * Index historical messages across guild text/announcement channels.
 * Rate-limited to respect Discord API.
 */
export async function backfillGuildHistory(
  guild: Guild,
  opts?: {
    maxPerChannel?: number;
    channelIds?: string[];
    onProgress?: (info: {
      channelName: string;
      done: number;
      total: number;
    }) => void;
  },
): Promise<GuildBackfillResult> {
  const maxPer = Math.max(
    1,
    Math.min(
      BACKFILL_MAX_PER_CHANNEL,
      opts?.maxPerChannel ?? BACKFILL_DEFAULT_PER_CHANNEL,
    ),
  );

  await guild.channels.fetch().catch(() => null);

  const candidates = [...guild.channels.cache.values()].filter((ch) => {
    if (opts?.channelIds?.length && !opts.channelIds.includes(ch.id)) {
      return false;
    }
    if (
      ch.type !== ChannelType.GuildText &&
      ch.type !== ChannelType.GuildAnnouncement
    ) {
      return false;
    }
    // Must be text-based with messages manager
    return "messages" in ch;
  }) as TextChannel[];

  // Prefer channels the bot can read
  const me = guild.members.me;
  const readable = candidates.filter((ch) => {
    if (!me) return true;
    const perms = ch.permissionsFor(me);
    return perms?.has("ViewChannel") && perms?.has("ReadMessageHistory");
  });

  const result: GuildBackfillResult = {
    channels: 0,
    scanned: 0,
    indexed: 0,
    errors: [],
    perChannel: [],
  };

  let done = 0;
  for (const ch of readable) {
    done++;
    opts?.onProgress?.({
      channelName: ch.name,
      done,
      total: readable.length,
    });
    try {
      const r = await backfillChannelHistory(ch, maxPer);
      result.channels++;
      result.scanned += r.scanned;
      result.indexed += r.indexed;
      result.perChannel.push({
        id: ch.id,
        name: ch.name,
        scanned: r.scanned,
        indexed: r.indexed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`#${ch.name}: ${msg}`);
      logger.warn({ err, channelId: ch.id }, "backfill channel failed");
    }
    await sleep(CHANNEL_DELAY_MS);
  }

  logger.info(
    {
      guildId: guild.id,
      channels: result.channels,
      scanned: result.scanned,
      indexed: result.indexed,
      maxPer,
    },
    "messageStore: guild backfill done",
  );

  return result;
}

/** Count snapshots for a guild. */
export async function countGuildSnapshots(guildId: string): Promise<number> {
  try {
    const rows = await db
      .select({ c: count() })
      .from(messageSnapshotsTable)
      .where(eq(messageSnapshotsTable.guildId, guildId));
    return Number(rows[0]?.c ?? 0);
  } catch {
    return 0;
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
