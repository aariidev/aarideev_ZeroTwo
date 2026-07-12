import { activeGames } from "../games/blackjack.js";
import { logger } from "../../lib/logger.js";

const STALE_MS = 15 * 60 * 1000; // 15 minutes
const INTERVAL_MS = 10 * 60 * 1000; // check every 10 minutes

export function startGameCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [userId, state] of activeGames) {
      if (now - state.startedAt.getTime() > STALE_MS) {
        activeGames.delete(userId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.info(`[Cleanup] ${cleaned} partida(s) abandonada(s) eliminadas de memoria.`);
    }
  }, INTERVAL_MS);

  logger.info("[Cleanup] Limpieza automática de partidas activa (cada 10 min, TTL 15 min).");
}
