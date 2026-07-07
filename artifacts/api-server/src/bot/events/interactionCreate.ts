import { Interaction, EmbedBuilder, Collection } from "discord.js";
import { logger } from "../../lib/logger.js";
import { BotClient } from "../types.js";
import { db, activityTable, commandStatsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { devState } from "../../lib/devState.js";
import {
  activeGames,
  buildEmbed,
  buildGameButtons,
  buildBetMenu,
  createDeck,
  handValue,
  dealerPlay,
  GameState,
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

// ── Blackjack component handler ───────────────────────────────────────────────
async function handleBlackjack(interaction: Interaction): Promise<boolean> {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return false;

  const [action, ownerId] = interaction.customId.split(":");
  if (!action?.startsWith("bj_") || !ownerId) return false;

  // Only the original player can interact
  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ Esta partida no es tuya.")],
      ephemeral: true,
    });
    return true;
  }

  const botIcon = interaction.client.user?.displayAvatarURL();

  // ── Bet selection ─────────────────────────────────────────────────────────
  if (action === "bj_bet" && interaction.isStringSelectMenu()) {
    const bet = parseInt(interaction.values[0]!);
    const deck = createDeck();
    const playerHand = [deck.pop()!, deck.pop()!];
    const dealerHand = [deck.pop()!, deck.pop()!];

    const state: GameState = {
      playerHand,
      dealerHand,
      deck,
      bet,
      doubled: false,
      username: interaction.user.username,
      avatarURL: interaction.user.displayAvatarURL(),
    };
    activeGames.set(ownerId, state);

    // Instant blackjack?
    if (handValue(playerHand) === 21) {
      activeGames.delete(ownerId);
      const embed = buildEmbed(state, "blackjack", botIcon);
      const row = buildGameButtons(ownerId, false, true);
      await interaction.update({ embeds: [embed], components: [row] });
      return true;
    }

    const embed = buildEmbed(state, "playing", botIcon);
    const row = buildGameButtons(ownerId, true);
    await interaction.update({ embeds: [embed], components: [row] });
    return true;
  }

  // ── Game buttons ──────────────────────────────────────────────────────────
  if (!interaction.isButton()) return false;

  const state = activeGames.get(ownerId);
  if (!state) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xff2d6b).setDescription("❌ No hay partida activa. Usa `/blackjack` para empezar.")],
      ephemeral: true,
    });
    return true;
  }

  if (action === "bj_hit") {
    state.playerHand.push(state.deck.pop()!);
    const val = handValue(state.playerHand);

    if (val > 21) {
      // Bust
      activeGames.delete(ownerId);
      const embed = buildEmbed(state, "bust", botIcon);
      const row = buildGameButtons(ownerId, false, true);
      await interaction.update({ embeds: [embed], components: [row] });
      return true;
    }

    if (val === 21) {
      // Auto-stand
      const status = dealerPlay(state);
      activeGames.delete(ownerId);
      const embed = buildEmbed(state, status, botIcon);
      const row = buildGameButtons(ownerId, false, true);
      await interaction.update({ embeds: [embed], components: [row] });
      return true;
    }

    // Still playing — remove double option after first hit
    const embed = buildEmbed(state, "playing", botIcon);
    const row = buildGameButtons(ownerId, false); // can't double after hitting
    await interaction.update({ embeds: [embed], components: [row] });
    return true;
  }

  if (action === "bj_stand") {
    const status = dealerPlay(state);
    activeGames.delete(ownerId);
    const embed = buildEmbed(state, status, botIcon);
    const row = buildGameButtons(ownerId, false, true);
    await interaction.update({ embeds: [embed], components: [row] });
    return true;
  }

  if (action === "bj_double") {
    state.bet *= 2;
    state.doubled = true;
    state.playerHand.push(state.deck.pop()!);
    const val = handValue(state.playerHand);

    let status;
    if (val > 21) {
      status = "bust" as const;
    } else {
      status = dealerPlay(state);
    }

    activeGames.delete(ownerId);
    const embed = buildEmbed(state, status, botIcon);
    const row = buildGameButtons(ownerId, false, true);
    await interaction.update({ embeds: [embed], components: [row] });
    return true;
  }

  return false;
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
  // Handle blackjack components first
  if (await handleBlackjack(interaction)) return;

  // Handle cfgembed builder
  if (await handleCfgEmbed(interaction)) return;

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

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🚨 Error de Sincronización")
      .setDescription(
        "Hubo un fallo en la conexión con el Franxx al ejecutar este comando.",
      )
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction
        .followUp({ embeds: [errorEmbed], ephemeral: true })
        .catch(() => null);
    } else {
      await interaction
        .reply({ embeds: [errorEmbed], ephemeral: true })
        .catch(() => null);
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
        .onConflictDoUpdate({
          target: commandStatsTable.command,
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
