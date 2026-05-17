import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { warnsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  CreateWarnBody,
  ListWarnsQueryParams,
  DeleteWarnParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const query = ListWarnsQueryParams.parse(req.query);

    let dbQuery = db
      .select()
      .from(warnsTable)
      .orderBy(desc(warnsTable.createdAt))
      .$dynamic();

    const conditions = [];
    if (query.guildId) conditions.push(eq(warnsTable.guildId, query.guildId));
    if (query.userId) conditions.push(eq(warnsTable.userId, query.userId));

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

    const [warn] = await db.insert(warnsTable).values(body).returning();

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

    const [deleted] = await db
      .delete(warnsTable)
      .where(eq(warnsTable.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Warn record not found" });
    }

    res.status(200).json({ success: true, deletedId: id });
  } catch (err) {
    req.log?.error({ err }, "❌ Error al eliminar el registro de advertencia");
    res.status(400).json({ error: "Invalid parameters" });
  }
});

export default router;
