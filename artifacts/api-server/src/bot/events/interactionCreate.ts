import { Interaction, EmbedBuilder, Collection } from "discord.js";
import { logger } from "../../lib/logger.js";
import { BotClient } from "../types.js";
import { db, activityTable, commandStatsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { devState } from "../../lib/devState.js";
import {
  activeGames,
  lastBets,
  buildEmbed,
  buildGameButtons,
  buildEndButtons,
  buildBetMenu,
  buildLobbyEmbed,
  buildLobbyButtons,
  buildCustomBetModal,
  createDeck,
  handValue,
  dealerPlay,
  parseCustomBet,
  clampBet,
  BJ_MIN_BET,
  GameState,
  GameStatus,
} from "../games/blackjack.js";
import {
  activeSessions,
  buildPanelEmbed,
  buildPreviewEmbed,
  buildSectionMenu,
  buildActionButtons,
  buildContentModal,
  buildColorModal,
  buildAuthorModal,
  buildFooterModal,
  buildFieldModal,
  buildImageModal,
} from "../builders/cfgembed.js";
import {
  deductBalance,
  addBalance,
  recordGame,
  claimDaily,
  hasItem,
  useItem,
  addItem,
  calculateBlackjackPayout,
  getBalance,
} from "../lib/economy.js";
import { SHOP_ITEMS, ITEM_REWARDS } from "../lib/shop.js";

function buildNetLabel(status: string, state: GameState): string {
  const { bet, multiplierActive, insuranceActive } = state;
  if (status === "blackjack") {
    const net = multiplierActive ? Math.floor(bet * 3) : Math.floor(bet * 1.5);
    return `+**${net}** fichas${multiplierActive ? " (×2 Multiplicador)" : ""}`;
  }
  if (status === "push") return `±**0** fichas (apuesta devuelta)`;
  if (status === "win" || status === "dealer_bust") {
    const net = multiplierActive ? bet * 2 : bet;
    return `+**${net}** fichas${multiplierActive ? " (×2 Multiplicador)" : ""}`;
  }
  return insuranceActive
    ? `-**${Math.floor(bet * 0.5)}** fichas (🛡 Seguro recuperó 50%)`
    : `-**${bet}** fichas`;
}

type BjMsgInteraction =
  | import("discord.js").ButtonInteraction
  | import("discord.js").StringSelectMenuInteraction
  | import("discord.js").ModalSubmitInteraction;

async function finishBlackjackRound(
  interaction: BjMsgInteraction,
  ownerId: string,
  state: GameState,
  status: GameStatus,
  botIcon?: string,
) {
  activeGames.delete(ownerId);
  lastBets.set(ownerId, state.originalBet);

  const payout = calculateBlackjackPayout(
    status,
    state.bet,
    state.multiplierActive,
    state.insuranceActive,
  );
  if (payout > 0) await addBalance(state.guildId, state.userId, payout);
  const newBalance = await getBalance(state.guildId, state.userId);
  const won = ["win", "dealer_bust", "blackjack"].includes(status);
  await recordGame(state.guildId, state.userId, won, state.originalBet);
  state.netLabel = buildNetLabel(status, state);
  state.finalBalance = newBalance;

  const embed = buildEmbed(state, status, botIcon);
  const rows = buildEndButtons(ownerId, state.originalBet, newBalance);

  if (interaction.isModalSubmit()) {
    // Modal can't update the game message — reply with a new board
    await interaction.reply({ embeds: [embed], components: rows });
  } else {
    await interaction.update({ embeds: [embed], components: rows });
  }
}

async function startBlackjackRound(
  interaction: BjMsgInteraction,
  ownerId: string,
  bet: number,
  botIcon?: string,
): Promise<void> {
  const guildId = interaction.guild?.id ?? "";

  if (activeGames.has(ownerId)) {
    const msg = {
      embeds: [
        new EmbedBuilder()
          .setColor(0xff2d6b)
          .setDescription("❌ Ya tienes una partida activa."),
      ],
      ephemeral: true,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(msg);
    } else if (interaction.isModalSubmit()) {
      await interaction.reply(msg);
    } else {
      await interaction.reply(msg);
    }
    return;
  }

  const balance = await getBalance(guildId, ownerId);
  const check = clampBet(bet, balance);
  if (!check.ok) {
    const msg = {
      embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription(`❌ ${check.error}`)],
      ephemeral: true,
    };
    if (interaction.isModalSubmit()) await interaction.reply(msg);
    else await interaction.reply(msg);
    return;
  }
  const finalBet = check.bet;

  const { success, balance: balanceAfterBet } = await deductBalance(
    guildId,
    ownerId,
    finalBet,
  );
  if (!success) {
    const msg = {
      embeds: [
        new EmbedBuilder()
          .setColor(0xff2d6b)
          .setDescription(
            `❌ Saldo insuficiente. Necesitas **${finalBet.toLocaleString()}** fichas pero tienes **${balanceAfterBet.toLocaleString()}**.\nReclama tu daily con \`/wallet\`.`,
          ),
      ],
      ephemeral: true,
    };
    if (interaction.isModalSubmit()) await interaction.reply(msg);
    else await interaction.reply(msg);
    return;
  }

  const multiplierActive = await hasItem(guildId, ownerId, "multiplier");
  const insuranceActive = await hasItem(guildId, ownerId, "insurance");
  if (multiplierActive) await useItem(guildId, ownerId, "multiplier");
  if (insuranceActive) await useItem(guildId, ownerId, "insurance");

  const deck = createDeck();
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];

  const state: GameState = {
    playerHand,
    dealerHand,
    deck,
    bet: finalBet,
    originalBet: finalBet,
    doubled: false,
    username: interaction.user.username,
    avatarURL: interaction.user.displayAvatarURL(),
    guildId,
    userId: ownerId,
    startBalance: balanceAfterBet + finalBet,
    multiplierActive,
    insuranceActive,
    startedAt: new Date(),
  };
  activeGames.set(ownerId, state);
  lastBets.set(ownerId, finalBet);

  if (handValue(playerHand) === 21) {
    await finishBlackjackRound(interaction, ownerId, state, "blackjack", botIcon);
    return;
  }

  const embed = buildEmbed(state, "playing", botIcon);
  const row = buildGameButtons(ownerId, true);

  if (interaction.isModalSubmit()) {
    await interaction.reply({ embeds: [embed], components: [row] });
  } else {
    await interaction.update({ embeds: [embed], components: [row] });
  }
}

// ── Blackjack component handler ───────────────────────────────────────────────
async function handleBlackjack(interaction: Interaction): Promise<boolean> {
  const isSelect = interaction.isStringSelectMenu();
  const isBtn = interaction.isButton();
  const isModal = interaction.isModalSubmit();
  if (!isSelect && !isBtn && !isModal) return false;

  const [action, ownerId, extra] = interaction.customId.split(":");
  if (!action?.startsWith("bj_") || !ownerId) return false;

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff2d6b)
          .setDescription("❌ Esta partida no es tuya."),
      ],
      ephemeral: true,
    });
    return true;
  }

  const botIcon = interaction.client.user?.displayAvatarURL();
  const guildId = interaction.guild?.id ?? "";

  // ── Custom bet modal submit ───────────────────────────────────────────────
  if (action === "bj_custom_modal" && isModal) {
    const raw = interaction.fields.getTextInputValue("bet_amount");
    const parsed = parseCustomBet(raw);
    if (parsed == null) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              `❌ Cantidad inválida. Usa un número (ej. \`75\`, \`1500\`, \`2k\`). Mínimo **${BJ_MIN_BET}**.`,
            ),
        ],
        ephemeral: true,
      });
      return true;
    }
    await startBlackjackRound(interaction, ownerId, parsed, botIcon);
    return true;
  }

  // ── Open custom bet modal ─────────────────────────────────────────────────
  if (action === "bj_custom" && isBtn) {
    const balance = await getBalance(guildId, ownerId);
    if (balance < BJ_MIN_BET) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              `❌ Necesitas al menos **${BJ_MIN_BET}** fichas. Usa \`/wallet\`.`,
            ),
        ],
        ephemeral: true,
      });
      return true;
    }
    await interaction.showModal(buildCustomBetModal(ownerId, balance));
    return true;
  }

  // ── Volver a jugar → lobby con menú de apuestas ───────────────────────────
  if (action === "bj_again" && isBtn) {
    if (activeGames.has(ownerId)) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription("❌ Ya tienes una partida activa."),
        ],
        ephemeral: true,
      });
      return true;
    }
    const balance = await getBalance(guildId, ownerId);
    const last = lastBets.get(ownerId);
    const embed = buildLobbyEmbed(
      interaction.user.username,
      interaction.user.displayAvatarURL(),
      balance,
      botIcon,
    );
    await interaction.update({
      embeds: [embed],
      components: [
        buildBetMenu(ownerId, balance),
        buildLobbyButtons(ownerId, balance, last),
      ],
    });
    return true;
  }

  // ── Misma apuesta (rematch) ───────────────────────────────────────────────
  if (action === "bj_rematch" && isBtn) {
    const bet = parseInt(extra ?? "0", 10) || lastBets.get(ownerId) || 0;
    if (bet <= 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              "❌ No hay apuesta anterior. Elige una del menú o usa **Personalizada**.",
            ),
        ],
        ephemeral: true,
      });
      return true;
    }
    await startBlackjackRound(interaction, ownerId, bet, botIcon);
    return true;
  }

  // ── Bet selection (presets + custom option) ───────────────────────────────
  if (action === "bj_bet" && isSelect) {
    const value = interaction.values[0]!;
    if (value === "custom") {
      const balance = await getBalance(guildId, ownerId);
      await interaction.showModal(buildCustomBetModal(ownerId, balance));
      return true;
    }
    const bet = parseInt(value, 10);
    if (!Number.isFinite(bet) || bet <= 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              "❌ No tienes fichas suficientes. Reclama tu daily con `/wallet`.",
            ),
        ],
        ephemeral: true,
      });
      return true;
    }
    await startBlackjackRound(interaction, ownerId, bet, botIcon);
    return true;
  }

  // ── In-game buttons ───────────────────────────────────────────────────────
  if (!isBtn) return false;

  const state = activeGames.get(ownerId);
  if (!state) {
    // End-screen buttons already handled above; leftover hit/stand
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff2d6b)
          .setDescription(
            "❌ No hay partida activa. Usa `/blackjack` o **Volver a jugar**.",
          ),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (action === "bj_hit") {
    state.playerHand.push(state.deck.pop()!);
    const val = handValue(state.playerHand);

    if (val > 21) {
      await finishBlackjackRound(interaction, ownerId, state, "bust", botIcon);
      return true;
    }

    if (val === 21) {
      const status = dealerPlay(state);
      await finishBlackjackRound(interaction, ownerId, state, status, botIcon);
      return true;
    }

    const embed = buildEmbed(state, "playing", botIcon);
    const row = buildGameButtons(ownerId, false);
    await interaction.update({ embeds: [embed], components: [row] });
    return true;
  }

  if (action === "bj_stand") {
    const status = dealerPlay(state);
    await finishBlackjackRound(interaction, ownerId, state, status, botIcon);
    return true;
  }

  if (action === "bj_double") {
    const extraBet = state.bet;
    const { success: canDouble, balance: balAfterDouble } = await deductBalance(
      state.guildId,
      state.userId,
      extraBet,
    );
    if (!canDouble) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              `❌ Saldo insuficiente para doblar. Necesitas **${extraBet.toLocaleString()}** fichas más (tienes **${balAfterDouble.toLocaleString()}**).`,
            ),
        ],
        ephemeral: true,
      });
      return true;
    }

    state.bet *= 2;
    state.doubled = true;
    state.playerHand.push(state.deck.pop()!);
    const val = handValue(state.playerHand);

    const status: GameStatus =
      val > 21 ? "bust" : dealerPlay(state);

    await finishBlackjackRound(interaction, ownerId, state, status, botIcon);
    return true;
  }

  return false;
}

// ── Shop component handler ────────────────────────────────────────────────────
async function handleShop(interaction: Interaction): Promise<boolean> {
  if (!interaction.isButton()) return false;
  const parts = interaction.customId.split(":");
  const [action, userId, itemId] = parts;
  if (action !== "shop_buy" || !userId || !itemId) return false;

  if (interaction.user.id !== userId) {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ Esta tienda no es tuya.")], ephemeral: true });
    return true;
  }

  const item = SHOP_ITEMS[itemId];
  if (!item) return false;

  const guildId = interaction.guild?.id ?? "";
  const { success, balance } = await deductBalance(guildId, userId, item.price);

  if (!success) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription(`❌ Fondos insuficientes.\nNecesitas **${item.price}** fichas pero tienes **${balance}**.`)],
      ephemeral: true,
    });
    return true;
  }

  await addItem(guildId, userId, itemId);
  const botIcon = interaction.client.user?.displayAvatarURL();

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00ff9f)
        .setAuthor({ name: "ZeroTwo Casino · Tienda", iconURL: botIcon })
        .setTitle(`${item.emoji} ¡Compra exitosa!`)
        .setDescription(`Adquiriste **${item.name}**.`)
        .addFields(
          { name: "💰 Pagado", value: `\`${item.price.toLocaleString()}\` fichas`, inline: true },
          { name: "🏦 Saldo restante", value: `\`${balance.toLocaleString()}\` fichas`, inline: true },
          { name: "⚡ Efecto", value: item.effect, inline: false },
        )
        .setFooter({ text: item.type === "passive" ? "Se activa automáticamente en tu próximo Blackjack" : "Úsalo desde /inventory", iconURL: botIcon })
        .setTimestamp(),
    ],
    ephemeral: true,
  });
  return true;
}

// ── Inventory & Wallet component handler ─────────────────────────────────────
async function handleInventory(interaction: Interaction): Promise<boolean> {
  if (!interaction.isButton()) return false;
  const parts = interaction.customId.split(":");
  const [action, userId, itemId] = parts;

  if (!action || !userId) return false;
  const guildId = interaction.guild?.id ?? "";
  const botIcon = interaction.client.user?.displayAvatarURL();

  // Wallet daily claim
  if (action === "wallet_daily") {
    if (interaction.user.id !== userId) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ Esta wallet no es tuya.")], ephemeral: true });
      return true;
    }
    const result = await claimDaily(guildId, userId);
    if (!result.success) {
      const h = Math.floor(result.msLeft / 3600000);
      const m = Math.floor((result.msLeft % 3600000) / 60000);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff9900).setDescription(`⏳ Ya reclamaste hoy. Vuelve en **${h}h ${m}m**.`)], ephemeral: true });
      return true;
    }
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00ff9f)
          .setAuthor({ name: "ZeroTwo Casino · Daily", iconURL: botIcon })
          .setTitle("🎁 ¡Recompensa Diaria Reclamada!")
          .addFields(
            { name: "💰 Fichas obtenidas", value: `\`+${result.coins}\``, inline: true },
            { name: "🔥 Racha", value: `\`${result.streak} días\``, inline: true },
          )
          .setFooter({ text: "Vuelve mañana para tu siguiente recompensa", iconURL: botIcon })
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return true;
  }

  // Inventory instant item use
  if (action !== "inv_use" || !itemId) return false;
  if (interaction.user.id !== userId) {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ Este inventario no es tuyo.")], ephemeral: true });
    return true;
  }

  const item = SHOP_ITEMS[itemId];
  if (!item || item.type !== "instant") return false;

  const [min, max] = ITEM_REWARDS[itemId] ?? [0, 0];
  const used = await useItem(guildId, userId, itemId);
  if (!used) {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ No tienes ese ítem en tu inventario.")], ephemeral: true });
    return true;
  }

  const reward = Math.floor(Math.random() * (max - min + 1)) + min;
  const newBalance = await addBalance(guildId, userId, reward);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xffd700)
        .setAuthor({ name: "ZeroTwo Casino · Inventario", iconURL: botIcon })
        .setTitle(`${item.emoji} ¡${item.name} Abierto!`)
        .setDescription(`Obtuviste **${reward} fichas** al azar.`)
        .addFields(
          { name: "🎲 Ganancia", value: `\`+${reward}\` fichas`, inline: true },
          { name: "🏦 Saldo nuevo", value: `\`${newBalance.toLocaleString()}\` fichas`, inline: true },
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });
  return true;
}

// ── CfgEmbed component handler ────────────────────────────────────────────────
async function handleCfgEmbed(interaction: Interaction): Promise<boolean> {
  const botIcon = interaction.client.user?.displayAvatarURL();

  // ── Section select menu ──────────────────────────────────────────────────
  if (interaction.isStringSelectMenu()) {
    const [action, userId] = interaction.customId.split(":");
    if (action !== "cfge_section" || !userId) return false;

    if (interaction.user.id !== userId) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ Este panel no es tuyo.")],
        ephemeral: true,
      });
      return true;
    }

    const state = activeSessions.get(userId);
    if (!state) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ La sesión expiró. Vuelve a usar `/cfgembed`.")],
        ephemeral: true,
      });
      return true;
    }

    const section = interaction.values[0];

    // Immediate action — no modal
    if (section === "removefield") {
      state.fields.pop();
      await interaction.update({
        embeds: [buildPanelEmbed(state, botIcon), buildPreviewEmbed(state, botIcon)],
        components: [buildSectionMenu(userId), buildActionButtons(userId)],
      });
      return true;
    }

    // Show modal for the selected section
    switch (section) {
      case "content":  await interaction.showModal(buildContentModal(userId, state)); break;
      case "color":    await interaction.showModal(buildColorModal(userId, state));   break;
      case "author":   await interaction.showModal(buildAuthorModal(userId, state));  break;
      case "footer":   await interaction.showModal(buildFooterModal(userId, state));  break;
      case "field":    await interaction.showModal(buildFieldModal(userId));          break;
      case "image":    await interaction.showModal(buildImageModal(userId, state));   break;
      default: return false;
    }
    return true;
  }

  // ── Modal submit ─────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const [action, userId] = interaction.customId.split(":");
    if (!action?.startsWith("cfge_modal_") || !userId) return false;

    const state = activeSessions.get(userId);
    if (!state) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ La sesión expiró.")],
        ephemeral: true,
      });
      return true;
    }

    const section = action.replace("cfge_modal_", "");

    switch (section) {
      case "content": {
        const t = interaction.fields.getTextInputValue("title").trim();
        const d = interaction.fields.getTextInputValue("description").trim();
        state.title = t || undefined;
        state.description = d || undefined;
        break;
      }
      case "color": {
        const hex = interaction.fields.getTextInputValue("color").replace(/^#/, "").trim();
        const parsed = parseInt(hex, 16);
        if (!isNaN(parsed) && hex.length === 6) state.color = parsed;
        break;
      }
      case "author": {
        const name = interaction.fields.getTextInputValue("authorName").trim();
        const icon = interaction.fields.getTextInputValue("authorIcon").trim();
        state.authorName = name || undefined;
        state.authorIconURL = icon || undefined;
        break;
      }
      case "footer": {
        const text = interaction.fields.getTextInputValue("footerText").trim();
        state.footerText = text || undefined;
        break;
      }
      case "field": {
        if (state.fields.length < 25) {
          state.fields.push({
            name:   interaction.fields.getTextInputValue("fieldName").trim(),
            value:  interaction.fields.getTextInputValue("fieldValue").trim(),
            inline: interaction.fields.getTextInputValue("inline").trim().toLowerCase() === "si",
          });
        }
        break;
      }
      case "image": {
        const url = interaction.fields.getTextInputValue("imageURL").trim();
        state.imageURL = url || state.botBannerURL || undefined;
        break;
      }
    }

    // Acknowledge and update original panel
    if (interaction.isFromMessage()) {
      await interaction.deferUpdate();
    } else {
      await interaction.deferReply({ ephemeral: true });
    }

    await state.originalInteraction.editReply({
      embeds: [buildPanelEmbed(state, botIcon), buildPreviewEmbed(state, botIcon)],
      components: [buildSectionMenu(userId), buildActionButtons(userId)],
    });

    if (!interaction.isFromMessage()) {
      await interaction.deleteReply().catch(() => null);
    }

    return true;
  }

  // ── Action buttons ───────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const [action, userId] = interaction.customId.split(":");
    if (!action?.startsWith("cfge_") || !userId) return false;
    if (!["cfge_send", "cfge_cancel", "cfge_reset"].includes(action)) return false;

    if (interaction.user.id !== userId) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ Este panel no es tuyo.")],
        ephemeral: true,
      });
      return true;
    }

    const state = activeSessions.get(userId);
    if (!state) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ La sesión expiró.")],
        ephemeral: true,
      });
      return true;
    }

    if (action === "cfge_cancel") {
      activeSessions.delete(userId);
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setAuthor({ name: "ZeroTwo · Constructor de Embeds", iconURL: botIcon })
            .setDescription("❌ Constructor cancelado.")
            .setTimestamp(),
        ],
        components: [],
      });
      return true;
    }

    if (action === "cfge_reset") {
      const fresh = {
        color: 0xec4899,
        fields: [] as { name: string; value: string; inline: boolean }[],
        targetChannelId: state.targetChannelId,
        originalInteraction: state.originalInteraction,
        botBannerURL: state.botBannerURL,
        imageURL: state.botBannerURL ?? undefined,
        expiresAt: Date.now() + 15 * 60 * 1000,
      };
      activeSessions.set(userId, fresh);
      await interaction.update({
        embeds: [buildPanelEmbed(fresh, botIcon), buildPreviewEmbed(fresh, botIcon)],
        components: [buildSectionMenu(userId), buildActionButtons(userId)],
      });
      return true;
    }

    if (action === "cfge_send") {
      const channel = interaction.guild?.channels.cache.get(state.targetChannelId);
      if (!channel?.isTextBased()) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ No se pudo encontrar el canal de destino.")],
          ephemeral: true,
        });
        return true;
      }

      await channel.send({ embeds: [buildPreviewEmbed(state, botIcon)] });
      activeSessions.delete(userId);

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00f5d4)
            .setAuthor({ name: "ZeroTwo · Constructor de Embeds", iconURL: botIcon })
            .setDescription(`✅ **Embed enviado** a <#${state.targetChannelId}>.`)
            .setTimestamp(),
        ],
        components: [],
      });
      return true;
    }

    return false;
  }

  return false;
}

export default async function onInteractionCreate(interaction: Interaction) {
  if (await handleBlackjack(interaction)) return;
  if (await handleShop(interaction)) return;
  if (await handleInventory(interaction)) return;
  if (await handleCfgEmbed(interaction)) return;

  const { handleMusicButtons } = await import("../music/buttons.js");
  if (await handleMusicButtons(interaction)) return;

  const { handleTicketInteraction } = await import("./ticketInteractions.js");
  if (await handleTicketInteraction(interaction)) return;

  if (!interaction.isChatInputCommand()) return;

  const client = interaction.client as BotClient;
  const { commandName, user, guild } = interaction;

  const command = client.commands.get(commandName);
  if (!command) return;

  if (devState.current.maintenanceMode) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff2d6b)
          .setTitle("🔧 Calibración en Proceso // Mantenimiento")
          .setDescription(
            devState.current.maintenanceMessage ||
              "Cariño, el sistema se está optimizando en este momento. ¡Vuelve pronto! 💕",
          )
          .setFooter({ text: "ZeroTwo System · Laboratorio de Parásitos" })
          .setTimestamp(),
      ],
      ephemeral: true,
    });
  }

  if (!client.cooldowns.has(command.data.name)) {
    client.cooldowns.set(command.data.name, new Collection());
  }

  const timestamps = client.cooldowns.get(command.data.name)!;
  const cooldownMs = (command.cooldown ?? 3) * 1000;
  const now = Date.now();

  if (timestamps.has(user.id)) {
    const expirationTime = timestamps.get(user.id)!;

    if (now < expirationTime) {
      const relativeTimestamp = Math.floor(expirationTime / 1000);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setDescription(
              `🛑 ¡Cálmate! Estás pilotando demasiado rápido. Podrás usar \`/${command.data.name}\` **<t:${relativeTimestamp}:R>**.`,
            ),
        ],
        ephemeral: true,
      });
    }
  }

  const expiration = now + cooldownMs;
  timestamps.set(user.id, expiration);
  setTimeout(() => timestamps.delete(user.id), cooldownMs);

  let success = true;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    success = false;
    logger.error(
      { err, command: commandName },
      `Error ejecutando comando: ${commandName}`,
    );

    // Dev error log channel (rich embed + traceback)
    try {
      const { reportDevError, contextFromInteraction } = await import(
        "../lib/devErrorLog.js"
      );
      const ctx = contextFromInteraction(interaction);
      await reportDevError(client, err, ctx);
    } catch (logErr) {
      logger.error({ logErr }, "No se pudo reportar error a DEV_LOG_CHANNEL");
    }

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🚨 Error de Sincronización")
      .setDescription(
        "Hubo un fallo en la conexión con el Franxx al ejecutar este comando.",
      )
      .setTimestamp();

    // Ignore expired interactions (10062) — ban/kick already applied
    const isUnknown =
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 10062;

    if (!isUnknown) {
      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({
            embeds: [errorEmbed],
            flags: 64, // MessageFlags.Ephemeral
          })
          .catch(() => null);
      } else {
        await interaction
          .reply({
            embeds: [errorEmbed],
            flags: 64,
          })
          .catch(() => null);
      }
    }
  }

  try {
    await Promise.all([
      db.insert(activityTable).values({
        command: commandName,
        userId: user.id,
        username: user.username,
        guildId: guild?.id ?? "DM",
        guildName: guild?.name ?? "DM",
        success,
      }),
      db
        .insert(commandStatsTable)
        .values({
          command: commandName,
          count: 1,
          lastUsed: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            count: sql`${commandStatsTable.count} + 1`,
            lastUsed: new Date(),
          },
        }),
    ]);
  } catch (dbErr) {
    logger.error(
      { err: dbErr },
      "Error al registrar la actividad en la base de datos",
    );
  }
}
