import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import {
  activeGames,
  lastBets,
  buildBetMenu,
  buildLobbyEmbed,
  buildLobbyButtons,
  buildEmbed,
  buildGameButtons,
  buildEndButtons,
  createDeck,
  handValue,
  clampBet,
  BJ_MIN_BET,
  BJ_MAX_BET,
  type GameState,
} from "../../games/blackjack.js";
import {
  getBalance,
  deductBalance,
  addBalance,
  recordGame,
  calculateBlackjackPayout,
  consumeBlackjackPassives,
} from "../../lib/economy.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("🃏 Blackjack del casino — apuesta y gana fichas")
    .addIntegerOption((opt) =>
      opt
        .setName("apuesta")
        .setDescription(
          `Apuesta personalizada (${BJ_MIN_BET} – ${BJ_MAX_BET.toLocaleString()} fichas)`,
        )
        .setMinValue(BJ_MIN_BET)
        .setMaxValue(BJ_MAX_BET)
        .setRequired(false),
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id ?? "";
    const botIcon = client.user?.displayAvatarURL();
    const customBet = interaction.options.getInteger("apuesta");

    if (activeGames.has(userId)) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setAuthor({
              name: "ZeroTwo Casino",
              iconURL: botIcon,
            })
            .setDescription(
              "❌ Ya tienes una partida activa. Termínala antes de iniciar una nueva.",
            )
            .setFooter({ text: "Usa Stand o espera a que expire." }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const balance = await getBalance(guildId, userId);

    // ── Direct start with /blackjack apuesta:N ──────────────────────────────
    if (customBet != null) {
      const check = clampBet(customBet, balance);
      if (!check.ok) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff2d6b)
              .setDescription(`❌ ${check.error}`),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply();

      const bet = check.bet;
      const { success, balance: balanceAfterBet } = await deductBalance(
        guildId,
        userId,
        bet,
      );
      if (!success) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff2d6b)
              .setDescription(
                `❌ Saldo insuficiente. Necesitas **${bet.toLocaleString()}** pero tienes **${balanceAfterBet.toLocaleString()}**.`,
              ),
          ],
        });
        return;
      }

      const {
        multiplierActive,
        insuranceActive,
        fullInsuranceActive,
      } = await consumeBlackjackPassives(guildId, userId);

      const deck = createDeck();
      const playerHand = [deck.pop()!, deck.pop()!];
      const dealerHand = [deck.pop()!, deck.pop()!];

      const state: GameState = {
        playerHand,
        dealerHand,
        deck,
        bet,
        originalBet: bet,
        doubled: false,
        username: interaction.user.username,
        avatarURL: interaction.user.displayAvatarURL(),
        guildId,
        userId,
        startBalance: balanceAfterBet + bet,
        multiplierActive,
        insuranceActive,
        fullInsuranceActive,
        startedAt: new Date(),
      };
      activeGames.set(userId, state);
      lastBets.set(userId, bet);

      if (handValue(playerHand) === 21) {
        activeGames.delete(userId);
        const payout = calculateBlackjackPayout(
          "blackjack",
          bet,
          multiplierActive,
          insuranceActive,
          fullInsuranceActive,
        );
        const newBalance = await addBalance(guildId, userId, payout);
        await recordGame(guildId, userId, true, bet);
        state.netLabel = `+**${multiplierActive ? Math.floor(bet * 3) : Math.floor(bet * 1.5)}** fichas`;
        state.finalBalance = newBalance;
        await interaction.editReply({
          embeds: [buildEmbed(state, "blackjack", botIcon)],
          components: buildEndButtons(userId, bet, newBalance),
        });
        return;
      }

      await interaction.editReply({
        embeds: [buildEmbed(state, "playing", botIcon)],
        components: [buildGameButtons(userId, true)],
      });
      return;
    }

    // ── Lobby ───────────────────────────────────────────────────────────────
    const embed = buildLobbyEmbed(
      interaction.user.username,
      interaction.user.displayAvatarURL(),
      balance,
      botIcon,
    );
    const last = lastBets.get(userId);

    await interaction.reply({
      embeds: [embed],
      components: [
        buildBetMenu(userId, balance),
        buildLobbyButtons(userId, balance, last),
      ],
    });
  },
};

export default command;
