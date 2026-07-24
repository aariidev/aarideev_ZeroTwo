import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import { getInventory } from "../../lib/economy.js";
import { SHOP_ITEMS, accessBadge } from "../../lib/shop.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription(
      "🎒 Muestra tu inventario de ítems del casino",
    ) as SlashCommandBuilder,

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
        flags: MessageFlags.Ephemeral,
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
        text: "Pasivos → próximo Blackjack · Instantáneos → botón Usar",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    const instantButtons: ButtonBuilder[] = [];

    for (const row of owned) {
      const item = SHOP_ITEMS[row.itemId];
      if (!item) {
        embed.addFields({
          name: `❓ \`${row.itemId}\` ×${row.quantity}`,
          value: "_Ítem desconocido (quizá de una versión anterior)_",
          inline: false,
        });
        continue;
      }
      const typeLabel =
        item.type === "passive" ? "🔄 Pasivo" : "⚡ Instantáneo";
      const badge = accessBadge(item.access);

      embed.addFields({
        name: `${item.emoji} ${item.name} ×${row.quantity}`,
        value: `${item.description}\n> ${typeLabel} · ${badge} · *${item.effect}*`,
        inline: false,
      });

      if (item.type === "instant") {
        instantButtons.push(
          new ButtonBuilder()
            .setCustomId(`inv_use:${interaction.user.id}:${item.id}`)
            .setLabel(
              item.name.length > 18
                ? `Usar ${item.name.slice(0, 16)}…`
                : `Usar ${item.name}`,
            )
            .setEmoji(item.emoji)
            .setStyle(ButtonStyle.Success),
        );
      }
    }

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < instantButtons.length && rows.length < 5; i += 5) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...instantButtons.slice(i, i + 5),
        ),
      );
    }

    await interaction.reply({
      embeds: [embed],
      components: rows,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
