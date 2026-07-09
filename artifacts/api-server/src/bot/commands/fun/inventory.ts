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
import { getInventory } from "../../lib/economy.js";
import { SHOP_ITEMS } from "../../lib/shop.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("🎒 Muestra tu inventario de ítems del casino") as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guildId = interaction.guild?.id ?? "";
    const inv = await getInventory(guildId, interaction.user.id);

    const owned = inv.filter((row) => row.quantity > 0);

    if (owned.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setAuthor({
              name: "ZeroTwo Casino · Inventario",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTitle("🎒 Inventario Vacío")
            .setDescription(
              "No tienes ningún ítem.\n" +
                "Visita `/shop` para comprar mejoras y cajas.",
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xec4899)
      .setAuthor({
        name: "ZeroTwo Casino · Inventario",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(`🎒 Inventario de ${interaction.user.username}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({
        text: "Los ítems pasivos se activan solos en el próximo Blackjack · Los instantáneos se usan con el botón",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    const instantButtons: ButtonBuilder[] = [];

    for (const row of owned) {
      const item = SHOP_ITEMS[row.itemId];
      if (!item) continue;
      const typeLabel = item.type === "passive" ? "🔄 Pasivo" : "⚡ Instantáneo";

      embed.addFields({
        name: `${item.emoji} ${item.name} ×${row.quantity}`,
        value: `${item.description}\n> ${typeLabel} · *${item.effect}*`,
        inline: false,
      });

      if (item.type === "instant") {
        instantButtons.push(
          new ButtonBuilder()
            .setCustomId(`inv_use:${interaction.user.id}:${item.id}`)
            .setLabel(`Usar ${item.name}`)
            .setEmoji(item.emoji)
            .setStyle(ButtonStyle.Success),
        );
      }
    }

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < instantButtons.length; i += 3) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...instantButtons.slice(i, i + 3),
        ),
      );
    }

    await interaction.reply({ embeds: [embed], components: rows });
  },
};

export default command;
