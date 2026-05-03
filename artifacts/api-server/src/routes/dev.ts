import { Router, Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { botConfigTable, changelogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { devState } from "../lib/devState.js";
import { EmbedBuilder, TextChannel } from "discord.js";

const router = Router();

const DEV_USER_ID = "819080793447333918";

let botClient: import("discord.js").Client | null = null;

export function setBotClientForDev(client: import("discord.js").Client) {
  botClient = client;
}

// Auth middleware — validates X-Dev-Token header against DEV_TOKEN env var
function requireDevAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-dev-token"];
  const expected = process.env.DEV_TOKEN;

  if (!expected) {
    req.log.error("DEV_TOKEN env var not set — dev panel is disabled");
    return res.status(503).json({ error: "Dev panel not configured. Set DEV_TOKEN env var." });
  }

  if (!token || token !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

// GET /api/dev/status — overall dev panel status
router.get("/status", requireDevAuth, async (req, res) => {
  try {
    const rows = await db.select().from(botConfigTable);
    const config: Record<string, string> = {};
    for (const row of rows) config[row.key] = row.value;

    res.json({
      devUserId: DEV_USER_ID,
      maintenanceMode: devState.maintenanceMode,
      maintenanceMessage: devState.maintenanceMessage,
      botOnline: botClient !== null,
      guildsCount: botClient?.guilds.cache.size ?? 0,
      config,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting dev status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/dev/maintenance — toggle or set maintenance mode
router.post("/maintenance", requireDevAuth, async (req, res) => {
  try {
    const { enabled, message } = req.body as { enabled: boolean; message?: string };

    devState.maintenanceMode = Boolean(enabled);
    if (message) devState.maintenanceMessage = message;

    // Persist to DB
    await db
      .insert(botConfigTable)
      .values({ key: "maintenance_mode", value: String(devState.maintenanceMode), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: botConfigTable.key,
        set: { value: String(devState.maintenanceMode), updatedAt: new Date() },
      });

    if (message) {
      await db
        .insert(botConfigTable)
        .values({ key: "maintenance_message", value: message, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: botConfigTable.key,
          set: { value: message, updatedAt: new Date() },
        });
    }

    req.log.info({ maintenanceMode: devState.maintenanceMode }, "Maintenance mode updated");
    res.json({ maintenanceMode: devState.maintenanceMode, maintenanceMessage: devState.maintenanceMessage });
  } catch (err) {
    req.log.error({ err }, "Error setting maintenance mode");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/dev/announce — broadcast embed message to all guilds
router.post("/announce", requireDevAuth, async (req, res) => {
  try {
    const { title, message, color } = req.body as { title: string; message: string; color?: string };

    if (!botClient) {
      return res.status(503).json({ error: "Bot is not online" });
    }

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "title and message are required" });
    }

    const hexColor = color ? parseInt(color.replace("#", ""), 16) : 0xff2d6b;

    const embed = new EmbedBuilder()
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setColor(hexColor)
      .setTimestamp()
      .setFooter({ text: "ZeroTwo System · Dev Broadcast" });

    let sent = 0;
    let failed = 0;

    const guilds = botClient.guilds.cache.values();
    for (const guild of guilds) {
      try {
        const channel =
          guild.systemChannel ??
          guild.channels.cache.find(
            (c) => c.isTextBased() && !c.isDMBased() && (c as TextChannel).permissionsFor(guild.members.me!)?.has("SendMessages"),
          ) as TextChannel | undefined;

        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: [embed] });
          sent++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    req.log.info({ sent, failed }, "Announcement broadcast complete");
    res.json({ sent, failed, total: sent + failed });
  } catch (err) {
    req.log.error({ err }, "Error broadcasting announcement");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/dev/restart — graceful bot reconnect
router.post("/restart", requireDevAuth, async (req, res) => {
  if (!botClient) {
    return res.status(503).json({ error: "Bot is not connected" });
  }
  if (!process.env.DISCORD_TOKEN) {
    return res.status(503).json({ error: "DISCORD_TOKEN not configured" });
  }

  req.log.warn("Bot restart requested via dev panel");
  res.json({ message: "Bot restart initiated. Reconnecting in ~3s." });

  // Capture refs before async work
  const client = botClient;
  const token = process.env.DISCORD_TOKEN;

  setImmediate(async () => {
    try {
      client.destroy();
      botClient = null;
      await new Promise((r) => setTimeout(r, 3000));
      await client.login(token);
      botClient = client;
      req.log.info("Bot reconnected after restart");
    } catch (err) {
      req.log.error({ err }, "Error during bot restart");
    }
  });
});

// GET /api/dev/changelogs
router.get("/changelogs", requireDevAuth, async (req, res) => {
  try {
    const logs = await db
      .select()
      .from(changelogsTable)
      .orderBy(desc(changelogsTable.createdAt))
      .limit(50);

    res.json(logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error listing changelogs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/dev/changelogs
router.post("/changelogs", requireDevAuth, async (req, res) => {
  try {
    const { version, title, description, type } = req.body as {
      version: string;
      title: string;
      description: string;
      type: string;
    };

    if (!version?.trim() || !title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: "version, title and description are required" });
    }

    const validTypes = ["feature", "fix", "improvement", "breaking"];
    const entryType = validTypes.includes(type) ? type : "feature";

    const [entry] = await db
      .insert(changelogsTable)
      .values({ version: version.trim(), title: title.trim(), description: description.trim(), type: entryType })
      .returning();

    res.status(201).json({ ...entry, createdAt: entry.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating changelog");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/dev/changelogs/:id
router.delete("/changelogs/:id", requireDevAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [deleted] = await db
      .delete(changelogsTable)
      .where(eq(changelogsTable.id, id))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Not found" });

    res.json({ ...deleted, createdAt: deleted.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error deleting changelog");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
