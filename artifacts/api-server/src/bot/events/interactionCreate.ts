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

export default async function onInteractionCreate(interaction: Interaction) {
  // Handle blackjack components first
  if (await handleBlackjack(interaction)) return;

  if (!interaction.isChatInputCommand()) return;

  const client = interaction.client as BotClient;
  const { commandName, user, guild } = interaction;

  const command = client.commands.get(commandName);
  if (!command) return;

  if (devState.maintenanceMode) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff2d6b)
          .setTitle("🔧 Calibración en Proceso // Mantenimiento")
          .setDescription(
            devState.maintenanceMessage ||
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
