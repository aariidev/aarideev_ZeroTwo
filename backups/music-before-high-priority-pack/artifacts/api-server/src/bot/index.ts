import { Client, Collection, Partials, GatewayIntentBits } from "discord.js";
import { logger } from "../lib/logger.js";
import { BotClient } from "./types.js";
import { setBotClient as setBotClientForBot } from "../routes/bot.js";
import { setBotClient as setBotClientForGuilds } from "../routes/guilds.js";
import { setBotClientForDev } from "../routes/dev.js";
import { setBotClientForTickets } from "../routes/tickets.js";
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
import botinfoCmd from "./commands/utility/botinfo.js";

// Moderation
import banCmd from "./commands/moderation/ban.js";
import kickCmd from "./commands/moderation/kick.js";
import muteCmd from "./commands/moderation/mute.js";
import unmuteCmd from "./commands/moderation/unmute.js";
import warnCmd from "./commands/moderation/warn.js";
import warnsCmd from "./commands/moderation/warns.js";
import clearwarnsCmd from "./commands/moderation/clearwarns.js";
import delwarnCmd from "./commands/moderation/delwarn.js";
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
import cfglogsCmd from "./commands/utility/cfglogs.js";
import ticketCmd from "./commands/utility/ticket.js";
import walletCmd from "./commands/fun/wallet.js";
import shopCmd from "./commands/fun/shop.js";
import inventoryCmd from "./commands/fun/inventory.js";
import topCmd from "./commands/fun/top.js";
import slotsCmd from "./commands/fun/slots.js";
import payCmd from "./commands/fun/pay.js";
import devCmd from "./commands/admin/dev.js";
// Music (Jockie-style)
import playCmd from "./commands/music/play.js";
import skipCmd from "./commands/music/skip.js";
import stopCmd from "./commands/music/stop.js";
import pauseCmd from "./commands/music/pause.js";
import queueCmd from "./commands/music/queue.js";
import nowplayingCmd from "./commands/music/nowplaying.js";
import volumeCmd from "./commands/music/volume.js";
import loopCmd from "./commands/music/loop.js";
import shuffleCmd from "./commands/music/shuffle.js";
import leaveCmd from "./commands/music/leave.js";
import musicpanelCmd from "./commands/music/musicpanel.js";
import { startGameCleanup } from "./lib/gameCleanup.js";

const ALL_COMMANDS = [
  pingCmd,
  avatarCmd,
  serverinfoCmd,
  userinfoCmd,
  helpCmd,
  botinfoCmd,
  banCmd,
  kickCmd,
  muteCmd,
  unmuteCmd,
  warnCmd,
  warnsCmd,
  clearwarnsCmd,
  delwarnCmd,
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
  cfglogsCmd,
  ticketCmd,
  walletCmd,
  shopCmd,
  inventoryCmd,
  topCmd,
  slotsCmd,
  payCmd,
  devCmd,
  playCmd,
  skipCmd,
  stopCmd,
  pauseCmd,
  queueCmd,
  nowplayingCmd,
  volumeCmd,
  loopCmd,
  shuffleCmd,
  leaveCmd,
  musicpanelCmd,
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
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildInvites,
      // Private messages → Gemini chat
      GatewayIntentBits.DirectMessages,
    ],
    partials: [
      Partials.Channel, // required to receive DMs
      Partials.Message,
      Partials.GuildMember,
      Partials.User,
    ],
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

  // Music providers (YouTube cookies + Spotify API)
  try {
    const { initMusicProviders } = await import("./music/config.js");
    const musicStatus = await initMusicProviders();
    logger.info(
      {
        youtubeCookies: musicStatus.youtubeCookies,
        spotify: musicStatus.spotify,
        cookiesPath: musicStatus.cookiesPath,
      },
      "🎵 Zero Two Music · providers listos",
    );
  } catch (err) {
    logger.warn({ err }, "🎵 No se pudieron inicializar providers de música");
  }

  // ── PRE-CARGA ESTRATÉGICA DE ENRUTADORES DE EVENTOS ──────────────────────────

  const { default: onReady } = await import("./events/ready.js");
  const { default: onInteractionCreate } = await import(
    "./events/interactionCreate.js"
  );
  const { default: onGuildCreate } = await import("./events/guildCreate.js");
  const { registerServerLogs } = await import("./events/serverLogs.js");
  const { registerDmChat } = await import("./events/dmChat.js");

  // Server monitoring logs (ban, unban, delete, edit, join, leave/kick)
  registerServerLogs(client);
  // Private DMs answered by Gemini (Zero Two)
  registerDmChat(client);

  // Re-run on each gateway ready (including after destroy()+login() restarts).
  // Guard against double-fire of ready + clientReady in the same connect cycle.
  let lastReadyAt = 0;
  const handleReady = async () => {
    const now = Date.now();
    if (now - lastReadyAt < 2000) return;
    lastReadyAt = now;

    try {
      await onReady(client);

      setBotClientForBot(client);
      setBotClientForGuilds(client);
      setBotClientForDev(client);
      setBotClientForTickets(client);

      startGameCleanup();
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
  };

  client.on("clientReady", handleReady);
  client.on("ready", handleReady);

  client.on("interactionCreate", async (interaction) => {
    try {
      await onInteractionCreate(interaction);
    } catch (err) {
      logger.error(
        { err },
        `❌ Colapso en el hilo de comandos al procesar interacción.`,
      );
      try {
        const { reportDevError, contextFromInteraction } = await import(
          "./lib/devErrorLog.js"
        );
        await reportDevError(client, err, contextFromInteraction(interaction));
      } catch {
        /* ignore secondary log failures */
      }
    }
  });

  // Uncaught errors in async bot work
  process.on("unhandledRejection", (reason) => {
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === "object" && reason && "message" in reason
          ? String((reason as { message: unknown }).message)
          : String(reason);
    // yt-dlp/ffmpeg pipe closes on skip/stop — expected, not fatal
    if (/EPIPE|ECONNRESET|PREMATURE_CLOSE/i.test(msg)) {
      logger.warn({ msg }, "unhandledRejection (pipe, ignored)");
      return;
    }
    logger.error({ err: reason }, "unhandledRejection");
    void import("./lib/devErrorLog.js")
      .then(({ reportDevError }) =>
        reportDevError(client, reason, {
          context: "process.unhandledRejection",
          guildId: null,
          guildName: null,
        }),
      )
      .catch(() => null);
  });

  process.on("uncaughtException", (err) => {
    // EPIPE on music pipes used to kill the whole bot process
    if (
      err &&
      typeof err === "object" &&
      ("code" in err
        ? ["EPIPE", "ECONNRESET", "ERR_STREAM_PREMATURE_CLOSE"].includes(
            String((err as { code?: string }).code),
          )
        : /EPIPE|ECONNRESET|PREMATURE_CLOSE/i.test(err.message))
    ) {
      logger.warn(
        { code: (err as { code?: string }).code, msg: err.message },
        "uncaughtException pipe (ignored — music skip/stop)",
      );
      return;
    }
    logger.fatal({ err }, "uncaughtException");
    process.exit(1);
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
