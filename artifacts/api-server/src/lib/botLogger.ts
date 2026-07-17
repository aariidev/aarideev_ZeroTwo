import { db } from "@workspace/db";
import { logsTable } from "@workspace/db";
import { logger } from "./logger.js";

export type LogLevel = "info" | "warn" | "error";

export type LogEvent =
  | "ban"
  | "kick"
  | "warn"
  | "timeout"
  | "untimeout"
  | "unban"
  | "lock"
  | "unlock"
  | "slowmode"
  | "purge"
  | "command_used"
  | "system_startup"
  | "system_error"
  | "config_change"
  | "message_delete"
  | "message_edit"
  | "message_bulk_delete"
  | "member_join"
  | "member_leave"
  | "member_roles"
  | "member_nickname"
  | "channel_create"
  | "channel_delete"
  | "role_create"
  | "role_delete"
  | "invite_create"
  | "invite_delete"
  | "voice_join"
  | "voice_leave"
  | "voice_move";

export interface LogEntry {
  level?: LogLevel;
  event: LogEvent;
  details?: Record<string, unknown>;
  guildId?: string | null;
  guildName?: string | null;
  userId?: string | null;
  username?: string | null;
  moderatorId?: string | null;
  moderatorName?: string | null;
}

const logQueue: Array<{
  level: LogLevel;
  event: LogEvent;
  details: string;
  guildId: string | null;
  guildName: string | null;
  userId: string | null;
  username: string | null;
  moderatorId: string | null;
  moderatorName: string | null;
}> = [];

const BATCH_INTERVAL_MS = 2500;
const MAX_BATCH_SIZE = 100;
let isProcessing = false;
let flushTimer: NodeJS.Timeout | null = null;

export function logBotEvent(entry: LogEntry): void {
  logQueue.push({
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

  if (logQueue.length >= MAX_BATCH_SIZE) {
    processQueue().catch((err) =>
      logger.error(
        { err },
        "❌ Error crítico en despacho forzado por tamaño máximo",
      ),
    );
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      processQueue().catch((err) =>
        logger.error({ err }, "❌ Error en el ciclo periódico de logs"),
      );
    }, BATCH_INTERVAL_MS);
  }
}

async function processQueue(): Promise<void> {
  if (isProcessing || logQueue.length === 0) return;
  isProcessing = true;

  const recordsToInsert = logQueue.splice(0, logQueue.length);

  try {
    await db.insert(logsTable).values(recordsToInsert);
  } catch (err) {
    logger.error(
      { err, totalLostRecords: recordsToInsert.length },
      "🚨 Fallo de persistencia en Base de Datos. Ejecutando volcado de emergencia a Consola Local (Pino)...",
    );

    for (const record of recordsToInsert) {
      logger.warn(
        {
          bot_event: record.event,
          guild: record.guildName,
          mod: record.moderatorName,
          meta: record.details,
        },
        `[EMERGENCY LOG BACKUP] [${record.level.toUpperCase()}] Evento perdiendo persistencia`,
      );
    }
  } finally {
    isProcessing = false;

    if (logQueue.length > 0 && !flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        processQueue().catch((e) =>
          logger.error({ err: e }, "❌ Error reactivando cola residual"),
        );
      }, BATCH_INTERVAL_MS);
    }
  }
}

export async function flushAllLogs(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (logQueue.length > 0) {
    logger.info(
      `🧹 Vaciando buffer residual de logs antes de apagar (${logQueue.length} restantes)...`,
    );
    await processQueue();
  }
}
