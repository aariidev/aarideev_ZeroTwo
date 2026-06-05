import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type Card = { suit: Suit; rank: Rank };

export type GameStatus = "playing" | "win" | "lose" | "push" | "blackjack" | "bust" | "dealer_bust";

export interface GameState {
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  bet: number;
  doubled: boolean;
  username: string;
  avatarURL: string;
}

// ── Active games (in-memory) ──────────────────────────────────────────────────
export const activeGames = new Map<string, GameState>();

// ── Deck helpers ──────────────────────────────────────────────────────────────
export function createDeck(): Card[] {
  const suits: Suit[] = ["♠", "♥", "♦", "♣"];
  const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
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

function fmt(c: Card): string {
  const red = c.suit === "♥" || c.suit === "♦";
  return red ? `\`${c.rank}${c.suit}\`` : `\`${c.rank}${c.suit}\``;
}

function fmtHand(hand: Card[], hideSecond = false): string {
  return hand.map((c, i) => (hideSecond && i === 1 ? "`?? 🂠`" : fmt(c))).join("  ");
}

// ── Embed builder ─────────────────────────────────────────────────────────────
const STATUS_META: Record<GameStatus, { color: number; title: string; result: string }> = {
  playing:     { color: 0xec4899, title: "🃏 Blackjack · En juego",       result: "" },
  win:         { color: 0x00ff88, title: "🏆 ¡Ganaste!",                  result: "+" },
  lose:        { color: 0xff2d6b, title: "💀 Perdiste",                    result: "-" },
  push:        { color: 0xffa500, title: "🤝 Empate — Apuesta devuelta",   result: "±" },
  blackjack:   { color: 0xffd700, title: "🌟 ¡BLACKJACK! ×1.5",           result: "+" },
  bust:        { color: 0xff2d6b, title: "💥 Bust — Te pasaste de 21",     result: "-" },
  dealer_bust: { color: 0x00ff88, title: "💥 Dealer Bust — ¡Ganas tú!",   result: "+" },
};

export function buildEmbed(
  state: GameState,
  status: GameStatus,
  botIcon?: string
): EmbedBuilder {
  const { playerHand, dealerHand, bet, doubled, username, avatarURL } = state;
  const meta = STATUS_META[status];
  const isPlaying = status === "playing";

  const playerVal = handValue(playerHand);
  const dealerVal = isPlaying ? handValue([dealerHand[0]!]) : handValue(dealerHand);

  const payout =
    status === "blackjack" ? Math.floor(bet * 1.5)
    : status === "push"    ? 0
    : bet;

  const resultLine =
    status === "push"      ? "Recuperas tu apuesta."
    : status === "playing" ? ""
    : `${meta.result}**${payout}** fichas${doubled ? " (apuesta doblada)" : ""}`;

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setAuthor({ name: "ZeroTwo Casino · Blackjack", iconURL: botIcon })
    .setTitle(meta.title)
    .setThumbnail(avatarURL || null)
    .addFields(
      {
        name: `🤖 Dealer ${isPlaying ? `· visible: **${dealerVal}**` : `· total: **${dealerVal}**`}`,
        value: fmtHand(dealerHand, isPlaying),
        inline: false,
      },
      {
        name: `👤 ${username} · total: **${playerVal}**`,
        value: fmtHand(playerHand),
        inline: false,
      },
      {
        name: "💰 Apuesta",
        value: `**${bet}** fichas${doubled ? " *(×2 doblada)*" : ""}`,
        inline: true,
      }
    );

  if (!isPlaying && resultLine) {
    embed.addFields({ name: "📊 Resultado", value: resultLine, inline: true });
  }

  if (isPlaying) {
    embed.setDescription(
      "```\n" +
      "🃏 Hit    — Pide una carta\n" +
      "🛑 Stand  — Plantarse con lo que tienes\n" +
      "💰 Double — Dobla la apuesta y recibe 1 carta\n" +
      "```"
    );
  }

  embed.setFooter({
    text: isPlaying
      ? "ZeroTwo Casino · Tu turno, piloto  •  Solo tú puedes interactuar"
      : "ZeroTwo Casino · ¡Juega con responsabilidad!",
    iconURL: botIcon,
  });

  return embed;
}

// ── Component builders ────────────────────────────────────────────────────────
export function buildBetMenu(userId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`bj_bet:${userId}`)
      .setPlaceholder("💰 Elige tu apuesta para comenzar...")
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("50 fichas").setValue("50").setEmoji("🥉").setDescription("Apuesta baja — para empezar"),
        new StringSelectMenuOptionBuilder().setLabel("100 fichas").setValue("100").setEmoji("🥈").setDescription("Apuesta estándar"),
        new StringSelectMenuOptionBuilder().setLabel("250 fichas").setValue("250").setEmoji("🥇").setDescription("Para los valientes"),
        new StringSelectMenuOptionBuilder().setLabel("500 fichas").setValue("500").setEmoji("💎").setDescription("Apuesta alta"),
        new StringSelectMenuOptionBuilder().setLabel("1000 fichas").setValue("1000").setEmoji("👑").setDescription("All-in — máximo riesgo"),
      )
  );
}

export function buildGameButtons(userId: string, canDouble: boolean, disabled = false): ActionRowBuilder<ButtonBuilder> {
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
  if (p > d)  return "win";
  if (p < d)  return "lose";
  return "push";
}
