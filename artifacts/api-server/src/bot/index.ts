import { Client, Collection, Partials, GatewayIntentBits } from "discord.js";
import { logger } from "../lib/logger.js";
import { BotClient } from "./types.js";
import { setBotClient as setBotClientForBot } from "../routes/bot.js";
import { setBotClient as setBotClientForGuilds } from "../routes/guilds.js";
import { setBotClientForDev } from "../routes/dev.js";
import { devState } from "../lib/devState.js";
import { db } from "@workspace/db";
import { botConfigTable } from "@workspace/db";

// ── IMPORTACIÓN DE MÓDULOS DE COMANDOS ─────────────────────────────────────────

// Utility
import pingCmd from "./commands/utility/ping.js";
import avatarCmd from "./commands/utility/avatar.js";
import serverinfoCmd from "./commands/utility/serverinfo.js";
import userinfoCmd from "./commands/utility/userinfo.js";
import helpCmd from "./commands/utility/help.js";

// Moderation
import banCmd from "./commands/moderation/ban.js";
import kickCmd from "./commands/moderation/kick.js";
import muteCmd from "./commands/moderation/mute.js";
import unmuteCmd from "./commands/moderation/unmute.js";
import warnCmd from "./commands/moderation/warn.js";
import warnsCmd from "./commands/moderation/warns.js";
import clearwarnsCmd from "./commands/moderation/clearwarns.js";
import purgeCmd from "./commands/moderation/purge.js";
import timeoutCmd from "./commands/moderation/timeout.js";
import untimeoutCmd from "./commands/moderation/untimeout.js";
import unbanCmd from "./commands/moderation/unban.js";
import slowmodeCmd from "./commands/moderation/slowmode.js";
import lockCmd from "./commands/moderation/lock.js";
import unlockCmd from "./commands/moderation/unlock.js";
import logsCmd from "./commands/moderation/logs.js";

// Fun
import eightballCmd from "./commands/fun/8ball.js";
import coinflipCmd from "./commands/fun/coinflip.js";
import rollCmd from "./commands/fun/roll.js";
import blackjackCmd from "./commands/fun/blackjack.js";
import cfgembedCmd from "./commands/utility/cfgembed.js";

const ALL_COMMANDS = [
  pingCmd,
  avatarCmd,
  serverinfoCmd,
  userinfoCmd,
  helpCmd,
  banCmd,
  kickCmd,
  muteCmd,
  unmuteCmd,
  warnCmd,
  warnsCmd,
  clearwarnsCmd,
  purgeCmd,
  timeoutCmd,
  untimeoutCmd,
  unbanCmd,
  slowmodeCmd,
  lockCmd,
  unlockCmd,
  logsCmd,
  eightballCmd,
  coinflipCmd,
  rollCmd,
  blackjackCmd,
  cfgembedCmd,
];

export async function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    logger.error(
      "🚨 DISCORD_TOKEN no configurado — El motor de Zero Two no ha podido inicializarse.",
    );
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  }) as BotClient;

  client.commands = new Collection();
  client.cooldowns = new Collection();

  for (const command of ALL_COMMANDS) {
    if (command?.data?.name && command?.execute) {
      client.commands.set(command.data.name, command);
    } else {
      logger.warn(
        `⚠️ Comandante, un módulo falló la verificación de estructura y no se pudo montar.`,
      );
    }
  }

  logger.info(
    `🌸 [NÚCLEO] Sincronización exitosa: ${client.commands.size} comandos listos en la terminal.`,
  );

  // ── PRE-CARGA ESTRATÉGICA DE ENRUTADORES DE EVENTOS ──────────────────────────

  const { default: onReady } = await import("./events/ready.js");
  const { default: onInteractionCreate } = await import(
    "./events/interactionCreate.js"
  );
  const { default: onGuildCreate } = await import("./events/guildCreate.js");

  client.once("ready", async () => {
    try {
      await onReady(client);

      setBotClientForBot(client);
      setBotClientForGuilds(client);
      setBotClientForDev(client);

      logger.info("🔗 Pasarelas y rutas API vinculadas al cliente central.");

      const rows = await db.select().from(botConfigTable);
      const maintenanceRow = rows.find((r) => r.key === "maintenance_mode");
      const messageRow = rows.find((r) => r.key === "maintenance_message");
      devState.setMaintenance(
        maintenanceRow?.value === "true",
        messageRow?.value,
      );

      logger.info(
        { maintenanceMode: devState.current.maintenanceMode },
        "💾 Estado de depuración restaurado desde el núcleo de datos.",
      );
    } catch (err) {
      logger.error(
        { err },
        "❌ Error crítico al restaurar las configuraciones en el bloque listo.",
      );
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      await onInteractionCreate(interaction);
    } catch (err) {
      logger.error(
        { err },
        `❌ Colapso en el hilo de comandos al procesar interacción.`,
      );
    }
  });

  client.on("guildCreate", async (guild) => {
    try {
      await onGuildCreate(guild);
    } catch (err) {
      logger.error(
        { err, guildId: guild.id },
        `❌ Error al inicializar nexo con un nuevo servidor.`,
      );
    }
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    return client;
  } catch (err) {
    logger.fatal(
      { err },
      "💀 El núcleo central ha rechazado la firma del Token. Apagando sistemas.",
    );
    process.exit(1);
  }
}
