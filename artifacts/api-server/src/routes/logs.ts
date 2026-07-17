import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { logsTable } from "@workspace/db";
import { desc, eq, and, or, like, inArray } from "drizzle-orm";
import { getBotClient } from "./bot.js";
import {
  dataScopeGuildIds,
  isBotOwner,
  resolveGuildAccess,
} from "../lib/guildAccess.js";

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
    const access = await resolveGuildAccess(req, getBotClient());
    const scope = dataScopeGuildIds(access);

    // Non-owners with no manageable guilds: empty (don't leak global bot logs)
    if (!access.isOwner && scope.size === 0) {
      return res.status(200).json([]);
    }

    let query = db
      .select()
      .from(logsTable)
      .orderBy(desc(logsTable.createdAt))
      .limit(maxLimit)
      .$dynamic();

    const conditions = [];
    if (level) conditions.push(eq(logsTable.level, level));
    if (event) conditions.push(eq(logsTable.event, event));

    if (guildId) {
      if (!access.isOwner && !scope.has(guildId)) {
        return res.status(200).json([]);
      }
      conditions.push(eq(logsTable.guildId, guildId));
    } else if (!access.isOwner) {
      // Only logs for their guilds (null guild_id is owner/system-only)
      conditions.push(inArray(logsTable.guildId, [...scope]));
    }

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

    // System logs without guild — owner only
    if (!access.isOwner && !isBotOwner(req.sessionUser?.id)) {
      // already scoped by guild ids above
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
