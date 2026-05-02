import { Client, Collection, Partials, GatewayIntentBits } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";
import { logger } from "../lib/logger.js";
import { BotClient } from "./types.js";
import { setBotClient as setBotClientForBot } from "../routes/bot.js";
import { setBotClient as setBotClientForGuilds } from "../routes/guilds.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  // Load commands
  const commandDirs = ["utility", "moderation", "fun"];
  for (const dir of commandDirs) {
    const dirPath = path.join(__dirname, "commands", dir);
    let files: string[] = [];
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith(".js"));
    } catch {
      continue;
    }
    for (const file of files) {
      const mod = await import(path.join(dirPath, file));
      const command = mod.default;
      if (command?.data && command?.execute) {
        client.commands.set(command.data.name, command);
      }
    }
  }

  logger.info(`${client.commands.size} comandos cargados.`);

  // Load events
  client.once("ready", async () => {
    const { default: onReady } = await import("./events/ready.js");
    await onReady(client);
    setBotClientForBot(client);
    setBotClientForGuilds(client);
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
