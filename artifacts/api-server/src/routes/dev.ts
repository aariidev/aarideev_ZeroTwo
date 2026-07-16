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
import { EmbedBuilder, ChannelType, type TextChannel, type Client } from "discord.js";
import { logger } from "../lib/logger.js";

const router = Router();
const DEV_USER_ID = "819080793447333918";
let botClient: Client | null = null;
let restartInProgress = false;

export function setBotClientForDev(client: Client) {
  botClient = client;
}

function ownerIds(): string[] {
  return (process.env.OWNER_IDS ?? DEV_USER_ID)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Dev routes: must be an OWNER (Discord session) AND present valid DEV_TOKEN.
 * Non-owners never get access even if they guess the token.
 */
function requireDevAuth(req: Request, res: Response, next: NextFunction) {
  const owners = ownerIds();
  const sessionUserId = req.sessionUser?.id;

  if (!sessionUserId || !owners.includes(sessionUserId)) {
    logger.warn(
      { sessionUserId },
      "Dev API blocked — caller is not the developer/owner",
    );
    return res.status(403).json({
      error: "Dev panel is restricted to the bot developer.",
      code: "DEV_OWNER_ONLY",
    });
  }

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

function isBotOnline(): boolean {
  if (!botClient) return false;
  try {
    return Boolean(botClient.isReady() && botClient.user);
  } catch {
    return false;
  }
}

function guildsCount(): number {
  return botClient?.guilds.cache.size ?? 0;
}

/** Shape expected by the dashboard Dev Panel */
function buildStatusPayload() {
  const current = devState.current;
  const online = isBotOnline();
  const rawPing = botClient?.ws.ping ?? -1;
  return {
    devUserId: DEV_USER_ID,
    maintenanceMode: current.maintenanceMode,
    maintenanceMessage: current.maintenanceMessage,
    botOnline: online,
    guildsCount: guildsCount(),
    restartInProgress,
    systemUptime: process.uptime(),
    // discord.js can report -1 briefly even while ready; keep UI green
    ping: online && rawPing < 0 ? 0 : rawPing,
    botName: botClient?.user?.username ?? null,
  };
}

async function persistConfig(key: string, value: string) {
  await db
    .insert(botConfigTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: botConfigTable.key,
      set: { value, updatedAt: new Date() },
    });
}

// ── GET /status ──────────────────────────────────────────────────────────────

router.get("/status", requireDevAuth, async (req: Request, res: Response) => {
  try {
    res.status(200).json(buildStatusPayload());
  } catch (err) {
    req.log?.error(
      { err },
      "❌ Error de lectura en la configuración global de desarrollo",
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /maintenance ────────────────────────────────────────────────────────

router.post(
  "/maintenance",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const enabled = Boolean(req.body?.enabled);
      const message =
        typeof req.body?.message === "string" && req.body.message.trim()
          ? req.body.message.trim()
          : undefined;

      devState.setMaintenance(enabled, message);

      await Promise.all([
        persistConfig("maintenance_mode", enabled ? "true" : "false"),
        message
          ? persistConfig("maintenance_message", message)
          : Promise.resolve(),
      ]);

      res.status(200).json({
        maintenanceMode: devState.current.maintenanceMode,
        maintenanceMessage: devState.current.maintenanceMessage,
        ...buildStatusPayload(),
      });
    } catch (err) {
      req.log?.error({ err }, "❌ Error al conmutar modo mantenimiento");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── POST /announce ───────────────────────────────────────────────────────────

router.post(
  "/announce",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const title =
        typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const message =
        typeof req.body?.message === "string" ? req.body.message.trim() : "";

      if (!title || !message) {
        return res
          .status(400)
          .json({ error: "Missing required fields: title, message" });
      }

      if (!botClient || !isBotOnline()) {
        return res.status(503).json({ error: "Bot is offline" });
      }

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setTitle(title)
        .setDescription(message)
        .setTimestamp()
        .setFooter({ text: "ZeroTwo · Broadcast" });

      let sent = 0;
      const guilds = [...botClient.guilds.cache.values()];
      const total = guilds.length;

      for (const guild of guilds) {
        try {
          let channel =
            guild.systemChannel ??
            guild.publicUpdatesChannel ??
            null;

          if (!channel || !channel.isTextBased()) {
            const me = guild.members.me;
            channel =
              guild.channels.cache.find((ch) => {
                if (ch.type !== ChannelType.GuildText) return false;
                if (!me) return true;
                return ch
                  .permissionsFor(me)
                  ?.has(["SendMessages", "EmbedLinks"]);
              }) ?? null;
          }

          if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send({ embeds: [embed] });
            sent++;
          }
        } catch (guildErr) {
          req.log?.warn(
            { guildErr, guildId: guild.id },
            "No se pudo enviar anuncio a un servidor",
          );
        }
      }

      res.status(200).json({ sent, total });
    } catch (err) {
      req.log?.error({ err }, "❌ Error en broadcast de anuncio");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── POST /restart ────────────────────────────────────────────────────────────

router.post(
  "/restart",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      if (!botClient) {
        return res.status(503).json({ error: "Bot client not initialized" });
      }
      if (restartInProgress) {
        return res.status(409).json({ error: "Restart already in progress" });
      }

      const token = process.env.DISCORD_TOKEN;
      if (!token) {
        return res.status(503).json({ error: "DISCORD_TOKEN missing" });
      }

      restartInProgress = true;
      res.status(202).json({
        ok: true,
        message: "Bot restart initiated",
        botOnline: false,
      });

      // Run reconnect after the response is flushed
      setImmediate(async () => {
        try {
          logger.warn("♻️ Dev Panel: reinicio del bot solicitado…");
          botClient!.destroy();
          await botClient!.login(token);
          // Presence is re-applied by clientReady/ready handler; reinforce after login
          const { applyRichPresence } = await import("../bot/lib/presence.js");
          // small delay so user object is ready after gateway identify
          setTimeout(() => {
            try {
              applyRichPresence(botClient!);
            } catch {
              /* ignore */
            }
          }, 1500);
          logger.info("♻️ Dev Panel: bot reconectado a Discord");
        } catch (err) {
          logger.error({ err }, "♻️ Dev Panel: fallo al reiniciar el bot");
        } finally {
          restartInProgress = false;
        }
      });
    } catch (err) {
      restartInProgress = false;
      req.log?.error({ err }, "❌ Error iniciando restart del bot");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── GET /changelogs ──────────────────────────────────────────────────────────

router.get(
  "/changelogs",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const rows = await db
        .select()
        .from(changelogsTable)
        .orderBy(desc(changelogsTable.createdAt))
        .limit(50);

      res.status(200).json(
        rows.map((row) => ({
          id: row.id,
          version: row.version,
          title: row.title,
          description: row.description,
          type: row.type,
          createdAt:
            row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : String(row.createdAt),
        })),
      );
    } catch (err) {
      req.log?.error({ err }, "❌ Error listando changelogs");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── POST /changelogs ─────────────────────────────────────────────────────────

router.post(
  "/changelogs",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const { version, title, description, type, announceChannelId } = req.body;

      if (!version?.trim() || !title?.trim() || !description?.trim()) {
        return res.status(400).json({
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

      if (announceChannelId && botClient && isBotOnline()) {
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
              .setDescription(
                `### 🛠️ ${title.trim()}\n\n${description.trim()}`,
              )
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

      res.status(201).json({
        ...entry,
        createdAt: entry?.createdAt.toISOString(),
      });
    } catch (err) {
      req.log?.error({ err }, "❌ Imposible registrar o anunciar el changelog");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── DELETE /changelogs/:id ───────────────────────────────────────────────────

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
