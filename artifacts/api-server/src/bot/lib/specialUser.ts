import type { ChatInputCommandInteraction, Guild } from "discord.js";
import {
  getAllBetatesters,
  isBetaTester as isBetaTesterFromLib,
} from "./betatesters.js";

const DEFAULT_OWNER_ID = "819080793447333918";

function parseIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export function specialUserIds(): string[] {
  return [...new Set([...ownerUserIds(), ...betaTesterIds()])];
}

export function ownerUserIds(): string[] {
  const ids = parseIds(process.env.OWNER_IDS);
  return ids.length ? ids : [DEFAULT_OWNER_ID];
}

/** IDs beta (env + archivo persistente), sin owners */
export function betaTesterIds(): string[] {
  return getAllBetatesters();
}

export function isBetaTesterId(userId: string): boolean {
  // Etiqueta “betatester”: en lista beta y no es owner
  if (ownerUserIds().includes(userId)) return false;
  return getAllBetatesters().includes(userId);
}

export function isSpecialUserId(userId: string): boolean {
  return ownerUserIds().includes(userId) || isBetaTesterFromLib(userId);
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
