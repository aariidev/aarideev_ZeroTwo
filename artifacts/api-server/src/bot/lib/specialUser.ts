import type { ChatInputCommandInteraction, Guild } from "discord.js";

const DEFAULT_OWNER_ID = "819080793447333918";

export function specialUserIds(): string[] {
  return (process.env.OWNER_IDS ?? DEFAULT_OWNER_ID)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isSpecialUserId(userId: string): boolean {
  return specialUserIds().includes(userId);
}

export function isSpecialGuildUser(
  userId: string,
  guild: Guild | null | undefined,
): boolean {
  if (!guild || !isSpecialUserId(userId)) return false;
  return guild.members.cache.has(userId);
}

export function hasSpecialTreatment(
  interaction: ChatInputCommandInteraction,
): boolean {
  return Boolean(interaction.guild && isSpecialUserId(interaction.user.id));
}

export function specialTreatmentLabel(): string {
  return "Owner detectado en este servidor";
}
