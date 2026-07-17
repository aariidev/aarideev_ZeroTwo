/**
 * Centralized warn persistence (MySQL / HeidiSQL zerotwo).
 * Always verifies writes so the dashboard & slash commands stay in sync.
 */
import { db, warnsTable, type Warn } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export type NewWarnInput = {
  guildId: string;
  userId: string;
  username: string;
  moderatorId: string;
  moderatorName: string;
  reason: string;
};

export async function addWarn(input: NewWarnInput): Promise<Warn> {
  const reason = input.reason.trim().slice(0, 1000) || "Sin motivo";
  const createdAt = new Date();

  const ids = await db
    .insert(warnsTable)
    .values({
      guildId: input.guildId,
      userId: input.userId,
      username: input.username.slice(0, 100),
      moderatorId: input.moderatorId,
      moderatorName: input.moderatorName.slice(0, 100),
      reason,
      createdAt,
    })
    .$returningId();

  const id = ids[0]?.id;

  if (id != null) {
    const [row] = await db
      .select()
      .from(warnsTable)
      .where(eq(warnsTable.id, id))
      .limit(1);
    if (row) return row;
  }

  // Verify by re-read (if $returningId was empty but row exists)
  const [latest] = await db
    .select()
    .from(warnsTable)
    .where(
      and(
        eq(warnsTable.guildId, input.guildId),
        eq(warnsTable.userId, input.userId),
      ),
    )
    .orderBy(desc(warnsTable.id))
    .limit(1);

  if (
    latest &&
    latest.reason === reason &&
    latest.moderatorId === input.moderatorId &&
    Math.abs(latest.createdAt.getTime() - createdAt.getTime()) < 15_000
  ) {
    return latest;
  }

  logger.error({ input, ids }, "addWarn: insert produced no readable row");
  throw new Error(
    "No se pudo guardar la advertencia en la base de datos (zerotwo).",
  );
}

export async function listWarns(
  guildId: string,
  userId: string,
): Promise<Warn[]> {
  return db
    .select()
    .from(warnsTable)
    .where(and(eq(warnsTable.guildId, guildId), eq(warnsTable.userId, userId)))
    .orderBy(desc(warnsTable.createdAt), desc(warnsTable.id));
}

export async function countWarns(
  guildId: string,
  userId: string,
): Promise<number> {
  const rows = await listWarns(guildId, userId);
  return rows.length;
}

export async function clearWarns(
  guildId: string,
  userId: string,
): Promise<{ cleared: number; ids: number[] }> {
  const existing = await db
    .select({ id: warnsTable.id })
    .from(warnsTable)
    .where(and(eq(warnsTable.guildId, guildId), eq(warnsTable.userId, userId)));

  if (existing.length === 0) {
    return { cleared: 0, ids: [] };
  }

  const ids = existing.map((r) => r.id);
  await db
    .delete(warnsTable)
    .where(and(eq(warnsTable.guildId, guildId), eq(warnsTable.userId, userId)));

  // Verify
  const left = await countWarns(guildId, userId);
  if (left > 0) {
    logger.warn(
      { guildId, userId, left },
      "clearWarns: rows still present after delete",
    );
  }

  return { cleared: ids.length, ids };
}

export async function deleteWarnById(
  guildId: string,
  warnId: number,
): Promise<Warn | null> {
  const [row] = await db
    .select()
    .from(warnsTable)
    .where(and(eq(warnsTable.id, warnId), eq(warnsTable.guildId, guildId)))
    .limit(1);

  if (!row) return null;

  await db
    .delete(warnsTable)
    .where(and(eq(warnsTable.id, warnId), eq(warnsTable.guildId, guildId)));

  return row;
}

export function formatWarnTimestamp(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}
