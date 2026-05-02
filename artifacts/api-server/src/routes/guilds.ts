import { Router } from "express";

const router = Router();

let botClient: import("discord.js").Client | null = null;

export function setBotClient(client: import("discord.js").Client) {
  botClient = client;
}

router.get("/", async (req, res) => {
  try {
    if (!botClient) {
      return res.json([]);
    }

    const guilds = botClient.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      iconUrl: guild.iconURL({ size: 128 }) ?? null,
      joinedAt: guild.joinedAt?.toISOString() ?? new Date().toISOString(),
    }));

    res.json(guilds);
  } catch (err) {
    req.log.error({ err }, "Error getting guilds");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
