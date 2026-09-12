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
  const cpuUsage = process.cpuUsage();
  const gatewayPing = Math.round(client.ws.ping);
  
  // Calculate memory percentage
  const heapUsedPercent = ((memory.heapUsed / memory.heapTotal) * 100).toFixed(1);
  
  // Determine status color based on performance
  let statusColor: number;
  let statusEmoji: string;
  if (gatewayPing < 50) {
    statusColor = 0x00ff00; // Green
    statusEmoji = "🟢";
  } else if (gatewayPing < 150) {
    statusColor = 0xffff00; // Yellow
    statusEmoji = "🟡";
  } else {
    statusColor = 0xff0000; // Red
    statusEmoji = "🔴";
  }

  const statsEmbed = new EmbedBuilder()
    .setColor(statusColor)
    .setAuthor({
      name: "🌸 Zero Two • Sistema Online",
      iconURL: client.user?.displayAvatarURL({ size: 256 }) ?? undefined,
    })
    .setTitle("✨ Sincronización Exitosa")
    .setDescription(
      [
        `${statusEmoji} **Estado:** En línea y operativo`,
        `📡 **Última sincronización:** ${new Date().toLocaleTimeString("es-ES")}`,
        "",
        "Zero Two ha vuelto en línea y está lista para operar.",
        "Todos los sistemas están funcionando correctamente.",
      ].join("\n"),
    )
    .addFields(
      // Row 1: Core Info
      { name: "🧩 Versión", value: BOT_VERSION, inline: true },
      { name: "🌍 Entorno", value: process.env.NODE_ENV ?? "desarrollo", inline: true },
      { name: "🆔 Proceso", value: `PID ${process.pid}`, inline: true },
      
      // Row 2: Performance
      { name: "⏱️ Uptime", value: formatDuration(uptimeMs), inline: true },
      { name: "⚡ Latencia", value: `${gatewayPing}ms`, inline: true },
      { name: "💾 Memoria", value: `${heapUsedPercent}% (${formatBytes(memory.heapUsed)}/${formatBytes(memory.heapTotal)})`, inline: true },
      
      // Row 3: Servidor
      { name: "━━━━━━━━━━━━━━━━━━", value: "", inline: false },
      { name: "🏠 Servidores Activos", value: `**${guildCount}**`, inline: true },
      { name: "👥 Miembros en Cache", value: `**${memberCount.toLocaleString("es-ES")}**`, inline: true },
      { name: "🗂️ Canales en Cache", value: `**${channelCount}**`, inline: true },
      
      // Row 4: Sistema
      { name: "━━━━━━━━━━━━━━━━━━", value: "", inline: false },
      { name: "📚 Comandos Registrados", value: `**${commandCount}**`, inline: true },
      { name: "🧠 Memoria RSS", value: formatBytes(memory.rss), inline: true },
      { name: "🧾 Memoria Externa", value: formatBytes(memory.external), inline: true },
      
      // Row 5: CPU
      { name: "━━━━━━━━━━━━━━━━━━", value: "", inline: false },
      { name: "⚙️ CPU Usuario", value: `${(cpuUsage.user / 1000).toFixed(2)}ms`, inline: true },
      { name: "⚙️ CPU Sistema", value: `${(cpuUsage.system / 1000).toFixed(2)}ms`, inline: true },
      { name: "🔧 Node.js", value: process.version, inline: true },
    )
    .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) ?? undefined)
    .setImage(client.user?.displayAvatarURL({ size: 512 }) ?? undefined)
    .setFooter({ 
      text: `Inicialización completada • Sistema listo para operaciones`,
      iconURL: client.user?.displayAvatarURL() ?? undefined
    })
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
