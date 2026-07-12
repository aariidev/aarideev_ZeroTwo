import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { getBalance, deductBalance, addBalance, recordGame } from "../../lib/economy.js";

// ── Symbols ───────────────────────────────────────────────────────────────────
const SYMBOLS = [
  { emoji: "🍒", name: "Cereza",   weight: 35, payout3: 2  },
  { emoji: "🍋", name: "Limón",    weight: 25, payout3: 3  },
  { emoji: "🍊", name: "Naranja",  weight: 20, payout3: 5  },
  { emoji: "💎", name: "Diamante", weight: 12, payout3: 10 },
  { emoji: "🌟", name: "Estrella", weight: 6,  payout3: 20 },
  { emoji: "7️⃣", name: "Siete",   weight: 2,  payout3: 50 },
] as const;

type SlotSymbol = (typeof SYMBOLS)[number];

const TOTAL_WEIGHT = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

function spin(): [SlotSymbol, SlotSymbol, SlotSymbol] {
  const pick = (): SlotSymbol => {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const sym of SYMBOLS) {
      r -= sym.weight;
      if (r <= 0) return sym;
    }
    return SYMBOLS[SYMBOLS.length - 1];
  };
  return [pick(), pick(), pick()];
}

function evaluate(
  reels: [SlotSymbol, SlotSymbol, SlotSymbol],
  bet: number,
): { payout: number; label: string; won: boolean; color: number } {
  const [a, b, c] = reels;

  // 3 of a kind
  if (a.emoji === b.emoji && b.emoji === c.emoji) {
    const payout = bet * a.payout3;
    return {
      payout,
      label: `🎰 **¡JACKPOT! — 3 × ${a.name}** — Ganas **×${a.payout3}** tu apuesta`,
      won: true,
      color: 0xffd700,
    };
  }

  // 2 of a kind — devolver apuesta (empate)
  if (a.emoji === b.emoji || b.emoji === c.emoji || a.emoji === c.emoji) {
    return {
      payout: bet,
      label: `🤝 **Dos iguales** — apuesta devuelta`,
      won: false,
      color: 0xffa500,
    };
  }

  // Sin coincidencias
  return {
    payout: 0,
    label: `💀 **Sin coincidencias** — pierdes la apuesta`,
    won: false,
    color: 0xff2d6b,
  };
}

// ── Probability table shown to players ───────────────────────────────────────
function buildPayoutTable(): string {
  return SYMBOLS.map(
    (s) => `${s.emoji}${s.emoji}${s.emoji} — **×${s.payout3}** apuesta`,
  ).join("\n");
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slots")
    .setDescription("🎰 Juega a la máquina tragaperras del casino de ZeroTwo")
    .addIntegerOption((o) =>
      o
        .setName("apuesta")
        .setDescription("Fichas a apostar")
        .setRequired(true)
        .addChoices(
          { name: "🥉 50 fichas", value: 50 },
          { name: "🥈 100 fichas", value: 100 },
          { name: "🥇 250 fichas", value: 250 },
          { name: "💎 500 fichas", value: 500 },
          { name: "👑 1000 fichas", value: 1000 },
        ),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guildId = interaction.guild?.id ?? "";
    const userId = interaction.user.id;
    const bet = interaction.options.getInteger("apuesta", true);

    const { success, balance: balanceAfter } = await deductBalance(guildId, userId, bet);
    if (!success) {
      const current = await getBalance(guildId, userId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              `❌ Saldo insuficiente. Necesitas **${bet}** fichas pero tienes **${current}**.\n` +
                "Reclama tu daily con `/wallet` o visita `/shop`.",
            ),
        ],
        ephemeral: true,
      });
      return;
    }

    const reels = spin();
    const { payout, label, won, color } = evaluate(reels, bet);

    let netLabel: string;
    let finalBalance = balanceAfter;

    if (payout > 0) {
      finalBalance = await addBalance(guildId, userId, payout);
      const net = payout - bet;
      netLabel = net > 0 ? `+${net.toLocaleString()} fichas` : `±0 fichas`;
    } else {
      netLabel = `-${bet.toLocaleString()} fichas`;
    }

    if (payout !== bet) {
      await recordGame(guildId, userId, won && payout > bet, bet);
    }

    const reelDisplay = `╔══════════════════════╗\n║  ${reels[0].emoji}  ┃  ${reels[1].emoji}  ┃  ${reels[2].emoji}  ║\n╚══════════════════════╝`;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: "ZeroTwo Casino · Slots",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🎰 Máquina Tragaperras")
      .setDescription(`\`\`\`\n${reelDisplay}\n\`\`\`\n${label}`)
      .addFields(
        { name: "💰 Apuesta", value: `\`${bet.toLocaleString()}\` fichas`, inline: true },
        { name: "📊 Resultado", value: `\`${netLabel}\``, inline: true },
        { name: "🏦 Saldo nuevo", value: `\`${finalBalance.toLocaleString()}\` fichas`, inline: true },
      )
      .setFooter({
        text: "ZeroTwo Casino · ¡Prueba suerte con /blackjack para más estrategia!",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
