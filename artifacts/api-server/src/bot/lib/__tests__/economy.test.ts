import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @workspace/db antes de importar economy ─────────────────────────────
// Las funciones de BD usan `db` de este módulo. Lo mockeamos para que
// los tests sean puramente unitarios y no necesiten MariaDB.

vi.mock("@workspace/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onDuplicateKeyUpdate: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  return {
    db: mockDb,
    economyTable: { guildId: "guildId", userId: "userId", balance: "balance" },
    inventoryTable: {
      guildId: "guildId",
      userId: "userId",
      itemId: "itemId",
      quantity: "quantity",
    },
    eq: vi.fn((_col: unknown, _val: unknown) => true),
    and: vi.fn((..._args: unknown[]) => true),
    sql: vi.fn((parts: TemplateStringsArray, ...vals: unknown[]) =>
      parts.join("?"),
    ),
    desc: vi.fn((col: unknown) => col),
  };
});

vi.mock("../../lib/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { calculateBlackjackPayout } from "../economy.js";

// ── calculateBlackjackPayout ──────────────────────────────────────────────────

describe("calculateBlackjackPayout", () => {
  // Sin power-ups activos

  describe("sin power-ups", () => {
    it("blackjack: devuelve apuesta + 1.5× (truncado)", () => {
      // Bet=100 → net=150 → payout=100+150=250
      expect(calculateBlackjackPayout("blackjack", 100, false, false)).toBe(250);
    });

    it("blackjack con apuesta impar: trunca correctamente", () => {
      // Bet=101 → net=floor(151.5)=151 → payout=252
      expect(calculateBlackjackPayout("blackjack", 101, false, false)).toBe(252);
    });

    it("push: devuelve la apuesta exacta", () => {
      expect(calculateBlackjackPayout("push", 500, false, false)).toBe(500);
    });

    it("win: devuelve apuesta × 2", () => {
      expect(calculateBlackjackPayout("win", 200, false, false)).toBe(400);
    });

    it("dealer_bust: devuelve apuesta × 2", () => {
      expect(calculateBlackjackPayout("dealer_bust", 300, false, false)).toBe(600);
    });

    it("bust: devuelve 0 (sin seguro)", () => {
      expect(calculateBlackjackPayout("bust", 100, false, false)).toBe(0);
    });

    it("lose: devuelve 0 (sin seguro)", () => {
      expect(calculateBlackjackPayout("lose", 100, false, false)).toBe(0);
    });

    it("estado desconocido: devuelve 0", () => {
      expect(calculateBlackjackPayout("playing", 100, false, false)).toBe(0);
    });
  });

  // Con multiplicador activo

  describe("con multiplierActive", () => {
    it("blackjack + multiplicador: net se duplica", () => {
      // Bet=100 → net=150 → net*2=300 → payout=100+300=400
      expect(calculateBlackjackPayout("blackjack", 100, true, false)).toBe(400);
    });

    it("win + multiplicador: apuesta × 3", () => {
      expect(calculateBlackjackPayout("win", 200, true, false)).toBe(600);
    });

    it("dealer_bust + multiplicador: apuesta × 3", () => {
      expect(calculateBlackjackPayout("dealer_bust", 100, true, false)).toBe(300);
    });

    it("push no se ve afectado por el multiplicador", () => {
      expect(calculateBlackjackPayout("push", 100, true, false)).toBe(100);
    });

    it("bust + multiplicador sin seguro: sigue siendo 0", () => {
      expect(calculateBlackjackPayout("bust", 100, true, false)).toBe(0);
    });
  });

  // Con seguro activo

  describe("con insuranceActive", () => {
    it("bust + seguro: devuelve el 50% de la apuesta (truncado)", () => {
      expect(calculateBlackjackPayout("bust", 100, false, true)).toBe(50);
    });

    it("lose + seguro: devuelve el 50%", () => {
      expect(calculateBlackjackPayout("lose", 200, false, true)).toBe(100);
    });

    it("bust + seguro con apuesta impar: trunca", () => {
      // floor(101 * 0.5) = floor(50.5) = 50
      expect(calculateBlackjackPayout("bust", 101, false, true)).toBe(50);
    });

    it("win + seguro: el seguro no afecta victorias", () => {
      expect(calculateBlackjackPayout("win", 100, false, true)).toBe(200);
    });
  });

  // Casos extremos

  describe("casos extremos", () => {
    it("apuesta 0: todos los estados devuelven 0 o 0", () => {
      expect(calculateBlackjackPayout("win", 0, false, false)).toBe(0);
      expect(calculateBlackjackPayout("blackjack", 0, false, false)).toBe(0);
    });

    it("apuesta máxima (100 000): win sin multiplicador", () => {
      expect(calculateBlackjackPayout("win", 100_000, false, false)).toBe(200_000);
    });

    it("apuesta máxima + multiplicador: win devuelve 300 000", () => {
      expect(calculateBlackjackPayout("win", 100_000, true, false)).toBe(300_000);
    });
  });
});
