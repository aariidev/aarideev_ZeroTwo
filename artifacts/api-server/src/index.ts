import app from "./app.js";
import { logger } from "./lib/logger.js";
import { flushAllLogs } from "./lib/botLogger.js";
import { startBot } from "./bot/index.js";
import { Client } from "discord.js";

// ── Validación de PORT ────────────────────────────────────────────────────────
const rawPort = process.env.PORT;

if (!rawPort) {
  logger.fatal("La variable de entorno PORT es requerida pero no fue proporcionada.");
  process.exit(1);
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0 || port > 65535) {
  logger.fatal(`Valor de PORT inválido: "${rawPort}". Debe ser un número entre 1 y 65535.`);
  process.exit(1);
}

// ── Estado global ─────────────────────────────────────────────────────────────
let botClient: Client | null = null;
let isShuttingDown = false;

// ── Servidor Express ──────────────────────────────────────────────────────────
const server = app.listen(port, () => {
  logger.info(
    { port },
    `¡Sistemas de la Plantación Online! 🌐  Servidor Express escuchando en el puerto ${port}`,
  );
  // Prefetch Discord verify_key so Event Webhooks validate on first PING
  void import("./routes/discordWebhooks.js")
    .then(({ resolveDiscordPublicKey }) => resolveDiscordPublicKey())
    .then((key) => {
      if (key) {
        logger.info(
          "discord webhooks: listo · POST /api/discord/webhooks/events",
        );
      } else {
        logger.warn(
          "discord webhooks: sin public key — pon DISCORD_PUBLIC_KEY o revisa DISCORD_TOKEN",
        );
      }
    })
    .catch(() => {
      /* ignore */
    });
});

server.on("error", (err) => {
  logger.fatal({ err }, "Error crítico al levantar el servidor HTTP");
  process.exit(1);
});

// ── Bot de Discord ────────────────────────────────────────────────────────────
startBot()
  .then((client) => {
    if (client instanceof Client) {
      botClient = client;
    }
    logger.info("¡Conexión del parásito Zero Two establecida con éxito con Discord! 🌸");
  })
  .catch((err) => {
    logger.error(
      { err },
      "Fallo crítico al sincronizar la unidad Zero Two (Bot de Discord)",
    );
  });

// ── Protocolo de apagado seguro ───────────────────────────────────────────────
async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Recibida señal ${signal}. Iniciando protocolo de apagado seguro... 🛑`);

  
  const forceExit = setTimeout(() => {
    logger.fatal("Apagado forzado por exceder el tiempo límite de espera (10s).");
    process.exit(1);
  }, 10_000);

  forceExit.unref(); // No mantener el proceso vivo solo por el timeout

  try {
    
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    logger.info("Servidor Express cerrado limpiamente.");

    
    if (botClient) {
      try {
        botClient.destroy();
        logger.info("Conexión de la unidad Zero Two finalizada de forma segura.");
      } catch (err) {
        logger.error({ err }, "Error al destruir la sesión del bot de Discord");
      }
    }

    
    try {
      await flushAllLogs();
    } catch (err) {
      logger.error({ err }, "Error al vaciar la cola de logs del bot");
    }

    logger.info("Protocolo terminado. Desconexión del sistema completada.");
    process.exit(0);
  } catch (err) {
    logger.fatal({ err }, "Error durante el protocolo de apagado");
    process.exit(1);
  }
}

// ── Señales de sistema (compatibles con PowerShell 7 / Windows) ───────────────
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));   // Ctrl+C


process.on("SIGHUP", () => handleShutdown("SIGHUP"));

// ── Errores no capturados ─────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Excepción no capturada (uncaughtException)");
  handleShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Promesa rechazada sin manejar (unhandledRejection)");
});