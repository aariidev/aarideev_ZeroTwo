import { REST, Routes } from "discord.js";
import { logger } from "../../lib/logger.js";
import { BotClient } from "../types.js";
import { startPresenceRefresh } from "../lib/presence.js";

export default async function onReady(client: BotClient) {
  logger.info(`Bot listo: ${client.user?.tag}`);

  // ── Rich presence fija: Playing /help - vX.Y.Z ────────────────────────────
  startPresenceRefresh(client);

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || !clientId) {
    logger.error(
      "Faltan variables de entorno esenciales: DISCORD_TOKEN o CLIENT_ID.",
    );
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const commands = client.commands.map((cmd) => cmd.data.toJSON());

  try {
    logger.info(
      `Sincronizando ${commands.length} comandos de barra globalmente...`,
    );
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    logger.info(
      "Todos los comandos globales han sido registrados correctamente.",
    );
  } catch (err) {
    logger.error(
      { err },
      "Error crítico al registrar comandos en la API de Discord",
    );
  }
}
