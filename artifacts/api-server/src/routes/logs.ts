import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { logsTable } from "@workspace/db";
import { desc, eq, and, or, like } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      level,
      event,
      guildId,
      limit = "100",
      search,
    } = req.query as Record<string, string>;

    const maxLimit = Math.min(parseInt(limit, 10) || 100, 500);

    let query = db
      .select()
      .from(logsTable)
      .orderBy(desc(logsTable.createdAt))
      .limit(maxLimit)
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
        )!,
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const logs = await query;

    res.status(200).json(
      logs.map((l) => ({
        ...l,
        details: (() => {
          try {
            return typeof l.details === "string"
              ? JSON.parse(l.details)
              : l.details;
          } catch {
            return l.details;
          }
        })(),
        createdAt: l.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log?.error({ err }, "❌ Error consultando logs del sistema");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
