import { Router } from "express";
import { db } from "@workspace/db";
import { activityTable, commandStatsTable } from "@workspace/db";
import { desc, count, sql } from "drizzle-orm";

const router = Router();

let botClient: import("discord.js").Client | null = null;
let botStartTime = Date.now();
let totalCommandsExecuted = 0;

export function setBotClient(client: import("discord.js").Client) {
  botClient = client;
  botStartTime = Date.now();
}

export function incrementCommands() {
  totalCommandsExecuted++;
}

router.get("/stats", async (req, res) => {
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

    res.json({
      guildCount,
      userCount,
      commandsExecuted: Number(cmdCountResult?.total ?? 0),
      uptime,
      ping,
      botName,
      botAvatar,
      version: "2.1.0",
    });
  } catch (err) {
    req.log.error({ err }, "Error getting bot stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const activity = await db
      .select()
      .from(activityTable)
      .orderBy(desc(activityTable.executedAt))
      .limit(50);
    res.json(activity);
  } catch (err) {
    req.log.error({ err }, "Error getting activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
