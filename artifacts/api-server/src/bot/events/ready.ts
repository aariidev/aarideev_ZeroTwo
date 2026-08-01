import {
  ApplicationIntegrationType,
  EmbedBuilder,
  InteractionContextType,
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import { BotClient } from "../types.js";
import { startPresenceRefresh } from "../lib/presence.js";
import { BOT_VERSION } from "../lib/version.js";

/**
 * Featured slash commands for bot profile "Comandos" section.
 * Discord shows up to ~5 most-used global commands automatically (esp. verified apps).
 * We still register ALL commands; this list is prioritized first in the PUT body
 * and ensures contexts/integration_types are set for profile discovery.
 */
const PROFILE_FEATURED = [
  "help",
  "play",
  "blackjack",
  "ticket",
  "wallet",
  "zerotwoinf",
  "presence",
  "beta",
  "musicpanel",
  "automod",
] as const;

function withProfileContexts(
  json: RESTPostAPIChatInputApplicationCommandsJSONBody,
): RESTPostAPIChatInputApplicationCommandsJSONBody {
  // Make commands usable in guilds (+ DMs with bot when allowed)
  return {
    ...json,
    // Guild install (classic bot) + optional user install discovery
    integration_types: [
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ],
    contexts: [
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ],
  };
}

const STARTUP_STATS_CHANNEL = "1530019095565570158";

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export default async function onReady(client: BotClient) {
  logger.info(`Bot listo: ${client.user?.tag}`);

  // ── Rich presence rotativa con emojis y separadores ───────────────────────
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

  // Build JSON list: featured first (helps discoverability), then the rest
  const all = client.commands.map((cmd) =>
    withProfileContexts(
      cmd.data.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody,
    ),
  );

  const featuredSet = new Set<string>(PROFILE_FEATURED as unknown as string[]);
  const featured = PROFILE_FEATURED.map((name) =>
    all.find((c) => c.name === name),
  ).filter(Boolean) as RESTPostAPIChatInputApplicationCommandsJSONBody[];
  const restCmds = all.filter((c) => !featuredSet.has(c.name));
  const commands = [...featured, ...restCmds];

  try {
    logger.info(
      `Sincronizando ${commands.length} comandos globales (perfil: ${featured.map((c) => "/" + c.name).join(", ")})...`,
    );
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    logger.info(
      "Comandos globales registrados. El apartado «Comandos» del perfil muestra hasta 5 de los más usados (apps verificadas lo ven siempre).",
    );
  } catch (err) {
    logger.error(
      { err },
      "Error crítico al registrar comandos en la API de Discord",
    );
  }

  const uptimeMs = process.uptime() * 1000;
  const guildCount = client.guilds.cache.size;
  const memberCount = client.guilds.cache.reduce(
    (sum, guild) => sum + (guild.memberCount ?? 0),
    0,
  );
  const channelCount = client.channels.cache.size;
  const commandCount = client.commands.size;
  const memory = process.memoryUsage();
  const statsEmbed = new EmbedBuilder()
    .setTitle("🚀 Zero Two: Estadísticas de inicio/reinicio")
    .setColor(0x7c3aed)
    .setDescription(
      "El bot ha entrado en línea. A continuación se presentan estadísticas detalladas y de salud del sistema.",
    )
    .addFields(
      { name: "Versión", value: BOT_VERSION, inline: true },
      { name: "Entorno", value: process.env.NODE_ENV ?? "desarrollo", inline: true },
      { name: "PID", value: `${process.pid}`, inline: true },
      { name: "Uptime", value: formatDuration(uptimeMs), inline: true },
      { name: "Comandos registrados", value: `${commandCount}`, inline: true },
      { name: "Servidores", value: `${guildCount}`, inline: true },
      { name: "Usuarios cacheados", value: `${memberCount}`, inline: true },
      { name: "Canales cacheados", value: `${channelCount}`, inline: true },
      { name: "Gateway ping", value: `${Math.round(client.ws.ping)}ms`, inline: true },
      {
        name: "Memoria RSS",
        value: formatBytes(memory.rss),
        inline: true,
      },
      {
        name: "Heap usado / total",
        value: `${formatBytes(memory.heapUsed)} / ${formatBytes(memory.heapTotal)}`,
        inline: true,
      },
      {
        name: "External",
        value: formatBytes(memory.external),
        inline: true,
      },
    )
    .setFooter({ text: `Canal de estadísticas activado | ${new Date().toLocaleString()}` })
    .setTimestamp();

  try {
    const channel = await client.channels.fetch(STARTUP_STATS_CHANNEL);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      logger.warn(
        { channelId: STARTUP_STATS_CHANNEL },
        "No se pudo encontrar el canal de estadísticas o no es un canal de texto válido.",
      );
    } else {
      await channel.send({ embeds: [statsEmbed] });
    }
  } catch (err) {
    logger.error(
      { err, channelId: STARTUP_STATS_CHANNEL },
      "No se pudo enviar el embed de estadísticas de inicio al canal de monitorización.",
    );
  }
}
