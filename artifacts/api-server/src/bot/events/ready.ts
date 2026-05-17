import { ActivityType, REST, Routes } from "discord.js";
import { logger } from "../../lib/logger.js";
import { BotClient } from "../types.js";

export default async function onReady(client: BotClient) {
  logger.info(`Bot listo: ${client.user?.tag}`);

  let activityIndex = 0;

  const updateActivity = () => {
    const activities = [
      {
        name: "ser humanos con mi Darling 🍯",
        type: ActivityType.Playing,
      },
      {
        name: `${client.guilds.cache.size} plantaciones en busca de parásitos 🌸`,
        type: ActivityType.Watching,
      },
      {
        name: "tus órdenes... o usa /help 💋",
        type: ActivityType.Listening,
      },
    ];

    const currentActivity = activities[activityIndex % activities.length];
    client.user?.setActivity(currentActivity.name, {
      type: currentActivity.type,
    });

    activityIndex++;
  };

  updateActivity();
  setInterval(updateActivity, 20_000);

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
