import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  guildLevelSettingsTable: {},
  userLevelsTable: {},
  guildWelcomeSettingsTable: {},
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  xpForLevel,
  levelFromTotalXp,
  progressBar,
  rankTitle,
} from "../levels.js";
import {
  ACHIEVEMENT_CATALOG,
  achievementsEarned,
  newlyUnlocked,
  parseAchievementsJson,
  formatAchievementList,
  getAchievementDef,
} from "../achievements.js";
import {
  renderWelcomeTemplate,
  type WelcomeTemplateVars,
} from "../welcome.js";

// ── XP curve ──────────────────────────────────────────────────────────────────

describe("xpForLevel", () => {
  it("nivel 0 requiere 100 XP", () => {
    expect(xpForLevel(0)).toBe(100);
  });

  it("crece con el nivel", () => {
    expect(xpForLevel(5)).toBeGreaterThan(xpForLevel(0));
    expect(xpForLevel(20)).toBeGreaterThan(xpForLevel(5));
  });
});

describe("levelFromTotalXp", () => {
  it("0 XP → nivel 0", () => {
    const r = levelFromTotalXp(0);
    expect(r.level).toBe(0);
    expect(r.xpIntoLevel).toBe(0);
    expect(r.xpNeeded).toBe(xpForLevel(0));
  });

  it("exactamente un nivel completo sube a 1", () => {
    const need = xpForLevel(0);
    const r = levelFromTotalXp(need);
    expect(r.level).toBe(1);
    expect(r.xpIntoLevel).toBe(0);
  });

  it("XP parcial se refleja en xpIntoLevel", () => {
    const r = levelFromTotalXp(50);
    expect(r.level).toBe(0);
    expect(r.xpIntoLevel).toBe(50);
  });

  it("es monótono: más XP nunca baja de nivel", () => {
    let prev = 0;
    for (let xp = 0; xp < 50_000; xp += 500) {
      const lv = levelFromTotalXp(xp).level;
      expect(lv).toBeGreaterThanOrEqual(prev);
      prev = lv;
    }
  });
});

describe("progressBar", () => {
  it("vacía al 0%", () => {
    expect(progressBar(0, 100, 10)).toBe("░".repeat(10));
  });

  it("llena al 100%", () => {
    expect(progressBar(100, 100, 10)).toBe("█".repeat(10));
  });

  it("mitad aprox 5/10", () => {
    expect(progressBar(50, 100, 10)).toBe("█".repeat(5) + "░".repeat(5));
  });
});

describe("rankTitle", () => {
  it("nivel bajo es recluta", () => {
    expect(rankTitle(0)).toMatch(/Recruta|🐣/);
  });

  it("nivel alto es legendaria", () => {
    expect(rankTitle(100)).toMatch(/Legendaria|👑/);
  });
});

// ── Achievements ──────────────────────────────────────────────────────────────

describe("achievements", () => {
  it("catálogo no vacío y ids únicos", () => {
    expect(ACHIEVEMENT_CATALOG.length).toBeGreaterThan(5);
    const ids = ACHIEVEMENT_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nivel 0 sin mensajes no desbloquea first_steps", () => {
    expect(achievementsEarned({ level: 0, totalMessages: 0, voiceMinutes: 0 })).toEqual(
      [],
    );
  });

  it("nivel 1 desbloquea first_steps", () => {
    const earned = achievementsEarned({
      level: 1,
      totalMessages: 0,
      voiceMinutes: 0,
    });
    expect(earned).toContain("first_steps");
  });

  it("nivel 10 incluye intermediate level achievements", () => {
    const earned = achievementsEarned({
      level: 10,
      totalMessages: 0,
      voiceMinutes: 0,
    });
    expect(earned).toEqual(
      expect.arrayContaining(["first_steps", "level_5", "level_10"]),
    );
    expect(earned).not.toContain("level_25");
  });

  it("mensajes desbloquean chatter", () => {
    const earned = achievementsEarned({
      level: 0,
      totalMessages: 1000,
      voiceMinutes: 0,
    });
    expect(earned).toContain("chatter_100");
    expect(earned).toContain("chatter_1k");
    expect(earned).not.toContain("chatter_10k");
  });

  it("voz desbloquea voice_60", () => {
    const earned = achievementsEarned({
      level: 0,
      totalMessages: 0,
      voiceMinutes: 60,
    });
    expect(earned).toContain("voice_60");
    expect(earned).not.toContain("voice_600");
  });

  it("newlyUnlocked omite los ya tenidos", () => {
    const stats = { level: 10, totalMessages: 0, voiceMinutes: 0 };
    const neu = newlyUnlocked(stats, ["first_steps", "level_5"]);
    expect(neu).toContain("level_10");
    expect(neu).not.toContain("first_steps");
    expect(neu).not.toContain("level_5");
  });

  it("parseAchievementsJson maneja basura", () => {
    expect(parseAchievementsJson(null)).toEqual([]);
    expect(parseAchievementsJson("no-json")).toEqual([]);
    expect(parseAchievementsJson('["a",1,"b"]')).toEqual(["a", "b"]);
  });

  it("formatAchievementList cuenta bien", () => {
    const { unlockedCount } = formatAchievementList(["first_steps", "level_5"]);
    expect(unlockedCount).toBe(2);
  });

  it("getAchievementDef encuentra por id", () => {
    expect(getAchievementDef("level_100")?.emoji).toBe("👑");
    expect(getAchievementDef("nope")).toBeUndefined();
  });
});

// ── Welcome templates ─────────────────────────────────────────────────────────

describe("renderWelcomeTemplate", () => {
  const vars: WelcomeTemplateVars = {
    user: "<@123>",
    username: "ari",
    server: "Nexo",
    memberCount: "42",
    accountAge: "<t:1:R>",
    userId: "123",
  };

  it("reemplaza placeholders", () => {
    const out = renderWelcomeTemplate(
      "Hola {user} en {server} #{memberCount} ({username})",
      vars,
    );
    expect(out).toBe("Hola <@123> en Nexo #42 (ari)");
  });

  it("soporta {userid}", () => {
    expect(renderWelcomeTemplate("id={userid}", vars)).toBe("id=123");
  });

  it("trunca a 4000 chars", () => {
    const long = "x".repeat(5000);
    expect(renderWelcomeTemplate(long, vars).length).toBe(4000);
  });
});
