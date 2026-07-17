import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { warnsTable } from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import {
  CreateWarnBody,
  ListWarnsQueryParams,
  DeleteWarnParams,
} from "@workspace/api-zod";
import { getBotClient } from "./bot.js";
import {
  dataScopeGuildIds,
  resolveGuildAccess,
} from "../lib/guildAccess.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const query = ListWarnsQueryParams.parse(req.query);
    const access = await resolveGuildAccess(req, getBotClient());
    const scope = dataScopeGuildIds(access);

    if (scope.size === 0) {
      return res.status(200).json([]);
    }

    const conditions = [];
    if (query.guildId) {
      if (!scope.has(query.guildId)) {
        return res.status(200).json([]);
      }
      conditions.push(eq(warnsTable.guildId, query.guildId));
    } else {
      conditions.push(inArray(warnsTable.guildId, [...scope]));
    }
    if (query.userId) conditions.push(eq(warnsTable.userId, query.userId));

    let dbQuery = db
      .select()
      .from(warnsTable)
      .orderBy(desc(warnsTable.createdAt))
      .$dynamic();

    if (conditions.length > 0) {
      dbQuery = dbQuery.where(and(...conditions));
    }

    const results = await dbQuery;

    res.status(200).json(
      results.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log?.error(
      { err },
      "❌ Error listando advertencias de la base de datos",
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateWarnBody.parse(req.body);
    const access = await resolveGuildAccess(req, getBotClient());
    if (!access.manageGuildIds.has(body.guildId)) {
      return res.status(403).json({
        error: "No puedes crear warns en este servidor desde el dashboard.",
      });
    }

    const ids = await db.insert(warnsTable).values(body).$returningId();
    const newId = ids[0]?.id;
    const [warn] = newId
      ? await db.select().from(warnsTable).where(eq(warnsTable.id, newId)).limit(1)
      : [];

    res.status(201).json({
      ...warn,
      createdAt: warn?.createdAt.toISOString(),
    });
  } catch (err) {
    req.log?.error({ err }, "❌ Error al inyectar nueva advertencia");
    res.status(400).json({ error: "Invalid request payload" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = DeleteWarnParams.parse(req.params);

    const existing = await db
      .select()
      .from(warnsTable)
      .where(eq(warnsTable.id, id))
      .limit(1);

    if (!existing[0]) {
      return res.status(404).json({ error: "Warn record not found" });
    }

    const access = await resolveGuildAccess(req, getBotClient());
    if (!access.manageGuildIds.has(existing[0].guildId)) {
      return res.status(403).json({
        error: "No puedes eliminar warns de este servidor.",
      });
    }

    await db.delete(warnsTable).where(eq(warnsTable.id, id));

    res.status(200).json({ success: true, deletedId: id });
  } catch (err) {
    req.log?.error({ err }, "❌ Error al eliminar el registro de advertencia");
    res.status(400).json({ error: "Invalid parameters" });
  }
});

export default router;
