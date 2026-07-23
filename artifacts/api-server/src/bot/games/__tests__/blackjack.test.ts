import { describe, it, expect } from "vitest";
import {
  cardValue,
  handValue,
  parseCustomBet,
  clampBet,
  dealerPlay,
  createDeck,
  BJ_MIN_BET,
  BJ_MAX_BET,
  type Card,
  type GameState,
} from "../blackjack.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function card(rank: Card["rank"], suit: Card["suit"] = "♠"): Card {
  return { rank, suit };
}

function makeState(
  playerCards: Card[],
  dealerCards: Card[],
  extra: Partial<GameState> = {},
): GameState {
  return {
    playerHand: playerCards,
    dealerHand: dealerCards,
    deck: createDeck(),
    bet: 100,
    originalBet: 100,
    doubled: false,
    username: "testUser",
    avatarURL: "",
    guildId: "guild1",
    userId: "user1",
    startBalance: 1000,
    multiplierActive: false,
    insuranceActive: false,
    startedAt: new Date(),
    ...extra,
  };
}

// ── cardValue ─────────────────────────────────────────────────────────────────

describe("cardValue", () => {
  it("devuelve 11 para el As", () => {
    expect(cardValue("A")).toBe(11);
  });

  it("devuelve 10 para J, Q, K", () => {
    expect(cardValue("J")).toBe(10);
    expect(cardValue("Q")).toBe(10);
    expect(cardValue("K")).toBe(10);
  });

  it("devuelve el valor numérico para cartas 2–10", () => {
    for (let n = 2; n <= 10; n++) {
      expect(cardValue(String(n) as Card["rank"])).toBe(n);
    }
  });
});

// ── handValue ─────────────────────────────────────────────────────────────────

describe("handValue", () => {
  it("suma dos cartas numéricas correctamente", () => {
    expect(handValue([card("7"), card("8")])).toBe(15);
  });

  it("As + K = 21 (Blackjack natural)", () => {
    expect(handValue([card("A"), card("K")])).toBe(21);
  });

  it("As se convierte en 1 cuando la mano supera 21", () => {
    // A + 9 + 5 = 25 → As baja a 1 → total 15
    expect(handValue([card("A"), card("9"), card("5")])).toBe(15);
  });

  it("dos Ases: uno vale 11 y el otro 1 → 12", () => {
    expect(handValue([card("A"), card("A")])).toBe(12);
  });

  it("tres Ases: 11 + 1 + 1 = 13", () => {
    expect(handValue([card("A"), card("A"), card("A")])).toBe(13);
  });

  it("mano con figuras: K + Q = 20", () => {
    expect(handValue([card("K"), card("Q")])).toBe(20);
  });

  it("bust: 10 + 7 + 8 = 25", () => {
    expect(handValue([card("10"), card("7"), card("8")])).toBe(25);
  });

  it("mano vacía = 0", () => {
    expect(handValue([])).toBe(0);
  });
});

// ── parseCustomBet ────────────────────────────────────────────────────────────

describe("parseCustomBet", () => {
  it("parsea un número entero simple", () => {
    expect(parseCustomBet("500")).toBe(500);
  });

  it("parsea sufijo k (miles)", () => {
    expect(parseCustomBet("2k")).toBe(2000);
    expect(parseCustomBet("1.5k")).toBe(1500);
  });

  it("parsea sufijo m (millones)", () => {
    expect(parseCustomBet("1m")).toBe(1_000_000);
  });

  it("ignora comas, espacios y guiones bajos", () => {
    expect(parseCustomBet("1,500")).toBe(1500);
    expect(parseCustomBet("1 500")).toBe(1500);
    expect(parseCustomBet("1_500")).toBe(1500);
  });

  it("devuelve null para string vacío", () => {
    expect(parseCustomBet("")).toBeNull();
  });

  it("devuelve null para texto no numérico", () => {
    expect(parseCustomBet("abc")).toBeNull();
  });

  it("devuelve null para valor negativo", () => {
    expect(parseCustomBet("-100")).toBeNull();
  });

  it("devuelve null para cero", () => {
    expect(parseCustomBet("0")).toBeNull();
  });

  it("trunca decimales con floor", () => {
    expect(parseCustomBet("10.9")).toBe(10);
  });
});

// ── clampBet ──────────────────────────────────────────────────────────────────

describe("clampBet", () => {
  it("acepta una apuesta válida dentro del rango", () => {
    const result = clampBet(500, 1000);
    expect(result).toEqual({ ok: true, bet: 500 });
  });

  it("rechaza apuesta por debajo del mínimo", () => {
    const result = clampBet(BJ_MIN_BET - 1, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(`${BJ_MIN_BET}`);
  });

  it("rechaza apuesta por encima del máximo", () => {
    const result = clampBet(BJ_MAX_BET + 1, BJ_MAX_BET + 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("máxima");
  });

  it("rechaza apuesta mayor que el saldo", () => {
    const result = clampBet(500, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("insuficiente");
  });

  it("acepta apuesta exactamente igual al saldo", () => {
    const result = clampBet(1000, 1000);
    expect(result).toEqual({ ok: true, bet: 1000 });
  });

  it("acepta apuesta exactamente igual al mínimo", () => {
    const result = clampBet(BJ_MIN_BET, 10000);
    expect(result).toEqual({ ok: true, bet: BJ_MIN_BET });
  });

  it("acepta apuesta exactamente igual al máximo", () => {
    const result = clampBet(BJ_MAX_BET, BJ_MAX_BET + 1);
    expect(result).toEqual({ ok: true, bet: BJ_MAX_BET });
  });

  it("rechaza NaN", () => {
    const result = clampBet(NaN, 1000);
    expect(result.ok).toBe(false);
  });

  it("rechaza Infinity", () => {
    const result = clampBet(Infinity, 9_999_999);
    expect(result.ok).toBe(false);
  });
});

// ── dealerPlay ────────────────────────────────────────────────────────────────

describe("dealerPlay", () => {
  it("dealer se planta en 17 o más — resultado correcto si jugador tiene más", () => {
    // Jugador: 20, Dealer empieza en 17 → se planta → jugador gana
    const state = makeState(
      [card("K"), card("10")],  // player = 20
      [card("10"), card("7")],  // dealer = 17
    );
    // Le damos un deck sin cartas para que no pueda robar más
    state.deck = [];
    const status = dealerPlay(state);
    expect(status).toBe("win");
  });

  it("dealer bust → dealer_bust", () => {
    // Dealer empieza en 14 y el deck tiene un 10 → 24 (bust)
    const state = makeState(
      [card("K"), card("8")],   // player = 18
      [card("7"), card("7")],   // dealer = 14
    );
    state.deck = [card("10")];  // dealer roba 10 → 24
    const status = dealerPlay(state);
    expect(status).toBe("dealer_bust");
  });

  it("dealer gana cuando supera al jugador sin pasarse", () => {
    // Player = 16, Dealer empieza en 17 → se planta → dealer gana
    const state = makeState(
      [card("9"), card("7")],   // player = 16
      [card("10"), card("7")],  // dealer = 17
    );
    state.deck = [];
    const status = dealerPlay(state);
    expect(status).toBe("lose");
  });

  it("empate cuando jugador y dealer tienen el mismo valor", () => {
    const state = makeState(
      [card("K"), card("7")],   // player = 17
      [card("10"), card("7")],  // dealer = 17
    );
    state.deck = [];
    const status = dealerPlay(state);
    expect(status).toBe("push");
  });

  it("dealer pide cartas hasta llegar a 17+", () => {
    // Dealer empieza en 5 y el deck tiene 6, 6 (5+6=11, +6=17 → se planta)
    const state = makeState(
      [card("K"), card("K")],   // player = 20
      [card("2"), card("3")],   // dealer = 5
    );
    // Las cartas se sacan con pop(), así que el orden es inverso
    state.deck = [card("6"), card("6")]; // dealer roba 6 (pop) → 11, luego 6 → 17
    const status = dealerPlay(state);
    expect(handValue(state.dealerHand)).toBeGreaterThanOrEqual(17);
    expect(status).toBe("win"); // player 20 > dealer 17
  });
});

// ── createDeck ────────────────────────────────────────────────────────────────

describe("createDeck", () => {
  it("crea exactamente 52 cartas", () => {
    expect(createDeck()).toHaveLength(52);
  });

  it("no tiene cartas duplicadas", () => {
    const deck = createDeck();
    const unique = new Set(deck.map((c) => `${c.rank}${c.suit}`));
    expect(unique.size).toBe(52);
  });

  it("dos barajas creadas están en distinto orden (shuffle)", () => {
    const d1 = createDeck().map((c) => `${c.rank}${c.suit}`).join(",");
    const d2 = createDeck().map((c) => `${c.rank}${c.suit}`).join(",");
    // Es probabilísticamente imposible que coincidan (1/52! ≈ 0)
    expect(d1).not.toBe(d2);
  });
});
