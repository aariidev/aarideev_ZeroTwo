import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { activityTable } from "@workspace/db";
import { count, desc } from "drizzle-orm";
import type { Client } from "discord.js";

const router = Router();

let botClient: Client | null = null;
let botStartTime = Date.now();
let totalCommandsExecuted = 0;

export function setBotClient(client: Client) {
  botClient = client;
  botStartTime = Date.now();
}

export function getBotClient(): Client | null {
  return botClient;
}

/** Public bot preview (login screen, status widgets) */
export function getBotPublicInfo() {
  const ready = Boolean(botClient?.isReady?.() && botClient?.user);
  const ping = botClient?.ws.ping ?? -1;
  return {
    botName: botClient?.user?.username ?? "ZeroTwo",
    botTag: botClient?.user?.tag ?? null,
    botAvatar: botClient?.user?.displayAvatarURL({ size: 256 }) ?? null,
    online: ready,
    ping: ready && ping < 0 ? 0 : ping,
    guildCount: botClient?.guilds.cache.size ?? 0,
    version: "2.3.0",
  };
}

export function incrementCommands() {
  totalCommandsExecuted++;
}

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const [cmdCountResult] = await db
      .select({ total: count() })
      .from(activityTable);

    const guildCount = botClient?.guilds.cache.size ?? 0;
    const userCount = botClient?.users.cache.size ?? 0;
    const uptime = (Date.now() - botStartTime) / 1000;
    const ping = botClient?.ws.ping ?? -1;
    const botName = botClient?.user?.username ?? "ZeroTwo";
    const botAvatar = botClient?.user?.displayAvatarURL({ size: 128 }) ?? null;

    const ready = Boolean(botClient?.isReady?.() && botClient?.user);
    res.status(200).json({
      guildCount,
      userCount,
      commandsExecuted: Number(cmdCountResult?.total ?? totalCommandsExecuted),
      uptime,
      // When WS is still connecting, discord.js can report -1 even if process is up.
      // Prefer a non-negative sentinel once the client is ready so the dashboard stays in sync.
      ping: ready && ping < 0 ? 0 : ping,
      botName,
      botAvatar,
      botTag: botClient?.user?.tag ?? null,
      online: ready,
      version: "2.3.0",
    });
  } catch (err) {
    req.log?.error({ err }, "❌ Error crítico obteniendo estadísticas del bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/activity", async (req: Request, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit ?? 40);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
      : 40;

    const rows = await db
      .select()
      .from(activityTable)
      .orderBy(desc(activityTable.executedAt))
      .limit(limit);

    res.status(200).json(
      rows.map((row) => ({
        id: row.id,
        command: row.command,
        userId: row.userId,
        username: row.username,
        guildId: row.guildId,
        guildName: row.guildName,
        executedAt:
          row.executedAt instanceof Date
            ? row.executedAt.toISOString()
            : String(row.executedAt),
        success: row.success,
      })),
    );
  } catch (err) {
    req.log?.error({ err }, "❌ Error obteniendo actividad reciente del bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
