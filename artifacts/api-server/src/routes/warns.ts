import { Router } from "express";
import { db } from "@workspace/db";
import { warnsTable, insertWarnSchema } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateWarnBody, ListWarnsQueryParams, DeleteWarnParams } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const query = ListWarnsQueryParams.parse(req.query);

    let results = await db
      .select()
      .from(warnsTable)
      .orderBy(desc(warnsTable.createdAt));

    if (query.guildId) {
      results = results.filter((w) => w.guildId === query.guildId);
    }
    if (query.userId) {
      results = results.filter((w) => w.userId === query.userId);
    }

    res.json(results.map((w) => ({
      ...w,
      createdAt: w.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing warns");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateWarnBody.parse(req.body);

    const [warn] = await db
      .insert(warnsTable)
      .values(body)
      .returning();

    res.status(201).json({
      ...warn,
      createdAt: warn.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating warn");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteWarnParams.parse(req.params);

    const [deleted] = await db
      .delete(warnsTable)
      .where(eq(warnsTable.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Warn not found" });
    }

    res.json({
      ...deleted,
      createdAt: deleted.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error deleting warn");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
