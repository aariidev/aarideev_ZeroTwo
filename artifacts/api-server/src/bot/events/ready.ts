import { Client, ActivityType } from "discord.js";
import { logger } from "../../lib/logger.js";
import { REST, Routes } from "discord.js";
import { BotClient } from "../types.js";

export default async function onReady(client: Client) {
  const botClient = client as BotClient;
  logger.info(`Bot listo: ${client.user?.tag}`);

  const activities = [
    { name: "ZeroTwo v2.0", type: ActivityType.Playing },
    { name: `${client.guilds.cache.size} servidores`, type: ActivityType.Watching },
    { name: "/help", type: ActivityType.Listening },
  ];

  let i = 0;
  const updateActivity = () => {
    const act = activities[i % activities.length]!;
    client.user?.setActivity(act.name, { type: act.type });
    i++;
  };
  updateActivity();
  setInterval(updateActivity, 20000);

  // Register slash commands globally
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);
  const commands = botClient.commands.map((cmd) => cmd.data.toJSON());
  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands });
    logger.info(`${commands.length} comandos registrados globalmente.`);
  } catch (err) {
    logger.error({ err }, "Error registrando comandos");
  }
}
