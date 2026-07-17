import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "J" | "Q" | "K";
export type Card = { suit: Suit; rank: Rank };

export type GameStatus =
  | "playing" | "win" | "lose" | "push"
  | "blackjack" | "bust" | "dealer_bust";

export interface GameState {
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  bet: number;
  originalBet: number;
  doubled: boolean;
  username: string;
  avatarURL: string;
  // Economy
  guildId: string;
  userId: string;
  startBalance: number;
  multiplierActive: boolean;
  insuranceActive: boolean;
  finalBalance?: number;
  netResult?: number;
  netLabel?: string;
  startedAt: Date;
}

export const BJ_MIN_BET = 10;
export const BJ_MAX_BET = 100_000;
export const BJ_PRESET_BETS = [50, 100, 250, 500, 1000, 2500, 5000] as const;

// ── Active games (in-memory) ──────────────────────────────────────────────────
export const activeGames = new Map<string, GameState>();

/** Last bet amount per user (for rematch) */
export const lastBets = new Map<string, number>();

// ── Deck helpers ──────────────────────────────────────────────────────────────
export function createDeck(): Card[] {
  const suits: Suit[] = ["♠", "♥", "♦", "♣"];
  const ranks: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const deck: Card[] = [];
  for (const suit of suits) for (const rank of ranks) deck.push({ suit, rank });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

export function cardValue(rank: Rank): number {
  if (["J", "Q", "K"].includes(rank)) return 10;
  if (rank === "A") return 11;
  return parseInt(rank);
}

export function handValue(hand: Card[]): number {
  let total = hand.reduce((s, c) => s + cardValue(c.rank), 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (total > 21 && aces-- > 0) total -= 10;
  return total;
}

export function parseCustomBet(raw: string): number | null {
  const cleaned = raw.trim().replace(/[,\s_]/g, "").toLowerCase();
  if (!cleaned) return null;
  let mult = 1;
  let numStr = cleaned;
  if (cleaned.endsWith("k")) {
    mult = 1_000;
    numStr = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("m")) {
    mult = 1_000_000;
    numStr = cleaned.slice(0, -1);
  }
  const n = Number(numStr);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n * mult);
}

export function clampBet(amount: number, balance: number): {
  ok: true;
  bet: number;
} | { ok: false; error: string } {
  if (!Number.isFinite(amount) || amount < BJ_MIN_BET) {
    return {
      ok: false,
      error: `Apuesta mínima: **${BJ_MIN_BET}** fichas.`,
    };
  }
  if (amount > BJ_MAX_BET) {
    return {
      ok: false,
      error: `Apuesta máxima: **${BJ_MAX_BET.toLocaleString()}** fichas.`,
    };
  }
  if (amount > balance) {
    return {
      ok: false,
      error: `Saldo insuficiente. Necesitas **${amount.toLocaleString()}** pero tienes **${balance.toLocaleString()}**.`,
    };
  }
  return { ok: true, bet: Math.floor(amount) };
}

// ── Card rendering ────────────────────────────────────────────────────────────
function fmt(c: Card): string {
  return `\`${c.rank}${c.suit}\``;
}

function fmtHand(hand: Card[], hideSecond = false): string {
  return hand
    .map((c, i) => (hideSecond && i === 1 ? "`?? 🂠`" : fmt(c)))
    .join("  ");
}

function barProgress(value: number, max = 21, length = 10): string {
  const filled = Math.min(Math.round((value / max) * length), length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

// ── Embed builder ─────────────────────────────────────────────────────────────
const STATUS_META: Record<GameStatus, { color: number; title: string }> = {
  playing:     { color: 0xec4899, title: "🃏 Blackjack — En juego" },
  win:         { color: 0x00ff88, title: "🏆 ¡Victoria!" },
  lose:        { color: 0xff2d6b, title: "💀 Derrota" },
  push:        { color: 0xffa500, title: "🤝 Empate — Apuesta devuelta" },
  blackjack:   { color: 0xffd700, title: "🌟 ¡BLACKJACK! — Pago ×1.5" },
  bust:        { color: 0xff2d6b, title: "💥 ¡Bust! — Superaste 21" },
  dealer_bust: { color: 0x00ff88, title: "💥 Dealer Bust — ¡Ganaste!" },
};

export function buildEmbed(
  state: GameState,
  status: GameStatus,
  botIcon?: string,
): EmbedBuilder {
  const { playerHand, dealerHand, bet, doubled, username, avatarURL } = state;
  const meta = STATUS_META[status];
  const isPlaying = status === "playing";

  const playerVal = handValue(playerHand);
  const dealerVal = isPlaying
    ? handValue([dealerHand[0]!])
    : handValue(dealerHand);

  const playerBar = barProgress(playerVal);
  const dealerBar = barProgress(dealerVal);

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setAuthor({ name: "ZeroTwo Casino · Blackjack", iconURL: botIcon })
    .setTitle(meta.title)
    .setThumbnail(avatarURL || null);

  if (isPlaying) {
    embed.setDescription(
      "```\n" +
        "  Hit    — Pide una carta más\n" +
        "  Stand  — Plantarse con lo que tienes\n" +
        "  Doblar — Dobla apuesta, recibe 1 carta final\n" +
        "```",
    );
  } else {
    embed.setDescription(
      "¿Otra ronda? Usa **Volver a jugar**, **Misma apuesta** o elige una cantidad personalizada.",
    );
  }

  embed.addFields(
    {
      name: `🤖 Dealer — ${isPlaying ? `visible: **${dealerVal}**` : `total: **${dealerVal}**`}`,
      value:
        `${fmtHand(dealerHand, isPlaying)}\n` +
        `\`[${dealerBar}] ${dealerVal}/21\``,
      inline: false,
    },
    {
      name: `👤 ${username} — total: **${playerVal}**`,
      value: `${fmtHand(playerHand)}\n\`[${playerBar}] ${playerVal}/21\``,
      inline: false,
    },
    {
      name: "💰 Apuesta",
      value: `**${bet.toLocaleString()}** fichas${doubled ? " *(×2 doblada)*" : ""}`,
      inline: true,
    },
  );

  if (isPlaying) {
    const currentBalance = state.startBalance - state.originalBet;
    embed.addFields(
      {
        name: "🏦 Saldo disponible",
        value: `\`${currentBalance.toLocaleString()} fichas\``,
        inline: true,
      },
      {
        name: "⚡ Power-ups",
        value:
          [
            state.multiplierActive ? "🎰 ×2" : null,
            state.insuranceActive ? "🛡 Seguro" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "*Ninguno*",
        inline: true,
      },
    );
  } else {
    if (state.netLabel) {
      embed.addFields({
        name: "📊 Resultado",
        value: state.netLabel,
        inline: true,
      });
    }
    if (state.finalBalance !== undefined) {
      embed.addFields({
        name: "🏦 Saldo nuevo",
        value: `\`${state.finalBalance.toLocaleString()} fichas\``,
        inline: true,
      });
    }
  }

  embed
    .setFooter({
      text: isPlaying
        ? `ZeroTwo Casino · Solo ${username} puede interactuar`
        : `ZeroTwo Casino · ${username} · elige cómo seguir`,
      iconURL: botIcon,
    })
    .setTimestamp();

  return embed;
}

export function buildLobbyEmbed(
  username: string,
  avatarURL: string,
  balance: number,
  botIcon?: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xec4899)
    .setAuthor({
      name: "ZeroTwo Casino · Blackjack",
      iconURL: botIcon,
    })
    .setTitle("🎰 ZeroTwo Casino — Blackjack")
    .setDescription(
      "Elige una **apuesta predefinida**, usa **apuesta personalizada**, o escribe la cantidad con `/blackjack apuesta:`.\n\n" +
        "```\n" +
        "Reglas del casino:\n" +
        "  • Acércate a 21 sin pasarte\n" +
        "  • El dealer pide carta hasta ≥17\n" +
        "  • Blackjack (21 en 2 cartas) paga ×1.5\n" +
        "  • Doblar: apuesta ×2, recibes 1 carta final\n" +
        `  • Apuesta: ${BJ_MIN_BET} – ${BJ_MAX_BET.toLocaleString()} fichas\n` +
        "```",
    )
    .setThumbnail(avatarURL)
    .addFields(
      {
        name: "💰 Tu saldo",
        value: `\`${balance.toLocaleString()} fichas\``,
        inline: true,
      },
      {
        name: "🏪 Tienda",
        value: "`/shop` — power-ups",
        inline: true,
      },
      {
        name: "📅 Daily",
        value: "`/wallet` — fichas gratis",
        inline: true,
      },
    )
    .setFooter({
      text: `ZeroTwo Casino · Solo ${username} puede jugar`,
      iconURL: botIcon,
    })
    .setTimestamp();
}

// ── Component builders ────────────────────────────────────────────────────────
export function buildBetMenu(
  userId: string,
  balance: number,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const presets = BJ_PRESET_BETS.filter((v) => v <= balance && v <= BJ_MAX_BET);

  const options =
    presets.length > 0
      ? presets.map((v) => {
          const emoji =
            v <= 50
              ? "🥉"
              : v <= 100
                ? "🥈"
                : v <= 250
                  ? "🥇"
                  : v <= 500
                    ? "💎"
                    : v <= 1000
                      ? "👑"
                      : "🔥";
          return {
            label: `${v.toLocaleString()} fichas`,
            value: String(v),
            emoji,
            desc:
              v === balance
                ? "Todo tu saldo"
                : v >= 1000
                  ? "Apuesta alta"
                  : "Apuesta rápida",
          };
        })
      : [
          {
            label: "Sin fichas suficientes",
            value: "0",
            emoji: "💸",
            desc: `Mínimo ${BJ_MIN_BET} · /wallet daily`,
          },
        ];

  // Always offer custom if they can afford the minimum
  if (balance >= BJ_MIN_BET) {
    options.push({
      label: "Apuesta personalizada…",
      value: "custom",
      emoji: "✏️",
      desc: `Entre ${BJ_MIN_BET} y ${Math.min(balance, BJ_MAX_BET).toLocaleString()}`,
    });
  }

  // Discord select menus max 25 options
  const capped = options.slice(0, 25);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`bj_bet:${userId}`)
      .setPlaceholder("💰 Elige apuesta o personalizada…")
      .addOptions(
        capped.map((o) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(o.label)
            .setValue(o.value)
            .setEmoji(o.emoji)
            .setDescription(o.desc.slice(0, 100)),
        ),
      ),
  );
}

export function buildLobbyButtons(
  userId: string,
  balance: number,
  lastBet?: number,
): ActionRowBuilder<ButtonBuilder> {
  const canCustom = balance >= BJ_MIN_BET;
  const canRematch =
    typeof lastBet === "number" &&
    lastBet >= BJ_MIN_BET &&
    lastBet <= balance &&
    lastBet <= BJ_MAX_BET;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_custom:${userId}`)
      .setLabel("Apuesta personalizada")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canCustom),
    new ButtonBuilder()
      .setCustomId(
        canRematch
          ? `bj_rematch:${userId}:${lastBet}`
          : `bj_rematch:${userId}:0`,
      )
      .setLabel(
        canRematch
          ? `Misma apuesta (${lastBet!.toLocaleString()})`
          : "Misma apuesta",
      )
      .setEmoji("🔁")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canRematch),
  );
}

export function buildGameButtons(
  userId: string,
  canDouble: boolean,
  disabled = false,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_hit:${userId}`)
      .setLabel("Hit")
      .setEmoji("🃏")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`bj_stand:${userId}`)
      .setLabel("Stand")
      .setEmoji("🛑")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`bj_double:${userId}`)
      .setLabel("Doblar")
      .setEmoji("💰")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled || !canDouble),
  );
}

/** Buttons shown when a round ends */
export function buildEndButtons(
  userId: string,
  lastBet: number,
  balance: number,
): ActionRowBuilder<ButtonBuilder>[] {
  const canRematch =
    lastBet >= BJ_MIN_BET && lastBet <= balance && lastBet <= BJ_MAX_BET;
  const canPlay = balance >= BJ_MIN_BET;

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_again:${userId}`)
      .setLabel("Volver a jugar")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canPlay),
    new ButtonBuilder()
      .setCustomId(
        canRematch
          ? `bj_rematch:${userId}:${lastBet}`
          : `bj_rematch:${userId}:0`,
      )
      .setLabel(
        canRematch
          ? `Misma apuesta (${lastBet.toLocaleString()})`
          : "Sin saldo p/ misma apuesta",
      )
      .setEmoji("💰")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canRematch),
    new ButtonBuilder()
      .setCustomId(`bj_custom:${userId}`)
      .setLabel("Personalizada")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canPlay),
  );

  return [row1];
}

export function buildCustomBetModal(userId: string, balance: number): ModalBuilder {
  const max = Math.min(balance, BJ_MAX_BET);
  return new ModalBuilder()
    .setCustomId(`bj_custom_modal:${userId}`)
    .setTitle("Apuesta personalizada")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("bet_amount")
          .setLabel(`Cantidad (${BJ_MIN_BET} – ${max.toLocaleString()})`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(`Ej: 75, 1500, 2k · saldo ${balance.toLocaleString()}`)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(12),
      ),
    );
}

// ── Dealer logic ──────────────────────────────────────────────────────────────
export function dealerPlay(state: GameState): GameStatus {
  while (handValue(state.dealerHand) < 17) {
    state.dealerHand.push(state.deck.pop()!);
  }
  const p = handValue(state.playerHand);
  const d = handValue(state.dealerHand);
  if (d > 21) return "dealer_bust";
  if (p > d) return "win";
  if (p < d) return "lose";
  return "push";
}
