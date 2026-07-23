import { Guild } from "discord.js";
import { logger } from "../../lib/logger.js";
import { db, activityTable } from "@workspace/db";
import { onGuildCountChange } from "../lib/presence.js";

export default async function onGuildCreate(guild: Guild) {
  if (!guild.available) return;

  const { id, name, memberCount, ownerId } = guild;

  logger.info(
    {
      guildId: id,
      guildName: name,
      members: memberCount,
      ownerId,
    },
    `¡Conexión establecida con una nueva plantación! 🌱 // Bot añadido a: ${name}`,
  );

  // Actualizar presencia con el nuevo contador de servidores
  onGuildCountChange(guild.client);

  try {
    await db.insert(activityTable).values({
      command: "EVENT_GUILD_CREATE",
      userId: ownerId,
      username: `Owner of ${name}`,
      guildId: id,
      guildName: name,
      success: true,
    });
  } catch (err) {
    logger.error(
      { err, guildId: id },
      "Error al registrar la nueva plantación en la base de datos",
    );
  }
}
