/**
 * /poker — mano de póker Texas Hold'em simplificada (diversión, sin apuestas reales).
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Message,
  MessageFlags,
  TextChannel,
} from "discord.js";
import { Command } from "../../types.js";
import { assetImage } from "../../lib/helpAssets.js";
import { BOT_VERSION } from "../../lib/version.js";
import {
  getBalance,
  deductBalance,
  addBalance,
  recordGame,
} from "../../lib/economy.js";
import { clampBet, BJ_MIN_BET, BJ_MAX_BET } from "../../games/blackjack.js";
import { ownerUserIds } from "../../lib/specialUser.js";
import { generateBroadcastWithGemini } from "../../../lib/gemini.js";

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

// Pending PvP challenges (messageId -> challenge)
type PendingChallenge = {
  challengerId: string;
  rivalId: string;
  guildId: string;
  channelId: string;
  bet: number;
  createdAt: number;
};

const pendingChallenges = new Map<string, PendingChallenge>();

// Helper: attach a suggestion button to a sent message and handle DM->Gemini->apply flow
async function attachSuggestionFlow(
  sentMessage: Message,
  resultEmbed: EmbedBuilder,
  interaction: ChatInputCommandInteraction,
  client: Client,
) {
  const suggestId = `poker-send-dev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const suggestRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(suggestId).setLabel("Enviar sugerencias al dev").setStyle(ButtonStyle.Primary),
  );
  try {
    await sentMessage.edit({ components: [suggestRow] });
  } catch {
    // ignore if not editable
  }

  const sugCollector = sentMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300_000 });
  sugCollector.on("collect", async (sbtn: any) => {
    if (sbtn.customId !== suggestId) return;
    const allowed = sbtn.user.id === interaction.user.id || ownerUserIds().includes(sbtn.user.id);
    if (!allowed) {
      await sbtn.reply({ content: "No autorizado para enviar sugerencias al dev.", flags: MessageFlags.Ephemeral });
      return;
    }
    await sbtn.deferReply({ flags: MessageFlags.Ephemeral });
    const owners = ownerUserIds();
    const devId = process.env.DEV_USER_ID?.trim() || owners[0];
    try {
      const devUser = await client.users.fetch(devId);
      const dmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`poker-gemini-gen-${Date.now()}`).setLabel("Generar sugerencias (Gemini)").setStyle(ButtonStyle.Primary),
      );
      const sent = await devUser.send({ content: `Nueva sugerencia desde <#${interaction.channelId}> (mensaje de <@${interaction.user.id}>).`, embeds: [resultEmbed], components: [dmRow] });
      await sbtn.editReply({ content: `Enviado al dev (${devUser.tag}).` });

      const dmCollector = (sent as Message).createMessageComponentCollector({ componentType: ComponentType.Button, time: 15 * 60_000 });
      dmCollector.on("collect", async (dBtn: any) => {
        if (!dBtn.customId.startsWith("poker-gemini-gen-")) return;
        if (dBtn.user.id !== devId) {
          await dBtn.reply({ content: "Solo el dev puede generar sugerencias aquí.", ephemeral: true });
          return;
        }
        await dBtn.deferReply({ ephemeral: true });
        const title = resultEmbed.data?.title ?? "";
        const description = resultEmbed.data?.description ?? "";
        const digest = `Título: ${title}\n\nDescripción:\n${description}\n\nPor favor: sugiere un título mejor y una descripción mejorada para este embed en español. Devuélvelo como JSON con keys: title, message.`;
        try {
          const draft = await generateBroadcastWithGemini({ digests: digest, guildCount: 1 });
          const applyId = `poker-apply-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const applyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(applyId).setLabel("Aplicar mejoras").setStyle(ButtonStyle.Success),
          );
          const suggestionEmbed = new EmbedBuilder()
            .setColor(0x8b5cf6)
            .setTitle("Sugerencia (Gemini)")
            .addFields(
              { name: "Título sugerido", value: draft.title || "-" },
              { name: "Descripción sugerida", value: draft.message || "-" },
            );
          await dBtn.editReply({ content: "Sugerencias generadas.", embeds: [suggestionEmbed], components: [applyRow], ephemeral: true });

          const applyCollector = (sent as Message).createMessageComponentCollector({ componentType: ComponentType.Button, time: 10 * 60_000 });
          applyCollector.on("collect", async (aBtn: any) => {
            if (aBtn.customId !== applyId) return;
            if (aBtn.user.id !== devId) {
              await aBtn.reply({ content: "Solo el dev puede aplicar las mejoras.", ephemeral: true });
              return;
            }
            try {
              const channel = await client.channels.fetch(interaction.channelId ?? "") as TextChannel;
              const originalMsg = await channel.messages.fetch(sentMessage.id);
              const newEmbed = EmbedBuilder.from(resultEmbed).setTitle(draft.title).setDescription(draft.message);
              await originalMsg.edit({ embeds: [newEmbed], components: [] });
              await aBtn.reply({ content: "Mejoras aplicadas al mensaje original.", ephemeral: true });
              dmCollector.stop("done");
              applyCollector.stop("done");
            } catch (err) {
              await aBtn.reply({ content: `Error al aplicar mejoras: ${String(err)}`, ephemeral: true });
            }
          });
        } catch (err) {
          await dBtn.editReply({ content: `Error generando sugerencias: ${String(err)}`, ephemeral: true });
        }
      });
    } catch (err) {
      await sbtn.editReply({ content: `No se pudo enviar al dev: ${String(err)}`, ephemeral: true });
    }
  });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("poker")
    .setDescription("🃏 Poker Texas Hold'em — mano, flop y showdown (casino/PvP)")
    .addIntegerOption((opt) =>
      opt
        .setName("apuesta")
        .setDescription(`Apuesta personalizada (${BJ_MIN_BET} – ${BJ_MAX_BET.toLocaleString()} fichas)`) 
        .setMinValue(BJ_MIN_BET)
        .setMaxValue(BJ_MAX_BET)
        .setRequired(false),
    )
    .addUserOption((o) =>
      o
        .setName("rival")
        .setDescription("Opcional: retar a otro usuario en la mesa. Si apuestas, el rival debe aceptar el reto.")
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

    const guildId = interaction.guild?.id ?? "";
    const userId = interaction.user.id;
    const botIcon = client.user?.displayAvatarURL();

    const customBet = interaction.options.getInteger("apuesta");

    // If there is a rival AND a bet -> create a PvP challenge (rival must accept)
    if (rivalUser && customBet != null) {
      const bet = customBet;
      const challengeEmbed = new EmbedBuilder()
        .setColor(CYAN)
        .setAuthor({ name: "Zero Two Casino · Poker — Reto", iconURL: botIcon })
        .setTitle("Reto de Poker")
        .setDescription(`<@${interaction.user.id}> te reta a una partida de Poker por **${bet.toLocaleString()}** fichas.`)
        .addFields(
          { name: "Retador", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Rival", value: `<@${rivalUser.id}>`, inline: true },
          { name: "Apuesta", value: ` ${bet.toLocaleString()} fichas?`, inline: true },
        )
        .setFooter({ text: `Tienes 60s para aceptar` })
        .setTimestamp();

      const acceptId = `poker-accept-${interaction.id}`;
      const declineId = `poker-decline-${interaction.id}`;
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(acceptId).setLabel("Aceptar").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(declineId).setLabel("Rechazar").setStyle(ButtonStyle.Danger),
      );

      const msg = await interaction.reply({ embeds: [challengeEmbed], components: [row], fetchReply: true });
      // Store pending challenge
      pendingChallenges.set((msg as any).id, {
        challengerId: interaction.user.id,
        rivalId: rivalUser.id,
        guildId,
        channelId: interaction.channelId ?? "",
        bet,
        createdAt: Date.now(),
      });

      // Collector for button clicks
      const collector = (msg as any).createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 });

      collector.on("collect", async (btnInt: any) => {
        // Only the rival can accept/reject
        if (btnInt.user.id !== rivalUser.id) {
          await btnInt.reply({ content: "Solo el rival puede aceptar o rechazar este reto.", ephemeral: true });
          return;
        }

        if (btnInt.customId === declineId) {
          // Declined
          pendingChallenges.delete((msg as any).id);
          await btnInt.update({ content: `❌ <@${rivalUser.id}> ha rechazado el reto.`, embeds: [], components: [] });
          collector.stop("declined");
          return;
        }

        if (btnInt.customId === acceptId) {
          // Attempt to accept: check balances
          const challengerId = interaction.user.id;
          const rivalId = rivalUser.id;
          const [balA, balB] = await Promise.all([getBalance(guildId, challengerId), getBalance(guildId, rivalId)]);
          if (balA < bet) {
            await btnInt.update({ content: `❌ <@${challengerId}> no tiene suficientes fichas (tiene ${balA.toLocaleString()}).`, embeds: [], components: [] });
            pendingChallenges.delete((msg as any).id);
            collector.stop("no-funds");
            return;
          }
          if (balB < bet) {
            await btnInt.update({ content: `❌ <@${rivalId}> no tiene suficientes fichas (tiene ${balB.toLocaleString()}).`, embeds: [], components: [] });
            pendingChallenges.delete((msg as any).id);
            collector.stop("no-funds");
            return;
          }

          // Deduct both bets atomically-ish: deduct challenger then rival; if rival deduct fails, refund challenger
          const d1 = await deductBalance(guildId, challengerId, bet);
          if (!d1.success) {
            await btnInt.update({ content: `❌ Error al deducir fichas a <@${challengerId}>.`, embeds: [], components: [] });
            pendingChallenges.delete((msg as any).id);
            collector.stop("deduct-failed");
            return;
          }
          const d2 = await deductBalance(guildId, rivalId, bet);
          if (!d2.success) {
            // refund challenger
            await addBalance(guildId, challengerId, bet);
            await btnInt.update({ content: `❌ <@${rivalId}> no pudo pagar la apuesta. Reto cancelado.`, embeds: [], components: [] });
            pendingChallenges.delete((msg as any).id);
            collector.stop("deduct-failed");
            return;
          }

          // Both paid, play the hand now
          // Build deck and deal
          const deck = shuffle(buildDeck());
          let idx = 0;
          const drawNow = (n: number) => {
            const cards = deck.slice(idx, idx + n);
            idx += n;
            return cards;
          };

          const aHole = drawNow(2);
          const bHole = drawNow(2);
          const boardNow = drawNow(5);

          const aSeven = [...aHole, ...boardNow];
          const bSeven = [...bHole, ...boardNow];
          const aBest = bestHand(aSeven);
          const bBest = bestHand(bSeven);

          // Determine winner
          let winnerId: string | null = null;
          let tie = false;
          if (aBest.rank.score > bBest.rank.score) winnerId = challengerId;
          else if (aBest.rank.score < bBest.rank.score) winnerId = rivalId;
          else tie = true;

          // Payouts
          if (tie) {
            // refund both
            await addBalance(guildId, challengerId, bet);
            await addBalance(guildId, rivalId, bet);
            await recordGame(guildId, challengerId, false, 0);
            await recordGame(guildId, rivalId, false, 0);
          } else if (winnerId) {
            const winnerGain = bet * 2;
            await addBalance(guildId, winnerId, winnerGain);
            // record games
            await recordGame(guildId, winnerId, true, bet);
            const loserId = winnerId === challengerId ? rivalId : challengerId;
            await recordGame(guildId, loserId, false, -bet);
          }

          // Build result embed
          const resultColor = tie ? GOLD : winnerId === challengerId ? GREEN : PINK;
          const resultEmbed = new EmbedBuilder()
            .setColor(resultColor)
            .setAuthor({ name: "Zero Two Casino · Poker — Resultado", iconURL: botIcon })
            .setTitle(tie ? "Empate" : "Resultado")
            .setDescription([
              tie ? `**Empate** — las apuestas han sido devueltas.` : `**Ganador:** <@${winnerId}>`,
              "",
              `**Mesa (board)**`,
              `\`${handStr(boardNow)}\``,
              "",
              `**<@${challengerId}> — Tus cartas**`,
              `\`${handStr(aHole)}\``,
              `Mejor mano: \`${handStr(aBest.best)}\` → **${aBest.rank.name}**`,
              "",
              `**<@${rivalId}> — Tus cartas**`,
              `\`${handStr(bHole)}\``,
              `Mejor mano: \`${handStr(bBest.best)}\` → **${bBest.rank.name}**`,
            ].join("\n"))
            .addFields(
              { name: "🏪 Tienda", value: "`/shop` — power-ups", inline: true },
              { name: "📅 Wallet", value: "`/wallet` — ver saldo", inline: true },
            )
            .setTimestamp();

          // Disable buttons and show result
          pendingChallenges.delete((msg as any).id);
          // Attach suggestion button row to result
          const suggestId = `poker-send-dev-${Date.now()}-${Math.floor(Math.random()*1000)}`;
          const suggestRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(suggestId).setLabel("Enviar sugerencias al dev").setStyle(ButtonStyle.Primary),
          );
          await btnInt.update({ embeds: [resultEmbed], components: [suggestRow] });

          // Collector for suggestion button
          const sugCollector = (msg as any).createMessageComponentCollector({ componentType: ComponentType.Button, time: 300_000 });
          sugCollector.on("collect", async (sbtn: any) => {
            if (sbtn.customId !== suggestId) return;
            // only original challenger or owners can trigger send
            const allowed = sbtn.user.id === interaction.user.id || ownerUserIds().includes(sbtn.user.id);
            if (!allowed) {
              await sbtn.reply({ content: "No autorizado para enviar sugerencias al dev.", ephemeral: true });
              return;
            }

            await sbtn.deferReply({ ephemeral: true });
            const owners = ownerUserIds();
            const devId = process.env.DEV_USER_ID?.trim() || owners[0];
            try {
              const devUser = await client.users.fetch(devId);
              const dmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`poker-gemini-gen-${Date.now()}`).setLabel("Generar sugerencias (Gemini)").setStyle(ButtonStyle.Primary),
              );
              const sent = await devUser.send({ content: `Nueva sugerencia desde <#${interaction.channelId}> (mensaje de <@${interaction.user.id}>).`, embeds: [resultEmbed], components: [dmRow] });
              await sbtn.editReply({ content: `Enviado al dev (${devUser.tag}).`, ephemeral: true });

              // Collector on DM for generation
              const dmCollector = (sent as Message).createMessageComponentCollector({ componentType: ComponentType.Button, time: 15 * 60_000 });
              dmCollector.on("collect", async (dBtn: any) => {
                if (!dBtn.customId.startsWith("poker-gemini-gen-")) return;
                // Only dev can click
                if (dBtn.user.id !== devId) {
                  await dBtn.reply({ content: "Solo el dev puede generar sugerencias aquí.", flags: MessageFlags.Ephemeral });
                  return;
                }
                await dBtn.deferReply({ flags: MessageFlags.Ephemeral });
                // Build digest from embed
                const title = resultEmbed.data?.title ?? "";
                const description = resultEmbed.data?.description ?? "";
                const digest = `Título: ${title}\n\nDescripción:\n${description}\n\nPor favor: sugiere un título mejor y una descripción mejorada para este embed en español. Devuélvelo con un título (máx 80 chars) y descripción (máx 4000 chars).`;
                try {
                  const draft = await generateBroadcastWithGemini({ digests: digest, guildCount: 1 });
                  // Reply with suggested title/description and button to apply
                  const applyId = `poker-apply-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                  const applyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setCustomId(applyId).setLabel("Aplicar mejoras").setStyle(ButtonStyle.Success),
                  );
                  const suggestionEmbed = new EmbedBuilder()
                    .setColor(0x8b5cf6)
                    .setTitle("Sugerencia (Gemini)")
                    .addFields(
                      { name: "Título sugerido", value: draft.title || "-" },
                      { name: "Descripción sugerida", value: draft.message || "-" },
                    );
                  await dBtn.editReply({ content: "Sugerencias generadas.", embeds: [suggestionEmbed], components: [applyRow] });

                  // Wait for dev to click apply
                  const applyCollector = (sent as Message).createMessageComponentCollector({ componentType: ComponentType.Button, time: 10 * 60_000 });
                  applyCollector.on("collect", async (aBtn: any) => {
                    if (aBtn.customId !== applyId) return;
                    if (aBtn.user.id !== devId) {
                      await aBtn.reply({ content: "Solo el dev puede aplicar las mejoras.", flags: MessageFlags.Ephemeral });
                      return;
                    }
                    // Apply: edit the original message in channel (btn.message where original was) — we have msg (challenge message)
                    try {
                      const channel = await client.channels.fetch(interaction.channelId ?? "") as TextChannel;
                      // Find the result message in the channel: the original msg id available as (msg as any).id
                      const originalMsg = await channel.messages.fetch((msg as any).id);
                      const newEmbed = EmbedBuilder.from(resultEmbed).setTitle(draft.title).setDescription(draft.message);
                      await originalMsg.edit({ embeds: [newEmbed], components: [] });
                      await aBtn.reply({ content: "Mejoras aplicadas al mensaje original.", flags: MessageFlags.Ephemeral });
                      // Close collectors
                      dmCollector.stop("done");
                      applyCollector.stop("done");
                    } catch (err) {
                      await aBtn.reply({ content: `Error al aplicar mejoras: ${String(err)}`, flags: MessageFlags.Ephemeral });
                    }
                  });
                } catch (err) {
                  await dBtn.editReply({ content: `Error generando sugerencias: ${String(err)}` });
                }
              });
            } catch (err) {
              await sbtn.editReply({ content: `No se pudo enviar al dev: ${String(err)}` });
            }
          });

          collector.stop("done");
          return;
        }
    });

    collector.on("end", async (_collected: any, reason: string) => {
        if (reason === "time") {
          try {
            if ((msg as any).editable) await (msg as any).edit({ content: `⌛ Reto caducado — nadie respondió.`, embeds: [], components: [] });
          } catch (e) {
            // ignore
          }
          pendingChallenges.delete((msg as any).id);
        }
    });

    return;
    }
    // Non-PvP: prepare deck and hands (only reached when not creating/awaiting a challenge)
    const deck = shuffle(buildDeck());
    let i = 0;
    const draw = (n: number) => {
      const cards = deck.slice(i, i + n);
      i += n;
      return cards;
    };

    const youHole = draw(2);
    const rivalHole = rivalUser ? draw(2) : null;
    let dealerHole: Card[] | null = null;
    if (customBet != null && !rivalUser) {
      dealerHole = draw(2);
    }
    const board = draw(5); // flop + turn + river

    const youSeven = [...youHole, ...board];
    const you = bestHand(youSeven);

    let rival: ReturnType<typeof bestHand> | null = null;
    if (rivalHole) {
      rival = bestHand([...rivalHole, ...board]);
    }
    let dealer: ReturnType<typeof bestHand> | null = null;
    if (dealerHole) {
      dealer = bestHand([...dealerHole, ...board]);
    }

    let resultLine = "";
    let color = you.rank.color;

    // Resolve outcome: if rival present compare vs rival, else if dealer present compare vs dealer
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
    } else if (dealer) {
      if (you.rank.score > dealer.rank.score) {
        resultLine = `🏆 **Ganas** contra la casa`;
        color = GREEN;
      } else if (you.rank.score < dealer.rank.score) {
        resultLine = `💀 **Pierdes** contra la casa`;
        color = PINK;
      } else {
        resultLine = `🤝 **Empate** con la casa`;
        color = GOLD;
      }
    }

    const img = assetImage("fun");

    // If there was a bet, handle economy payouts
    if (customBet != null) {
      const balance = await getBalance(guildId, userId);
      const check = clampBet(customBet, balance);
      if (!check.ok) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(PINK).setDescription(`❌ ${check.error}`)], ephemeral: true });
        return;
      }

      await interaction.deferReply();

      const bet = check.bet;
      const { success, balance: afterDeduct } = await deductBalance(guildId, userId, bet);
      if (!success) {
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor(PINK).setDescription(`❌ Saldo insuficiente. Necesitas **${bet.toLocaleString()}** pero tienes **${afterDeduct.toLocaleString()}**.`)] });
        return;
      }

      // Determine outcome against dealer
      if (dealer) {
        if (you.rank.score > dealer.rank.score) {
          // win: payout = bet * 2 (net +bet)
          const newBal = await addBalance(guildId, userId, bet * 2);
          await recordGame(guildId, userId, true, bet);
          color = GREEN;
          resultLine = `🏆 **Ganas** contra la casa — +${bet.toLocaleString()} fichas (ganancia neta)`;
          // adjust footer
          const embedWin = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: "Zero Two Casino · Texas Hold'em", iconURL: botIcon })
            .setTitle(`${you.rank.emoji} ${you.rank.name}`)
            .setDescription([
              resultLine,
              "",
              `**Mesa (board)**`,
              `\`${handStr(board)}\``,
              "",
              `**Tus cartas** · <@${interaction.user.id}>`,
              `\`${handStr(youHole)}\``,
              `Mejor mano: \`${handStr(you.best)}\` → **${you.rank.name}**`,
              "",
              `💬 *"${you.rank.comment}"*`,
            ].join("\n"))
            .addFields(
              { name: "🏦 Saldo nuevo", value: `\`${newBal.toLocaleString()} fichas\``, inline: true },
              { name: "🏪 Tienda", value: "`/shop` — power-ups", inline: true },
              { name: "📅 Daily", value: "`/wallet` — fichas gratis", inline: true },
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION} · Casino` })
            .setTimestamp();
          if (img.url) embedWin.setImage(img.url);
          await interaction.editReply({ embeds: [embedWin], files: img.file ? [img.file] : undefined });
          try {
            const sentMsg = (await interaction.fetchReply()) as Message;
            await attachSuggestionFlow(sentMsg, embedWin, interaction, client);
          } catch {
            /* ignore */
          }
          return;
        } else if (you.rank.score < dealer.rank.score) {
          // lose: nothing to add (already deducted)
          await recordGame(guildId, userId, false, -bet);
          color = PINK;
          resultLine = `💀 **Pierdes** contra la casa — pierdes **${bet.toLocaleString()}** fichas`;
          const embedLose = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: "Zero Two Casino · Texas Hold'em", iconURL: botIcon })
            .setTitle(`${you.rank.emoji} ${you.rank.name}`)
            .setDescription([
              resultLine,
              "",
              `**Mesa (board)**`,
              `\`${handStr(board)}\``,
              "",
              `**Tus cartas** · <@${interaction.user.id}>`,
              `\`${handStr(youHole)}\``,
              `Mejor mano: \`${handStr(you.best)}\` → **${you.rank.name}**`,
              "",
              `💬 *"${you.rank.comment}"*`,
            ].join("\n"))
            .addFields(
              { name: "🏦 Saldo actual", value: `\`${afterDeduct.toLocaleString()} fichas\``, inline: true },
              { name: "🏪 Tienda", value: "`/shop` — power-ups", inline: true },
              { name: "📅 Daily", value: "`/wallet` — fichas gratis", inline: true },
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION} · Casino` })
            .setTimestamp();
          if (img.url) embedLose.setImage(img.url);
          await interaction.editReply({ embeds: [embedLose], files: img.file ? [img.file] : undefined });
          try {
            const sentMsg = (await interaction.fetchReply()) as Message;
            await attachSuggestionFlow(sentMsg, embedLose, interaction, client);
          } catch {
            /* ignore */
          }
          return;
        } else {
          // tie: refund bet
          const newBal = await addBalance(guildId, userId, bet);
          await recordGame(guildId, userId, false, 0);
          color = GOLD;
          resultLine = `🤝 **Empate** — apuesta devuelta`;
          const embedTie = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: "Zero Two Casino · Texas Hold'em", iconURL: botIcon })
            .setTitle(`${you.rank.emoji} ${you.rank.name}`)
            .setDescription([
              resultLine,
              "",
              `**Mesa (board)**`,
              `\`${handStr(board)}\``,
              "",
              `**Tus cartas** · <@${interaction.user.id}>`,
              `\`${handStr(youHole)}\``,
              `Mejor mano: \`${handStr(you.best)}\` → **${you.rank.name}**`,
              "",
              `💬 *"${you.rank.comment}"*`,
            ].join("\n"))
            .addFields(
              { name: "🏦 Saldo actual", value: `\`${newBal.toLocaleString()} fichas\``, inline: true },
              { name: "🏪 Tienda", value: "`/shop` — power-ups", inline: true },
              { name: "📅 Daily", value: "`/wallet` — fichas gratis", inline: true },
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION} · Casino` })
            .setTimestamp();
          if (img.url) embedTie.setImage(img.url);
          await interaction.editReply({ embeds: [embedTie], files: img.file ? [img.file] : undefined });
          try {
            const sentMsg = (await interaction.fetchReply()) as Message;
            await attachSuggestionFlow(sentMsg, embedTie, interaction, client);
          } catch {
            /* ignore */
          }
          return;
        }
      }
    }

    // No bet flow (original behavior): build normal embed and include shop info in fields
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
      .addFields(
        { name: "🏪 Tienda", value: "`/shop` — power-ups", inline: true },
        { name: "📅 Daily", value: "`/wallet` — fichas gratis", inline: true },
      )
      .setFooter({
        text: `Zero Two ${BOT_VERSION} · Solo diversión · sin fichas reales`,
      })
      .setTimestamp();

    if (img.url) embed.setImage(img.url);

    const sent = await interaction.reply({
      embeds: [embed],
      files: img.file ? [img.file] : undefined,
      fetchReply: true,
    }) as Message;
    try {
      await attachSuggestionFlow(sent, embed, interaction, client);
    } catch {
      /* ignore */
    }
  },
};

export default command;
