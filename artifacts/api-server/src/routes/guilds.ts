import { Router, type Request, type Response } from "express";
import type { Client } from "discord.js";

const router = Router();
let botClient: Client | null = null;

export function setBotClient(client: Client) {
  botClient = client;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    if (!botClient) {
      return res.status(200).json([]);
    }

    const guilds = botClient.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      iconUrl: guild.iconURL({ size: 128 }) ?? null,
      joinedAt: guild.joinedAt?.toISOString() ?? new Date().toISOString(),
    }));

    res.status(200).json(guilds);
  } catch (err) {
    req.log?.error({ err }, "❌ Error al listar los servidores activos");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
