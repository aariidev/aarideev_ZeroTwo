/**
 * /poker — mano de póker Texas Hold'em simplificada (diversión, sin apuestas reales).
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { assetImage } from "../../lib/helpAssets.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;
const GOLD = 0xffd700;
const GREEN = 0x22c55e;
const CYAN = 0x22d3ee;

const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;

type Suit = (typeof SUITS)[number];
type Rank = (typeof RANKS)[number];
type Card = { rank: Rank; suit: Suit; value: number };

const RANK_VALUE: Record<Rank, number> = {
  A: 14,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
};

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, value: RANK_VALUE[rank] });
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function cardStr(c: Card): string {
  const red = c.suit === "♥" || c.suit === "♦";
  return `${red ? "" : ""}${c.rank}${c.suit}`;
}

function handStr(cards: Card[]): string {
  return cards.map(cardStr).join("  ");
}

type HandRank = {
  name: string;
  score: number;
  emoji: string;
  color: number;
  comment: string;
};

function evaluate5(cards: Card[]): HandRank {
  const values = cards.map((c) => c.value).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  const byCount = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const isFlush = suits.every((s) => s === suits[0]);
  // straight (A-high and wheel A-2-3-4-5)
  const unique = [...new Set(values)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0]! - unique[4]! === 4) {
      isStraight = true;
      straightHigh = unique[0]!;
    } else if (
      unique.includes(14) &&
      unique.includes(5) &&
      unique.includes(4) &&
      unique.includes(3) &&
      unique.includes(2)
    ) {
      isStraight = true;
      straightHigh = 5; // wheel
    }
  }

  const topCount = byCount[0]![1];
  const secondCount = byCount[1]?.[1] ?? 0;

  if (isStraight && isFlush && straightHigh === 14) {
    return {
      name: "Escalera real",
      score: 900,
      emoji: "👑",
      color: GOLD,
      comment: "¿En serio? Eso casi nunca pasa, Darling… qué suerte tan sucia.",
    };
  }
  if (isStraight && isFlush) {
    return {
      name: "Escalera de color",
      score: 800 + straightHigh,
      emoji: "💎",
      color: GOLD,
      comment: "Una mano de campeón. El Franxx tiembla contigo.",
    };
  }
  if (topCount === 4) {
    return {
      name: "Póker (cuatro iguales)",
      score: 700 + byCount[0]![0],
      emoji: "🔥",
      color: PINK,
      comment: "Cuatro del mismo rango. Alguien va a llorar en la mesa.",
    };
  }
  if (topCount === 3 && secondCount === 2) {
    return {
      name: "Full house",
      score: 600 + byCount[0]![0] * 15 + (byCount[1]?.[0] ?? 0),
      emoji: "🏠",
      color: GREEN,
      comment: "Full house. Lleno y peligroso, como yo.",
    };
  }
  if (isFlush) {
    return {
      name: "Color",
      score: 500 + values[0]!,
      emoji: "🌈",
      color: 0x9d4edd,
      comment: "Todo el mismo palo. Elegante… casi tanto como mis cuernos.",
    };
  }
  if (isStraight) {
    return {
      name: "Escalera",
      score: 400 + straightHigh,
      emoji: "📈",
      color: CYAN,
      comment: "Escalera limpia. Vas en subida, parásito.",
    };
  }
  if (topCount === 3) {
    return {
      name: "Trío",
      score: 300 + byCount[0]![0],
      emoji: "3️⃣",
      color: PINK,
      comment: "Tres iguales. No es la gloria, pero tampoco es basura.",
    };
  }
  if (topCount === 2 && secondCount === 2) {
    return {
      name: "Doble pareja",
      score: 200 + byCount[0]![0] * 15 + (byCount[1]?.[0] ?? 0),
      emoji: "👥",
      color: 0xf59e0b,
      comment: "Dos pares. Decente… si no te come el river.",
    };
  }
  if (topCount === 2) {
    return {
      name: "Pareja",
      score: 100 + byCount[0]![0],
      emoji: "👯",
      color: 0x94a3b8,
      comment: "Una pareja. Al menos no vas de high card puro.",
    };
  }
  return {
    name: "Carta alta",
    score: values[0]!,
    emoji: "🃏",
    color: 0x64748b,
    comment: "Carta alta… a veces la mesa es cruel. Como la vida.",
  };
}

/** Best 5-card hand from 7 cards (hole + board). */
function bestHand(seven: Card[]): { best: Card[]; rank: HandRank } {
  let bestCards = seven.slice(0, 5);
  let bestRank = evaluate5(bestCards);

  const n = seven.length;
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      for (let c = b + 1; c < n; c++) {
        for (let d = c + 1; d < n; d++) {
          for (let e = d + 1; e < n; e++) {
            const five = [seven[a]!, seven[b]!, seven[c]!, seven[d]!, seven[e]!];
            const rank = evaluate5(five);
            if (rank.score > bestRank.score) {
              bestRank = rank;
              bestCards = five;
            }
          }
        }
      }
    }
  }
  return { best: bestCards, rank: bestRank };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("poker")
    .setDescription("🃏 Poker Texas Hold'em — mano, flop y showdown")
    .addUserOption((o) =>
      o
        .setName("rival")
        .setDescription("Opcional: confrontar a otro usuario en la mesa")
        .setRequired(false),
    ),

  cooldown: 6,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const rivalUser = interaction.options.getUser("rival");
    if (rivalUser?.bot) {
      await interaction.reply({
        content: "❌ No puedes retar a un bot… ya soy suficiente rival, Darling.",
        ephemeral: true,
      });
      return;
    }
    if (rivalUser && rivalUser.id === interaction.user.id) {
      await interaction.reply({
        content: "❌ No te puedes echar una partida a ti mismo.",
        ephemeral: true,
      });
      return;
    }

    const deck = shuffle(buildDeck());
    let i = 0;
    const draw = (n: number) => {
      const cards = deck.slice(i, i + n);
      i += n;
      return cards;
    };

    const youHole = draw(2);
    const rivalHole = rivalUser ? draw(2) : null;
    const board = draw(5); // flop + turn + river

    const youSeven = [...youHole, ...board];
    const you = bestHand(youSeven);

    let rival: ReturnType<typeof bestHand> | null = null;
    if (rivalHole) {
      rival = bestHand([...rivalHole, ...board]);
    }

    let resultLine = "";
    let color = you.rank.color;
    if (rival && rivalUser) {
      if (you.rank.score > rival.rank.score) {
        resultLine = `🏆 **Ganas** frente a ${rivalUser}`;
        color = GREEN;
      } else if (you.rank.score < rival.rank.score) {
        resultLine = `💀 **Pierdes** contra ${rivalUser}`;
        color = PINK;
      } else {
        resultLine = `🤝 **Empate** con ${rivalUser}`;
        color = GOLD;
      }
    }

    const img = assetImage("fun");
    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: "Zero Two Casino · Texas Hold'em",
        iconURL: client.user?.displayAvatarURL() ?? undefined,
      })
      .setTitle(`${you.rank.emoji} ${you.rank.name}`)
      .setDescription(
        [
          resultLine || `Mesa abierta para **${interaction.user.username}**`,
          "",
          `**Mesa (board)**`,
          `\`${handStr(board)}\``,
          "",
          `**Tus cartas** · <@${interaction.user.id}>`,
          `\`${handStr(youHole)}\``,
          `Mejor mano: \`${handStr(you.best)}\` → **${you.rank.name}**`,
          rivalUser && rivalHole && rival
            ? [
                "",
                `**Rival** · ${rivalUser}`,
                `\`${handStr(rivalHole)}\``,
                `Mejor mano: \`${handStr(rival.best)}\` → **${rival.rank.name}**`,
              ].join("\n")
            : "",
          "",
          `💬 *"${you.rank.comment}"*`,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .setFooter({
        text: `Zero Two ${BOT_VERSION} · Solo diversión · sin fichas reales`,
      })
      .setTimestamp();

    if (img.url) embed.setImage(img.url);

    await interaction.reply({
      embeds: [embed],
      files: img.file ? [img.file] : undefined,
    });
  },
};

export default command;
