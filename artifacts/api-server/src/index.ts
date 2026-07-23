import app from "./app.js";
import { logger } from "./lib/logger.js";
import { flushAllLogs } from "./lib/botLogger.js";
import { startBot } from "./bot/index.js";
import { Client } from "discord.js";

const rawPort = process.env.PORT;

if (!rawPort) {
  logger.fatal(
    "La variable de entorno PORT es requerida pero no fue proporcionada.",
  );
  process.exit(1);
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0 || port > 65535) {
  logger.fatal(
    `Valor de PORT inválido: "${rawPort}". Debe ser un número de puerto válido (1-65535).`,
  );
  process.exit(1);
}

let botClient: Client | null = null;

const server = app.listen(port, () => {
  logger.info(
    { port },
    `¡Sistemas de la Plantación Online! 🌐 Servidor Express escuchando en el puerto ${port}`,
  );
});

server.on("error", (err) => {
  logger.fatal({ err }, "Error crítico al levantar el servidor HTTP");
  process.exit(1);
});

startBot()
  .then((client) => {
    if (client instanceof Client) botClient = client;
    logger.info(
      "¡Conexión del parásito Zero Two establecida con éxito con Discord! 🌸",
    );
  })
  .catch((err) => {
    logger.error(
      { err },
      "Fallo crítico al sincronizar la unidad Zero Two (Bot de Discord)",
    );
  });

const handleShutdown = (signal: string) => {
  logger.warn(
    `Recibida señal ${signal}. Iniciando protocolo de apagado seguro... 🛑`,
  );

  server.close(async () => {
    logger.info("Servidor Express cerrado limpiamente.");

    if (botClient) {
      try {
        botClient.destroy();
        logger.info(
          "Conexión de la unidad Zero Two finalizada de forma segura.",
        );
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
  });

  setTimeout(() => {
    logger.fatal("Apagado forzado por exceder el tiempo límite de espera.");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
