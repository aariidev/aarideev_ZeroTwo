import { db } from "@workspace/db";
import { logsTable } from "@workspace/db";
import { logger } from "./logger.js";

interface LogEntry {
  level?: "info" | "warn" | "error";
  event: string;
  details?: Record<string, unknown>;
  guildId?: string;
  guildName?: string;
  userId?: string;
  username?: string;
  moderatorId?: string;
  moderatorName?: string;
}

export async function logBotEvent(entry: LogEntry): Promise<void> {
  try {
    await db.insert(logsTable).values({
      level: entry.level ?? "info",
      event: entry.event,
      details: JSON.stringify(entry.details ?? {}),
      guildId: entry.guildId ?? null,
      guildName: entry.guildName ?? null,
      userId: entry.userId ?? null,
      username: entry.username ?? null,
      moderatorId: entry.moderatorId ?? null,
      moderatorName: entry.moderatorName ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Error writing to bot_logs");
  }
}
