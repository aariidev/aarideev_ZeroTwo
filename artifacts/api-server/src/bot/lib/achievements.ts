/**
 * Logros de nivel — catálogo puro + evaluación (testeable sin BD).
 */
export type AchievementId =
  | "first_steps"
  | "level_5"
  | "level_10"
  | "level_25"
  | "level_50"
  | "level_100"
  | "chatter_100"
  | "chatter_1k"
  | "chatter_10k"
  | "voice_60"
  | "voice_600"
  | "voice_3k";

export type AchievementDef = {
  id: AchievementId;
  name: string;
  description: string;
  emoji: string;
  /** Minimum level required (0 = n/a) */
  minLevel: number;
  /** Minimum total messages */
  minMessages: number;
  /** Minimum voice minutes */
  minVoiceMinutes: number;
};

export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  {
    id: "first_steps",
    name: "Primeros pasos",
    description: "Alcanza el nivel 1",
    emoji: "🌱",
    minLevel: 1,
    minMessages: 0,
    minVoiceMinutes: 0,
  },
  {
    id: "level_5",
    name: "Aprendiz del nexo",
    description: "Alcanza el nivel 5",
    emoji: "🌸",
    minLevel: 5,
    minMessages: 0,
    minVoiceMinutes: 0,
  },
  {
    id: "level_10",
    name: "Partner",
    description: "Alcanza el nivel 10",
    emoji: "⚔️",
    minLevel: 10,
    minMessages: 0,
    minVoiceMinutes: 0,
  },
  {
    id: "level_25",
    name: "Piloto veterano",
    description: "Alcanza el nivel 25",
    emoji: "🔥",
    minLevel: 25,
    minMessages: 0,
    minVoiceMinutes: 0,
  },
  {
    id: "level_50",
    name: "Élite del nexo",
    description: "Alcanza el nivel 50",
    emoji: "💎",
    minLevel: 50,
    minMessages: 0,
    minVoiceMinutes: 0,
  },
  {
    id: "level_100",
    name: "Legendaria",
    description: "Alcanza el nivel 100",
    emoji: "👑",
    minLevel: 100,
    minMessages: 0,
    minVoiceMinutes: 0,
  },
  {
    id: "chatter_100",
    name: "Charlatán",
    description: "Envía 100 mensajes",
    emoji: "💬",
    minLevel: 0,
    minMessages: 100,
    minVoiceMinutes: 0,
  },
  {
    id: "chatter_1k",
    name: "Voz del servidor",
    description: "Envía 1.000 mensajes",
    emoji: "📢",
    minLevel: 0,
    minMessages: 1000,
    minVoiceMinutes: 0,
  },
  {
    id: "chatter_10k",
    name: "Cronista",
    description: "Envía 10.000 mensajes",
    emoji: "📜",
    minLevel: 0,
    minMessages: 10_000,
    minVoiceMinutes: 0,
  },
  {
    id: "voice_60",
    name: "Micrófono caliente",
    description: "1 hora en canales de voz",
    emoji: "🎙️",
    minLevel: 0,
    minMessages: 0,
    minVoiceMinutes: 60,
  },
  {
    id: "voice_600",
    name: "Habitante del VC",
    description: "10 horas en voz",
    emoji: "🎧",
    minLevel: 0,
    minMessages: 0,
    minVoiceMinutes: 600,
  },
  {
    id: "voice_3k",
    name: "Alma de la call",
    description: "50 horas en voz",
    emoji: "🌌",
    minLevel: 0,
    minMessages: 0,
    minVoiceMinutes: 3000,
  },
];

export type AchievementStats = {
  level: number;
  totalMessages: number;
  voiceMinutes: number;
};

/** Pure: which achievements are unlocked for these stats (regardless of history). */
export function achievementsEarned(stats: AchievementStats): AchievementId[] {
  return ACHIEVEMENT_CATALOG.filter(
    (a) =>
      stats.level >= a.minLevel &&
      stats.totalMessages >= a.minMessages &&
      stats.voiceMinutes >= a.minVoiceMinutes &&
      // if all mins are 0 except one dimension, still ok; first_steps needs level>=1
      (a.minLevel > 0 || a.minMessages > 0 || a.minVoiceMinutes > 0),
  ).map((a) => a.id);
}

/** Pure: newly unlocked ids not in `already`. */
export function newlyUnlocked(
  stats: AchievementStats,
  already: readonly string[],
): AchievementId[] {
  const have = new Set(already);
  return achievementsEarned(stats).filter((id) => !have.has(id));
}

export function parseAchievementsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENT_CATALOG.find((a) => a.id === id);
}

export function formatAchievementList(
  unlocked: readonly string[],
): { unlockedLines: string; lockedLines: string; unlockedCount: number } {
  const have = new Set(unlocked);
  const unlockedLines = ACHIEVEMENT_CATALOG.filter((a) => have.has(a.id))
    .map((a) => `${a.emoji} **${a.name}** — ${a.description}`)
    .join("\n");
  const lockedLines = ACHIEVEMENT_CATALOG.filter((a) => !have.has(a.id))
    .map((a) => `🔒 ${a.name} — ${a.description}`)
    .join("\n");
  return {
    unlockedLines: unlockedLines || "_Ningún logro aún. ¡Sigue participando!_",
    lockedLines: lockedLines || "_¡Todos desbloqueados!_",
    unlockedCount: ACHIEVEMENT_CATALOG.filter((a) => have.has(a.id)).length,
  };
}
