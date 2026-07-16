import { ActivityType, REST, Routes } from "discord.js";
import { logger } from "../../lib/logger.js";
import { BotClient } from "../types.js";

const VERSION = "v2.3.0";

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0)    return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0)   return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getTotalMembers(client: BotClient): number {
  return client.guilds.cache.reduce((acc, g) => acc + (g.memberCount ?? 0), 0);
}

function getDashboardUrl(): string {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const first = domains.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  return "https://zerotwo.replit.app";
}

export default async function onReady(client: BotClient) {
  logger.info(`Bot listo: ${client.user?.tag}`);

  const dashboardUrl = getDashboardUrl();
  let activityIndex = 0;

  const updateActivity = () => {
    const guilds   = client.guilds.cache.size;
    const members  = getTotalMembers(client);
    const commands = client.commands.size;
    const uptime   = formatUptime(client.uptime ?? 0);

    const activities: { name: string; type: ActivityType; url?: string }[] = [
      {
        name: `con Darling en ${guilds} servidor${guilds !== 1 ? "es" : ""} 🌸`,
        type: ActivityType.Playing,
      },
      {
        name: `${members.toLocaleString("es")} parásito${members !== 1 ? "s" : ""} en la Plantación 🌿`,
        type: ActivityType.Watching,
      },
      {
        name: `${commands} comandos listos · /help 💋`,
        type: ActivityType.Listening,
      },
      {
        name: `la Dashboard · ${dashboardUrl}`,
        type: ActivityType.Watching,
      },
      {
        name: `Online ${uptime} · Zero Two ${VERSION} ⚡`,
        type: ActivityType.Competing,
      },
      {
        name: `${guilds} servidor${guilds !== 1 ? "es" : ""} · ${members.toLocaleString("es")} miembros · ${commands} cmds`,
        type: ActivityType.Playing,
      },
    ];

    const current = activities[activityIndex % activities.length]!;
    client.user?.setPresence({
      status: "online",
      activities: [
        {
          name: current.name,
          type: current.type,
          ...(current.url ? { url: current.url } : {}),
        },
      ],
    });

    activityIndex++;
  };

  updateActivity();
  setInterval(updateActivity, 15_000);

  const token    = process.env.DISCORD_TOKEN;
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
    logger.info(`Sincronizando ${commands.length} comandos de barra globalmente...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    logger.info("Todos los comandos globales han sido registrados correctamente.");
  } catch (err) {
    logger.error({ err }, "Error crítico al registrar comandos en la API de Discord");
  }
}
