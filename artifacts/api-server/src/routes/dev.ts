import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db } from "@workspace/db";
import { botConfigTable, changelogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { devState } from "../lib/devState.js";
import { EmbedBuilder, type TextChannel, type Client } from "discord.js";

const router = Router();
const DEV_USER_ID = "819080793447333918";
let botClient: Client | null = null;

export function setBotClientForDev(client: Client) {
  botClient = client;
}

function requireDevAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-dev-token"];
  const expected = process.env.DEV_TOKEN;

  if (!expected) {
    req.log?.error(
      "🔒 El token maestro DEV_TOKEN no está definido en el entorno.",
    );
    return res
      .status(503)
      .json({ error: "Dev panel not configured on this node." });
  }

  if (!token || token !== expected) {
    return res
      .status(401)
      .json({ error: "Access denied. Invalid developer token." });
  }

  next();
}

router.get("/status", requireDevAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(botConfigTable).limit(1);
    const maintenance = rows[0]?.maintenance ?? false;

    res.status(200).json({
      maintenance,
      systemUptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      devState,
    });
  } catch (err) {
    req.log?.error(
      { err },
      "❌ Error de lectura en la configuración global de desarrollo",
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/changelogs",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const { version, title, description, type, announceChannelId } = req.body;

      if (!version?.trim() || !title?.trim() || !description?.trim()) {
        return res
          .status(400)
          .json({
            error: "Missing required fields: version, title, description",
          });
      }

      const validTypes = ["feature", "fix", "improvement", "breaking"];
      const entryType = validTypes.includes(type) ? type : "feature";

      const [entry] = await db
        .insert(changelogsTable)
        .values({
          version: version.trim(),
          title: title.trim(),
          description: description.trim(),
          type: entryType,
        })
        .returning();

      // ── ANUNCIO AUTOMÁTICO AL CANAL DE DISCORD ──
      if (announceChannelId && botClient) {
        try {
          const channel = (await botClient.channels.fetch(
            announceChannelId,
          )) as TextChannel;
          if (channel?.isTextBased()) {
            const typeColors: Record<string, number> = {
              feature: 0xec4899,
              fix: 0xef4444,
              improvement: 0x3b82f6,
              breaking: 0xf59e0b,
            };

            const embed = new EmbedBuilder()
              .setColor(typeColors[entryType] ?? 0xec4899)
              .setTitle(`🚀 Actualización del Núcleo — v${version.trim()}`)
              .setAuthor({ name: "ZeroTwo Engine Updates" })
              .setDescription(`### 🛠️ ${title.trim()}\n\n${description.trim()}`)
              .setTimestamp()
              .setFooter({ text: `Categoría: ${entryType.toUpperCase()}` });

            await channel.send({ embeds: [embed] });
          }
        } catch (discordErr) {
          req.log?.warn(
            { discordErr },
            "⚠️ El changelog se guardó pero falló el envío del embed a Discord",
          );
        }
      }

      res
        .status(201)
        .json({ ...entry, createdAt: entry?.createdAt.toISOString() });
    } catch (err) {
      req.log?.error({ err }, "❌ Imposible registrar o anunciar el changelog");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.delete(
  "/changelogs/:id",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id))
        return res.status(400).json({ error: "Invalid id format" });

      const [deleted] = await db
        .delete(changelogsTable)
        .where(eq(changelogsTable.id, id))
        .returning();

      if (!deleted)
        return res.status(404).json({ error: "Changelog entry not found" });

      res.status(200).json({ success: true, deletedId: id });
    } catch (err) {
      req.log?.error({ err }, "❌ Error eliminando la entrada del changelog");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
