/**
 * AutoMod pack for Zero Two — badge progress (~100 rules across guilds).
 *
 * Discord hard limits per guild (API-enforced):
 * - ~6 rules total
 * - KeywordPreset (type 4): MAX 1 rule (must put all presets in that one rule)
 * - Spam / MentionSpam: typically max 1 each
 */
import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  AutoModerationRuleKeywordPresetType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type AutoModerationRule,
} from "discord.js";
import { logger } from "../../lib/logger.js";

/** ASCII-only prefix (no middle-dot → no mojibake). */
export const AUTOMOD_PREFIX = "ZT | ";

const OUR_PREFIXES = [AUTOMOD_PREFIX, "ZT · ", "ZT - ", "ZT "];

/** API numeric trigger types (never trust string enums alone). */
const TRIGGER = {
  Keyword: 1,
  Spam: 3,
  KeywordPreset: 4,
  MentionSpam: 5,
} as const;

export type AutomodInstallResult = {
  guildId: string;
  guildName: string;
  created: number;
  skipped: number;
  errors: string[];
};

function canManageAutomod(guild: Guild): boolean {
  const me = guild.members.me;
  if (!me) return false;
  return me.permissions.has(PermissionFlagsBits.ManageGuild);
}

function isOurRule(name: string): boolean {
  return OUR_PREFIXES.some((p) => name.startsWith(p));
}

function triggerNum(rule: AutoModerationRule): number {
  return Number(rule.triggerType);
}

function countByTrigger(
  rules: AutoModerationRule[],
  type: number,
): number {
  return rules.filter((r) => triggerNum(r) === type).length;
}

export async function countAutomodRules(
  client: Client,
): Promise<{
  total: number;
  ours: number;
  byGuild: { id: string; name: string; n: number }[];
}> {
  let total = 0;
  let ours = 0;
  const byGuild: { id: string; name: string; n: number }[] = [];

  for (const guild of client.guilds.cache.values()) {
    if (!canManageAutomod(guild)) continue;
    try {
      const rules = await guild.autoModerationRules.fetch();
      total += rules.size;
      for (const r of rules.values()) {
        if (isOurRule(r.name)) ours++;
      }
      if (rules.size > 0) {
        byGuild.push({ id: guild.id, name: guild.name, n: rules.size });
      }
    } catch {
      /* no access */
    }
  }

  byGuild.sort((a, b) => b.n - a.n);
  return { total, ours, byGuild };
}

async function fetchRules(guild: Guild): Promise<AutoModerationRule[]> {
  const fetched = await guild.autoModerationRules.fetch();
  return [...fetched.values()];
}

/**
 * Install pack. Never creates a second KeywordPreset / Spam / MentionSpam.
 */
export async function installAutomodPack(
  guild: Guild,
): Promise<AutomodInstallResult> {
  const result: AutomodInstallResult = {
    guildId: guild.id,
    guildName: guild.name,
    created: 0,
    skipped: 0,
    errors: [],
  };

  if (!canManageAutomod(guild)) {
    result.errors.push("Falta permiso Gestionar servidor");
    return result;
  }

  let rules: AutoModerationRule[];
  try {
    rules = await fetchRules(guild);
  } catch (err) {
    result.errors.push(
      err instanceof Error ? err.message : "No se pudieron listar reglas",
    );
    return result;
  }

  const blockMsg = {
    type: AutoModerationActionType.BlockMessage as const,
    metadata: {
      customMessage:
        "Bloqueado por Zero Two AutoMod - sigue las normas del servidor.",
    },
  };

  type Spec = {
    name: string;
    /** If set, at most 1 rule of this trigger type may exist in the guild */
    maxOneOfType?: number;
    create: () => Promise<unknown>;
  };

  const specs: Spec[] = [
    {
      name: `${AUTOMOD_PREFIX}Anti-spam`,
      maxOneOfType: TRIGGER.Spam,
      create: () =>
        guild.autoModerationRules.create({
          name: `${AUTOMOD_PREFIX}Anti-spam`,
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Spam,
          actions: [blockMsg],
          enabled: true,
          reason: "Zero Two AutoMod pack",
        }),
    },
    {
      name: `${AUTOMOD_PREFIX}Menciones masivas`,
      maxOneOfType: TRIGGER.MentionSpam,
      create: () =>
        guild.autoModerationRules.create({
          name: `${AUTOMOD_PREFIX}Menciones masivas`,
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.MentionSpam,
          triggerMetadata: { mentionTotalLimit: 5 },
          actions: [blockMsg],
          enabled: true,
          reason: "Zero Two AutoMod pack",
        }),
    },
    {
      name: `${AUTOMOD_PREFIX}Invitaciones`,
      create: () =>
        guild.autoModerationRules.create({
          name: `${AUTOMOD_PREFIX}Invitaciones`,
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: {
            keywordFilter: [
              "*discord.gg/*",
              "*discord.com/invite/*",
              "*discordapp.com/invite/*",
            ],
          },
          actions: [blockMsg],
          enabled: true,
          reason: "Zero Two AutoMod pack",
        }),
    },
    {
      name: `${AUTOMOD_PREFIX}Estafas`,
      create: () =>
        guild.autoModerationRules.create({
          name: `${AUTOMOD_PREFIX}Estafas`,
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: {
            keywordFilter: [
              "*steamcommunity.com/gift*",
              "*free nitro*",
              "*nitro free*",
              "*@everyone free*",
              "*airdrop*",
            ],
          },
          actions: [blockMsg],
          enabled: true,
          reason: "Zero Two AutoMod pack",
        }),
    },
    // SINGLE KeywordPreset only (type 4 max = 1) — all Discord presets combined
    {
      name: `${AUTOMOD_PREFIX}Filtros Discord (preset)`,
      maxOneOfType: TRIGGER.KeywordPreset,
      create: () =>
        guild.autoModerationRules.create({
          name: `${AUTOMOD_PREFIX}Filtros Discord (preset)`,
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.KeywordPreset,
          triggerMetadata: {
            presets: [
              AutoModerationRuleKeywordPresetType.Profanity,
              AutoModerationRuleKeywordPresetType.SexualContent,
              AutoModerationRuleKeywordPresetType.Slurs,
            ],
          },
          actions: [blockMsg],
          enabled: true,
          reason: "Zero Two AutoMod pack",
        }),
    },
    {
      name: `${AUTOMOD_PREFIX}Links sospechosos`,
      create: () =>
        guild.autoModerationRules.create({
          name: `${AUTOMOD_PREFIX}Links sospechosos`,
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: {
            keywordFilter: [
              "*bit.ly/*",
              "*tinyurl.com/*",
              "*grabify*",
              "*iplogger*",
              "*free-nitro*",
            ],
          },
          actions: [blockMsg],
          enabled: true,
          reason: "Zero Two AutoMod pack",
        }),
    },
  ];

  const namesMatchOurs = (name: string) =>
    rules.some((r) => r.name === name) ||
    // legacy names from earlier packs
    (name.includes("Filtros Discord") &&
      rules.some(
        (r) =>
          isOurRule(r.name) &&
          (r.name.includes("Insultos") ||
            r.name.includes("Contenido sexual") ||
            r.name.includes("preset") ||
            r.name.includes("Filtros Discord")),
      ));

  for (const spec of specs) {
    // Fresh count each iteration (type exclusivity)
    if (rules.some((r) => r.name === spec.name)) {
      result.skipped++;
      continue;
    }

    // Legacy: already have a ZT preset rule under old name → skip new combined preset
    if (spec.maxOneOfType === TRIGGER.KeywordPreset) {
      const hasAnyPreset = countByTrigger(rules, TRIGGER.KeywordPreset) >= 1;
      const hasLegacyPreset = rules.some(
        (r) =>
          isOurRule(r.name) &&
          (r.name.includes("Insultos") ||
            r.name.includes("Contenido sexual") ||
            r.name.includes("preset") ||
            r.name.includes("Filtros")),
      );
      if (hasAnyPreset || hasLegacyPreset) {
        result.skipped++;
        logger.info(
          {
            guildId: guild.id,
            presetCount: countByTrigger(rules, TRIGGER.KeywordPreset),
          },
          "automod: KeywordPreset already present — skip",
        );
        continue;
      }
    }

    if (
      spec.maxOneOfType != null &&
      countByTrigger(rules, spec.maxOneOfType) >= 1
    ) {
      result.skipped++;
      continue;
    }

    if (rules.length >= 6) {
      result.errors.push(`Limite de 6 reglas AutoMod en ${guild.name}`);
      break;
    }

    try {
      // Re-check exclusive types right before POST (race / stale cache)
      if (spec.maxOneOfType != null) {
        try {
          rules = await fetchRules(guild);
        } catch {
          /* use previous list */
        }
        if (countByTrigger(rules, spec.maxOneOfType) >= 1) {
          result.skipped++;
          continue;
        }
      }

      await spec.create();
      result.created++;

      // Keep local list in sync without full refetch
      try {
        rules = await fetchRules(guild);
      } catch {
        // Approximate: push a stub so type counts stay correct
        rules = [
          ...rules,
          {
            name: spec.name,
            triggerType: spec.maxOneOfType ?? TRIGGER.Keyword,
          } as AutoModerationRule,
        ];
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /MAX_RULES_OF_TYPE|Maximum number of rules with trigger type|MAX_RULES_EXCEEDED/i.test(
          msg,
        )
      ) {
        result.skipped++;
        logger.info(
          { guildId: guild.id, rule: spec.name },
          "automod: Discord type/total limit — skipped (not an error)",
        );
        // Refresh so subsequent exclusive checks see reality
        try {
          rules = await fetchRules(guild);
        } catch {
          /* ignore */
        }
        continue;
      }
      result.errors.push(`${spec.name}: ${msg}`);
      logger.warn(
        { err, guildId: guild.id, rule: spec.name },
        "automod: create failed",
      );
    }
  }

  void namesMatchOurs; // reserved for future name-aliases
  return result;
}

export async function removeAutomodPack(
  guild: Guild,
): Promise<{ removed: number; errors: string[] }> {
  const errors: string[] = [];
  let removed = 0;
  if (!canManageAutomod(guild)) {
    return { removed: 0, errors: ["Falta permiso Gestionar servidor"] };
  }
  try {
    const rules = await fetchRules(guild);
    for (const r of rules) {
      if (!isOurRule(r.name)) continue;
      try {
        await r.delete("Zero Two AutoMod uninstall");
        removed++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  return { removed, errors };
}

export async function installAutomodEverywhere(
  client: Client,
): Promise<AutomodInstallResult[]> {
  const results: AutomodInstallResult[] = [];
  for (const guild of client.guilds.cache.values()) {
    const r = await installAutomodPack(guild);
    results.push(r);
    await new Promise((res) => setTimeout(res, 750));
  }
  return results;
}

export type GuildAutomodSnapshot = {
  guildId: string;
  guildName: string;
  total: number;
  ours: number;
  enabled: number;
  canManage: boolean;
  rules: {
    id: string;
    name: string;
    enabled: boolean;
    ours: boolean;
    trigger: string;
  }[];
};

const TRIGGER_LABEL: Record<number, string> = {
  1: "Palabras clave",
  2: "Palabras spam (legacy)",
  3: "Anti-spam",
  4: "Preset Discord",
  5: "Menciones",
  6: "Palabras de miembro",
};

/**
 * Estado de AutoMod solo en este servidor (para /automod status local).
 */
export async function getGuildAutomodSnapshot(
  guild: Guild,
): Promise<GuildAutomodSnapshot> {
  const snap: GuildAutomodSnapshot = {
    guildId: guild.id,
    guildName: guild.name,
    total: 0,
    ours: 0,
    enabled: 0,
    canManage: canManageAutomod(guild),
    rules: [],
  };

  if (!snap.canManage) return snap;

  try {
    const rules = await fetchRules(guild);
    snap.total = rules.length;
    for (const r of rules) {
      const ours = isOurRule(r.name);
      if (ours) snap.ours++;
      if (r.enabled) snap.enabled++;
      snap.rules.push({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        ours,
        trigger: TRIGGER_LABEL[triggerNum(r)] ?? `tipo ${triggerNum(r)}`,
      });
    }
    snap.rules.sort((a, b) => a.name.localeCompare(b.name, "es"));
  } catch {
    /* no access */
  }

  return snap;
}

/** Nombres del pack que intenta instalar Zero Two */
export function automodPackNames(): string[] {
  return [
    `${AUTOMOD_PREFIX}Anti-spam`,
    `${AUTOMOD_PREFIX}Menciones masivas`,
    `${AUTOMOD_PREFIX}Invitaciones`,
    `${AUTOMOD_PREFIX}Estafas`,
    `${AUTOMOD_PREFIX}Filtros Discord (preset)`,
    `${AUTOMOD_PREFIX}Links sospechosos`,
  ];
}
