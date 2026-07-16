import { ActivityType, type Client } from "discord.js";
import { BOT_VERSION } from "./version.js";
import { logger } from "../../lib/logger.js";

/** Fixed rich presence text: /help - vX.Y.Z */
export function presenceActivityName(): string {
  return `/help - ${BOT_VERSION}`;
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Apply the single fixed rich presence on the bot user.
 * Safe to call after ready, reconnect, or Dev Panel restart.
 */
export function applyRichPresence(client: Client): void {
  if (!client.user) {
    logger.warn("applyRichPresence: client.user aún no disponible");
    return;
  }

  const name = presenceActivityName();

  client.user.setPresence({
    status: "online",
    activities: [
      {
        name,
        type: ActivityType.Playing,
      },
    ],
  });

  logger.info({ presence: name }, "🎮 Rich presence aplicada");
}

/** Keep presence sticky (Discord sometimes drops activities) */
export function startPresenceRefresh(client: Client, everyMs = 10 * 60_000): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  applyRichPresence(client);

  refreshTimer = setInterval(() => {
    try {
      if (client.isReady()) applyRichPresence(client);
    } catch (err) {
      logger.warn({ err }, "No se pudo refrescar la rich presence");
    }
  }, everyMs);

  // Don't keep the process alive solely for this timer
  if (typeof refreshTimer === "object" && "unref" in refreshTimer) {
    refreshTimer.unref();
  }
}
