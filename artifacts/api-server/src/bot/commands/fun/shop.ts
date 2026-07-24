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
import {
  accessBadge,
  isShopOwner,
  listShopItemsFor,
  type ShopAccess,
  type ShopItem,
} from "../../lib/shop.js";
import { getBalance } from "../../lib/economy.js";
import { isBetaTester } from "../../lib/betatesters.js";

function buttonStyleFor(access: ShopAccess): ButtonStyle {
  if (access === "owner") return ButtonStyle.Danger;
  if (access === "beta") return ButtonStyle.Success;
  return ButtonStyle.Primary;
}

function sectionTitle(access: ShopAccess): string {
  if (access === "owner") return "👑 Exclusivos Dev";
  if (access === "beta") return "🧪 Exclusivos Beta";
  return "🌐 Catálogo público";
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription(
      "🏪 Tienda del casino — ítems públicos, beta y dev",
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guildId = interaction.guild?.id ?? "";
    const userId = interaction.user.id;
    const balance = await getBalance(guildId, userId);
    const items = listShopItemsFor(userId);

    const tierHint = isShopOwner(userId)
      ? "Acceso **👑 Dev** (ves todo el catálogo)."
      : isBetaTester(userId)
        ? "Acceso **🧪 Beta** (catálogo público + exclusivos beta)."
        : "Acceso **público**. Los ítems 🧪/👑 no aparecen aquí.";

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setAuthor({
        name: "ZeroTwo Casino · Tienda",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🏪 Tienda de Fichas")
      .setDescription(
        [
          `> Tu saldo: **${balance.toLocaleString()} fichas** 💰`,
          `> ${tierHint}`,
          "",
          "Pulsa un botón para comprar. Los **pasivos** se activan solos en el próximo Blackjack; los **instantáneos** se abren en `/inventory`.",
        ].join("\n"),
      )
      .setThumbnail(client.user?.displayAvatarURL() ?? null);

    const byAccess: Record<ShopAccess, ShopItem[]> = {
      public: [],
      beta: [],
      owner: [],
    };
    for (const item of items) byAccess[item.access].push(item);

    for (const access of ["public", "beta", "owner"] as ShopAccess[]) {
      const group = byAccess[access];
      if (!group.length) continue;
      const lines = group.map((item) => {
        const canAfford = balance >= item.price;
        const mark = canAfford ? "✅" : "❌";
        return (
          `${item.emoji} **${item.name}** — \`${item.price.toLocaleString()}\` ${mark}\n` +
          `└ ${item.description}\n` +
          `└ *${item.effect}*`
        );
      });
      // Discord field value max 1024
      let chunk = "";
      let part = 1;
      for (const line of lines) {
        const next = chunk ? `${chunk}\n\n${line}` : line;
        if (next.length > 1000) {
          embed.addFields({
            name:
              part === 1
                ? sectionTitle(access)
                : `${sectionTitle(access)} (cont.)`,
            value: chunk.slice(0, 1024),
            inline: false,
          });
          chunk = line;
          part++;
        } else {
          chunk = next;
        }
      }
      if (chunk) {
        embed.addFields({
          name:
            part === 1 ? sectionTitle(access) : `${sectionTitle(access)} (cont.)`,
          value: chunk.slice(0, 1024),
          inline: false,
        });
      }
    }

    embed
      .setFooter({
        text: `${items.length} ítems · ${accessBadge("public")} / 🧪 / 👑 · ZeroTwo Casino`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    // Max 5 rows × 5 buttons. Prefer 5 por fila si hay muchos.
    const perRow = items.length > 15 ? 5 : items.length > 10 ? 4 : 3;
    const buttons = items.slice(0, 25).map((item) =>
      new ButtonBuilder()
        .setCustomId(`shop_buy:${userId}:${item.id}`)
        .setLabel(
          item.name.length > 20 ? item.name.slice(0, 18) + "…" : item.name,
        )
        .setEmoji(item.emoji)
        .setStyle(buttonStyleFor(item.access))
        .setDisabled(balance < item.price),
    );

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length && rows.length < 5; i += perRow) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...buttons.slice(i, i + perRow),
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
