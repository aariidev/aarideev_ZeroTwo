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

const BATCH_INTERVAL_MS = Number(process.env.BOT_LOG_BATCH_INTERVAL_MS ?? 2500);
const MAX_BATCH_SIZE = Number(process.env.BOT_LOG_BATCH_SIZE ?? 100);
const MAX_QUEUE_SIZE = Number(process.env.BOT_LOG_MAX_QUEUE_SIZE ?? 5000);
const MAX_DETAILS_LENGTH = Number(process.env.BOT_LOG_MAX_DETAILS_LENGTH ?? 24_000);
let isProcessing = false;
let flushTimer: NodeJS.Timeout | null = null;
let activeFlush: Promise<void> | null = null;
let droppedRecords = 0;

export function logBotEvent(entry: LogEntry): void {
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    droppedRecords += 1;
    if (droppedRecords === 1 || droppedRecords % 100 === 0) {
      logger.warn(
        {
          droppedRecords,
          maxQueueSize: MAX_QUEUE_SIZE,
          event: entry.event,
          guildId: entry.guildId,
        },
        "botLogger: cola llena, descartando eventos nuevos",
      );
    }
    return;
  }

  logQueue.push({
    level: entry.level ?? "info",
    event: entry.event,
    details: safeStringify(entry.details ?? {}),
    guildId: entry.guildId ?? null,
    guildName: entry.guildName ?? null,
    userId: entry.userId ?? null,
    username: entry.username ?? null,
    moderatorId: entry.moderatorId ?? null,
    moderatorName: entry.moderatorName ?? null,
  });

  if (logQueue.length >= MAX_BATCH_SIZE) {
    void runProcessQueue("max_batch_size");
    return;
  }

  scheduleFlush();
}

async function processQueue(): Promise<void> {
  if (isProcessing || logQueue.length === 0) return;
  isProcessing = true;

  const recordsToInsert = logQueue.splice(0, logQueue.length);

  try {
    await db.insert(logsTable).values(recordsToInsert);
    if (droppedRecords > 0) {
      logger.warn(
        { droppedRecords },
        "botLogger: eventos descartados durante presión de cola",
      );
      droppedRecords = 0;
    }
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

    if (logQueue.length > 0) {
      scheduleFlush();
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void runProcessQueue("timer");
  }, BATCH_INTERVAL_MS);
  flushTimer.unref?.();
}

async function runProcessQueue(reason: string): Promise<void> {
  if (activeFlush) return activeFlush;

  activeFlush = processQueue().catch((err) => {
    logger.error({ err, reason }, "botLogger: error procesando la cola");
  }).finally(() => {
    activeFlush = null;
  });

  return activeFlush;
}

function safeStringify(value: Record<string, unknown>): string {
  const seen = new WeakSet<object>();

  const json = JSON.stringify(value, (_key, nestedValue: unknown) => {
    if (typeof nestedValue === "bigint") return nestedValue.toString();
    if (nestedValue instanceof Error) {
      return {
        name: nestedValue.name,
        message: nestedValue.message,
        stack: nestedValue.stack,
      };
    }
    if (typeof nestedValue === "object" && nestedValue !== null) {
      if (seen.has(nestedValue)) return "[circular]";
      seen.add(nestedValue);
    }
    return nestedValue;
  });

  if (!json) return "{}";
  if (json.length <= MAX_DETAILS_LENGTH) return json;

  return JSON.stringify({
    truncated: true,
    originalLength: json.length,
    preview: json.slice(0, MAX_DETAILS_LENGTH),
  });
}

export async function flushAllLogs(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (activeFlush) {
    await activeFlush;
  }
  if (logQueue.length > 0) {
    logger.info(
      `🧹 Vaciando buffer residual de logs antes de apagar (${logQueue.length} restantes)...`,
    );
    await runProcessQueue("shutdown");
  }
  if (droppedRecords > 0) {
    logger.warn(
      { droppedRecords },
      "botLogger: apagado con eventos descartados por presión de cola",
    );
  }
}
