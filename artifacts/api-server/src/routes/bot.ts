import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { activityTable } from "@workspace/db";
import { count } from "drizzle-orm";
import type { Client } from "discord.js";

const router = Router();

let botClient: Client | null = null;
let botStartTime = Date.now();
let totalCommandsExecuted = 0;

export function setBotClient(client: Client) {
  botClient = client;
  botStartTime = Date.now();
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

    res.status(200).json({
      guildCount,
      userCount,
      commandsExecuted: Number(cmdCountResult?.total ?? totalCommandsExecuted),
      uptime,
      ping,
      botName,
      botAvatar,
      version: "2.2.0",
    });
  } catch (err) {
    req.log?.error({ err }, "❌ Error crítico obteniendo estadísticas del bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
