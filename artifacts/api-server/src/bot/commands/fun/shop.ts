import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { SHOP_ITEMS } from "../../lib/shop.js";
import { getBalance } from "../../lib/economy.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("🏪 Tienda del casino — compra mejoras y cajas con tus fichas") as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guildId = interaction.guild?.id ?? "";
    const balance = await getBalance(guildId, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setAuthor({
        name: "ZeroTwo Casino · Tienda",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🏪 Tienda de Fichas")
      .setDescription(
        `> Tu saldo: **${balance.toLocaleString()} fichas** 💰\n\n` +
          "Usa los botones para comprar ítems. Los pasivos se activan automáticamente en tu próxima partida de Blackjack.",
      )
      .setThumbnail(client.user?.displayAvatarURL() ?? null);

    for (const item of Object.values(SHOP_ITEMS)) {
      const canAfford = balance >= item.price;
      embed.addFields({
        name: `${item.emoji} ${item.name} — \`${item.price.toLocaleString()} fichas\``,
        value:
          `${item.description}\n` +
          `> *${item.effect}*\n` +
          `> ${canAfford ? "✅ Puedes comprarlo" : "❌ Fondos insuficientes"}`,
        inline: false,
      });
    }

    embed
      .setFooter({
        text: "ZeroTwo Casino · Los ítems pasivos se usan automáticamente en la siguiente partida de Blackjack",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    const buttons = Object.values(SHOP_ITEMS).map((item) =>
      new ButtonBuilder()
        .setCustomId(`shop_buy:${interaction.user.id}:${item.id}`)
        .setLabel(item.name)
        .setEmoji(item.emoji)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(balance < item.price),
    );

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 3) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...buttons.slice(i, i + 3),
        ),
      );
    }

    await interaction.reply({ embeds: [embed], components: rows });
  },
};

export default command;
