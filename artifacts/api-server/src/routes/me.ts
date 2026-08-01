import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { Client } from "discord.js";
import {
  getEconomy,
  setInventoryPrivate,
  isInventoryPrivate,
} from "../bot/lib/economy.js";
import { logBotEvent } from "../lib/botLogger.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
let botClient: Client | null = null;

export function setMeBotClient(client: Client) {
  botClient = client;
}

const PatchEconomyBody = z.object({
  guildId: z.string().min(1).max(32),
  inventoryPrivate: z.boolean(),
});

// ── GET /me/economy?guildId= ──────────────────────────────────────────────────

router.get("/economy", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.sessionUser;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const guildId =
      typeof req.query.guildId === "string" ? req.query.guildId.trim() : "";
    if (!guildId) {
      res.status(400).json({
        error: "guildId query param required",
        code: "GUILD_ID_REQUIRED",
      });
      return;
    }

    if (botClient && !botClient.guilds.cache.has(guildId)) {
      res.status(404).json({
        error: "Bot no está en ese servidor",
        code: "GUILD_NOT_FOUND",
      });
      return;
    }

    const eco = await getEconomy(guildId, user.id);
    const inventoryPrivate = Boolean(eco.inventoryPrivate);

    res.status(200).json({
      guildId,
      userId: user.id,
      balance: eco.balance,
      inventoryPrivate,
      streak: eco.streak,
      gamesPlayed: eco.gamesPlayed,
      gamesWon: eco.gamesWon,
    });
  } catch (err) {
    req.log?.error({ err }, "GET /me/economy failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /me/economy ─────────────────────────────────────────────────────────

router.patch(
  "/economy",
  validateBody(PatchEconomyBody),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.sessionUser;
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { guildId, inventoryPrivate } = req.body as z.infer<
        typeof PatchEconomyBody
      >;

      if (botClient && !botClient.guilds.cache.has(guildId)) {
        res.status(404).json({
          error: "Bot no está en ese servidor",
          code: "GUILD_NOT_FOUND",
        });
        return;
      }

      const prev = await isInventoryPrivate(guildId, user.id);
      await setInventoryPrivate(guildId, user.id, inventoryPrivate);

      if (prev !== inventoryPrivate) {
        logBotEvent({
          level: "info",
          event: "economy",
          details: {
            action: "inventory_privacy",
            inventoryPrivate,
            source: "dashboard",
          },
          guildId,
          userId: user.id,
          username: user.username,
        });
      }

      res.status(200).json({
        ok: true,
        guildId,
        userId: user.id,
        inventoryPrivate,
      });
    } catch (err) {
      req.log?.error({ err }, "PATCH /me/economy failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
