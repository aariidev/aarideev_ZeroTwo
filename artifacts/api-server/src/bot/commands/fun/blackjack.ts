import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";
import {
  activeGames,
  createDeck,
  handValue,
  buildEmbed,
  buildBetMenu,
  buildGameButtons,
  GameState,
} from "../../games/blackjack.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("🃏 Juega una partida de Blackjack en el casino de ZeroTwo"),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const userId = interaction.user.id;

    if (activeGames.has(userId)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setAuthor({ name: "ZeroTwo Casino", iconURL: client.user?.displayAvatarURL() })
            .setDescription("❌ Ya tienes una partida activa. Termínala antes de iniciar una nueva.")
            .setFooter({ text: "Usa Stand o espera a que expire." }),
        ],
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xec4899)
      .setAuthor({ name: "ZeroTwo Casino · Blackjack", iconURL: client.user?.displayAvatarURL() })
      .setTitle("🎰 Bienvenido al Casino")
      .setDescription(
        "Selecciona tu **apuesta** en el menú de abajo para comenzar la partida.\n\n" +
        "```\n" +
        "Reglas:\n" +
        "  • Acércate a 21 sin pasarte\n" +
        "  • El dealer pide carta hasta ≥17\n" +
        "  • Blackjack (21 en 2 cartas) paga ×1.5\n" +
        "  • Doblar: apuesta ×2, recibes 1 carta\n" +
        "```"
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: "ZeroTwo Casino · Solo tú puedes jugar esta partida", iconURL: client.user?.displayAvatarURL() })
      .setTimestamp();

    const menu = buildBetMenu(userId);
    await interaction.reply({ embeds: [embed], components: [menu] });
  },
};

export default command;
