import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { activeGames, buildBetMenu } from "../../games/blackjack.js";
import { getBalance } from "../../lib/economy.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("🃏 Juega una partida de Blackjack en el casino de ZeroTwo"),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const userId = interaction.user.id;
    const guildId = interaction.guild?.id ?? "";

    if (activeGames.has(userId)) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setAuthor({
              name: "ZeroTwo Casino",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setDescription(
              "❌ Ya tienes una partida activa. Termínala antes de iniciar una nueva.",
            )
            .setFooter({ text: "Usa Stand o espera a que expire." }),
        ],
        ephemeral: true,
      });
      return;
    }

    const balance = await getBalance(guildId, userId);

    const embed = new EmbedBuilder()
      .setColor(0xec4899)
      .setAuthor({
        name: "ZeroTwo Casino · Blackjack",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🎰 ZeroTwo Casino — Blackjack")
      .setDescription(
        "Selecciona tu **apuesta** en el menú de abajo para comenzar.\n\n" +
          "```\n" +
          "Reglas del casino:\n" +
          "  • Acércate a 21 sin pasarte\n" +
          "  • El dealer pide carta hasta ≥17\n" +
          "  • Blackjack (21 en 2 cartas) paga ×1.5\n" +
          "  • Doblar: apuesta ×2, recibes 1 carta final\n" +
          "```",
      )
      .setThumbnail(interaction.user.displayAvatarURL())
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
        text: "ZeroTwo Casino · Solo tú puedes jugar esta partida",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    const menu = buildBetMenu(userId, balance);
    await interaction.reply({ embeds: [embed], components: [menu] });
  },
};

export default command;
