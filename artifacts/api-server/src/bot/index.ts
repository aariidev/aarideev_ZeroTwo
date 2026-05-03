import { Client, Collection, Partials, GatewayIntentBits } from "discord.js";
import { logger } from "../lib/logger.js";
import { BotClient } from "./types.js";
import { setBotClient as setBotClientForBot } from "../routes/bot.js";
import { setBotClient as setBotClientForGuilds } from "../routes/guilds.js";
import { setBotClientForDev } from "../routes/dev.js";
import { devState } from "../lib/devState.js";
import { db } from "@workspace/db";
import { botConfigTable } from "@workspace/db";

// Utility commands
import pingCmd from "./commands/utility/ping.js";
import avatarCmd from "./commands/utility/avatar.js";
import serverinfoCmd from "./commands/utility/serverinfo.js";
import userinfoCmd from "./commands/utility/userinfo.js";
import helpCmd from "./commands/utility/help.js";

// Moderation commands
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

// Fun commands
import eightballCmd from "./commands/fun/8ball.js";
import coinflipCmd from "./commands/fun/coinflip.js";
import rollCmd from "./commands/fun/roll.js";

const ALL_COMMANDS = [
  // Utility
  pingCmd, avatarCmd, serverinfoCmd, userinfoCmd, helpCmd,
  // Moderation
  banCmd, kickCmd, muteCmd, unmuteCmd,
  warnCmd, warnsCmd, clearwarnsCmd, purgeCmd,
  timeoutCmd, untimeoutCmd, unbanCmd, slowmodeCmd, lockCmd, unlockCmd,
  // Fun
  eightballCmd, coinflipCmd, rollCmd,
];

export async function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    logger.warn("DISCORD_TOKEN no configurado — bot de Discord no iniciado.");
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
    if (command?.data && command?.execute) {
      client.commands.set(command.data.name, command);
    }
  }

  logger.info(`${client.commands.size} comandos cargados.`);

  client.once("ready", async () => {
    const { default: onReady } = await import("./events/ready.js");
    await onReady(client);
    setBotClientForBot(client);
    setBotClientForGuilds(client);
    setBotClientForDev(client);

    // Restore dev state from DB
    try {
      const rows = await db.select().from(botConfigTable);
      const maintenanceRow = rows.find((r) => r.key === "maintenance_mode");
      if (maintenanceRow) devState.maintenanceMode = maintenanceRow.value === "true";
      const messageRow = rows.find((r) => r.key === "maintenance_message");
      if (messageRow) devState.maintenanceMessage = messageRow.value;
      logger.info({ maintenanceMode: devState.maintenanceMode }, "Dev state restored from DB");
    } catch (err) {
      logger.error({ err }, "Could not restore dev state from DB");
    }
  });

  client.on("interactionCreate", async (interaction) => {
    const { default: onInteractionCreate } = await import("./events/interactionCreate.js");
    await onInteractionCreate(interaction);
  });

  client.on("guildCreate", async (guild) => {
    const { default: onGuildCreate } = await import("./events/guildCreate.js");
    onGuildCreate(guild);
  });

  await client.login(process.env.DISCORD_TOKEN);
  return client;
}
