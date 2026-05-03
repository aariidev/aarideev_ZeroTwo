import { Router } from "express";
import { db } from "@workspace/db";
import { logsTable } from "@workspace/db";
import { desc, eq, and, or, like } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { level, event, guildId, limit = "100", search } = req.query as Record<string, string>;

    let query = db
      .select()
      .from(logsTable)
      .orderBy(desc(logsTable.createdAt))
      .limit(Math.min(parseInt(limit) || 100, 500))
      .$dynamic();

    const conditions = [];
    if (level) conditions.push(eq(logsTable.level, level));
    if (event) conditions.push(eq(logsTable.event, event));
    if (guildId) conditions.push(eq(logsTable.guildId, guildId));
    if (search) {
      conditions.push(
        or(
          like(logsTable.username, `%${search}%`),
          like(logsTable.moderatorName, `%${search}%`),
          like(logsTable.guildName, `%${search}%`),
          like(logsTable.event, `%${search}%`),
        )!
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const logs = await query;

    res.json(
      logs.map((l) => ({
        ...l,
        details: (() => { try { return JSON.parse(l.details); } catch { return {}; } })(),
        createdAt: l.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error getting logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
