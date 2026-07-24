import {
  ApplicationIntegrationType,
  InteractionContextType,
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import { BotClient } from "../types.js";
import { startPresenceRefresh } from "../lib/presence.js";

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
}
