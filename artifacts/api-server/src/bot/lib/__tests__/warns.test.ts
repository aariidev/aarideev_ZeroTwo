import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @workspace/db ────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    $returningId: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockResolvedValue({}),
  };

  return {
    db: mockDb,
    warnsTable: {
      id: "id",
      guildId: "guildId",
      userId: "userId",
      username: "username",
      moderatorId: "moderatorId",
      moderatorName: "moderatorName",
      reason: "reason",
      createdAt: "createdAt",
    },
    eq: vi.fn((_col: unknown, _val: unknown) => true),
    and: vi.fn((..._args: unknown[]) => true),
    desc: vi.fn((col: unknown) => col),
  };
});

vi.mock("../../lib/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { formatWarnTimestamp } from "../warns.js";

// ── formatWarnTimestamp ───────────────────────────────────────────────────────

describe("formatWarnTimestamp", () => {
  it("devuelve '—' para null", () => {
    expect(formatWarnTimestamp(null)).toBe("—");
  });

  it("devuelve '—' para undefined", () => {
    expect(formatWarnTimestamp(undefined)).toBe("—");
  });

  it("devuelve '—' para string vacío", () => {
    expect(formatWarnTimestamp("")).toBe("—");
  });

  it("devuelve '—' para fecha inválida", () => {
    expect(formatWarnTimestamp("no-es-una-fecha")).toBe("—");
    expect(formatWarnTimestamp("invalid")).toBe("—");
  });

  it("formatea un objeto Date correctamente como timestamp relativo de Discord", () => {
    const date = new Date("2026-01-15T12:00:00.000Z");
    const expected = `<t:${Math.floor(date.getTime() / 1000)}:R>`;
    expect(formatWarnTimestamp(date)).toBe(expected);
  });

  it("formatea un string ISO correctamente", () => {
    const iso = "2026-06-01T08:30:00.000Z";
    const expected = `<t:${Math.floor(new Date(iso).getTime() / 1000)}:R>`;
    expect(formatWarnTimestamp(iso)).toBe(expected);
  });

  it("el timestamp resultante es un número entero (sin decimales)", () => {
    const date = new Date("2026-03-20T15:45:30.999Z");
    const result = formatWarnTimestamp(date);
    // Extrae el número entre <t: y :R>
    const match = result.match(/^<t:(\d+):R>$/);
    expect(match).not.toBeNull();
    const ts = Number(match![1]);
    expect(Number.isInteger(ts)).toBe(true);
  });

  it("acepta fechas históricas (Unix epoch cercana a 0)", () => {
    const date = new Date("1970-01-01T00:00:01.000Z");
    expect(formatWarnTimestamp(date)).toBe("<t:1:R>");
  });

  it("acepta fechas futuras", () => {
    const future = new Date("2030-12-31T23:59:59.000Z");
    const result = formatWarnTimestamp(future);
    expect(result).toMatch(/^<t:\d+:R>$/);
  });
});
