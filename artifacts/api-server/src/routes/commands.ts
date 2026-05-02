import { Router } from "express";
import { db } from "@workspace/db";
import { commandStatsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const stats = await db
      .select()
      .from(commandStatsTable)
      .orderBy(desc(commandStatsTable.count))
      .limit(20);

    res.json(stats.map((s) => ({
      command: s.command,
      count: s.count,
      lastUsed: s.lastUsed.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting command stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
