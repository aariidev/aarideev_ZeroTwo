import { Guild } from "discord.js";
import { logger } from "../../lib/logger.js";

export default function onGuildCreate(guild: Guild) {
  logger.info({ guildId: guild.id, guildName: guild.name }, "Bot añadido a nuevo servidor");
}
