import type { ChatInputCommandInteraction, Guild } from "discord.js";

const DEFAULT_OWNER_ID = "819080793447333918";

function parseIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function specialUserIds(): string[] {
  return [...new Set([...ownerUserIds(), ...betaTesterIds()])];
}

export function ownerUserIds(): string[] {
  return parseIds(process.env.OWNER_IDS ?? DEFAULT_OWNER_ID);
}

export function betaTesterIds(): string[] {
  return parseIds(process.env.BETA_TESTER_IDS);
}

export function isBetaTesterId(userId: string): boolean {
  return betaTesterIds().includes(userId);
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

export function specialTreatmentLabel(userId?: string): string {
  if (userId && isBetaTesterId(userId) && !ownerUserIds().includes(userId)) {
    return "Betatester autorizado en este servidor";
  }

  return "Owner detectado en este servidor";
}
