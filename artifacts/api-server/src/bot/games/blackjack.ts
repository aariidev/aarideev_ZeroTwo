import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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
  netResult?: number;       // positive = won, negative = lost
  netLabel?: string;        // formatted result string
}

// ── Active games (in-memory) ──────────────────────────────────────────────────
export const activeGames = new Map<string, GameState>();

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
  const dealerBar = barProgress(isPlaying ? dealerVal : dealerVal);

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
  }

  embed.addFields(
    {
      name: `🤖 Dealer — ${isPlaying ? `visible: **${dealerVal}**` : `total: **${dealerVal}**`}`,
      value:
        `${fmtHand(dealerHand, isPlaying)}\n` +
        `\`[${dealerBar}] ${isPlaying ? dealerVal : dealerVal}/21\``,
      inline: false,
    },
    {
      name: `👤 ${username} — total: **${playerVal}**`,
      value: `${fmtHand(playerHand)}\n\`[${playerBar}] ${playerVal}/21\``,
      inline: false,
    },
    {
      name: "💰 Apuesta",
      value: `**${bet}** fichas${doubled ? " *(×2 doblada)*" : ""}`,
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
        : "ZeroTwo Casino · ¡Gracias por jugar!",
      iconURL: botIcon,
    })
    .setTimestamp();

  return embed;
}

// ── Component builders ────────────────────────────────────────────────────────
export function buildBetMenu(
  userId: string,
  balance: number,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const allOptions = [
    { label: "50 fichas",   value: "50",   emoji: "🥉", desc: "Apuesta mínima" },
    { label: "100 fichas",  value: "100",  emoji: "🥈", desc: "Apuesta estándar" },
    { label: "250 fichas",  value: "250",  emoji: "🥇", desc: "Para los valientes" },
    { label: "500 fichas",  value: "500",  emoji: "💎", desc: "Apuesta alta" },
    { label: "1000 fichas", value: "1000", emoji: "👑", desc: "All-in · máximo riesgo" },
  ];

  const affordable = allOptions.filter((o) => parseInt(o.value) <= balance);
  const options =
    affordable.length > 0
      ? affordable
      : [{ label: "Sin fichas suficientes", value: "0", emoji: "💸", desc: "Reclama tu daily con /wallet" }];

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`bj_bet:${userId}`)
      .setPlaceholder("💰 Elige tu apuesta para comenzar...")
      .addOptions(
        options.map((o) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(o.label)
            .setValue(o.value)
            .setEmoji(o.emoji)
            .setDescription(o.desc),
        ),
      ),
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
