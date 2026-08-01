import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  GuildMember,
  User,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getInventory,
  resolveInventoryView,
  setInventoryPrivate,
  type InventoryViewReason,
} from "../../lib/economy.js";
import { SHOP_ITEMS, accessBadge } from "../../lib/shop.js";
import { logBotEvent } from "../../../lib/botLogger.js";

function secretEmbed(botIcon?: string | null) {
  return new EmbedBuilder()
    .setColor(0x6b7280)
    .setAuthor({
      name: "ZeroTwo Casino · Inventario",
      iconURL: botIcon ?? undefined,
    })
    .setTitle("🔒 Inventario privado")
    .setDescription(
      "Este parásito prefiere mantener sus pertenencias en secreto.",
    )
    .setFooter({
      text: "Zero Two · Privacidad de inventario",
      iconURL: botIcon ?? undefined,
    })
    .setTimestamp();
}

function auditFooter(reason: InventoryViewReason): string | null {
  if (reason === "owner" || reason === "staff") {
    return "🛡️ Vista de auditoría · el usuario tiene el inventario en privado";
  }
  return null;
}

function buildInventoryEmbed(opts: {
  target: User;
  owned: Awaited<ReturnType<typeof getInventory>>;
  botIcon?: string | null;
  isSelf: boolean;
  viewReason: InventoryViewReason;
  inventoryPrivate: boolean;
}) {
  const { target, owned, botIcon, isSelf, viewReason, inventoryPrivate } = opts;

  const embed = new EmbedBuilder()
    .setColor(0xec4899)
    .setAuthor({
      name: "ZeroTwo Casino · Inventario",
      iconURL: botIcon ?? undefined,
    })
    .setTitle(`🎒 Inventario de ${target.username}`)
    .setThumbnail(target.displayAvatarURL())
    .setTimestamp();

  const audit = inventoryPrivate ? auditFooter(viewReason) : null;
  if (audit) {
    embed.setFooter({ text: audit, iconURL: botIcon ?? undefined });
  } else if (isSelf) {
    embed.setFooter({
      text: inventoryPrivate
        ? "🔒 Privado · Pasivos → Blackjack · Instantáneos → Usar"
        : "🌐 Público · Pasivos → Blackjack · Instantáneos → Usar",
      iconURL: botIcon ?? undefined,
    });
  } else {
    embed.setFooter({
      text: "Vista pública · solo el dueño puede usar ítems",
      iconURL: botIcon ?? undefined,
    });
  }

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

    if (isSelf && item.type === "instant") {
      instantButtons.push(
        new ButtonBuilder()
          .setCustomId(`inv_use:${target.id}:${item.id}`)
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

  if (owned.length === 0) {
    embed.setDescription(
      isSelf
        ? "No tienes ningún ítem.\nVisita `/shop` para comprar mejoras y cajas."
        : "Este inventario está vacío.",
    );
  }

  return { embed, instantButtons };
}

function privacyRows(
  userId: string,
  inventoryPrivate: boolean,
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv_privacy:${userId}:public`)
      .setLabel("Público")
      .setEmoji("🌐")
      .setStyle(inventoryPrivate ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(!inventoryPrivate),
    new ButtonBuilder()
      .setCustomId(`inv_privacy:${userId}:private`)
      .setLabel("Privado")
      .setEmoji("🔒")
      .setStyle(inventoryPrivate ? ButtonStyle.Danger : ButtonStyle.Secondary)
      .setDisabled(inventoryPrivate),
  );
  return [row];
}

function chunkButtons(
  buttons: ButtonBuilder[],
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length && rows.length < 4; i += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...buttons.slice(i, i + 5),
      ),
    );
  }
  return rows;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("🎒 Inventario de ítems — usa cajas y configura privacidad")
    .addUserOption((o) =>
      o
        .setName("usuario")
        .setDescription("Ver el inventario de otro miembro")
        .setRequired(false),
    )
    .addStringOption((o) =>
      o
        .setName("privacidad")
        .setDescription("Configurar si otros pueden ver tu inventario")
        .setRequired(false)
        .addChoices(
          { name: "Público — otros pueden verlo", value: "public" },
          { name: "Privado — solo tú (y staff)", value: "private" },
        ),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guildId = interaction.guild?.id ?? "";
    if (!guildId) {
      await interaction.reply({
        content: "❌ Este comando solo funciona en un servidor.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const botIcon = client.user?.displayAvatarURL();
    const privacyOpt = interaction.options.getString("privacidad");

    // ── Toggle de privacidad ───────────────────────────────────────────────
    if (privacyOpt === "public" || privacyOpt === "private") {
      const next = privacyOpt === "private";
      await setInventoryPrivate(guildId, interaction.user.id, next);
      logBotEvent({
        level: "info",
        event: "economy",
        details: {
          action: "inventory_privacy",
          inventoryPrivate: next,
          source: "slash",
        },
        guildId,
        guildName: interaction.guild?.name,
        userId: interaction.user.id,
        username: interaction.user.username,
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(next ? 0x6b7280 : 0x00ff9f)
            .setAuthor({
              name: "ZeroTwo Casino · Privacidad",
              iconURL: botIcon,
            })
            .setTitle(next ? "🔒 Inventario privado" : "🌐 Inventario público")
            .setDescription(
              next
                ? "Otros parásitos **no** verán tu mochila.\nStaff del bot/servidor puede auditar. Trade y uso de ítems siguen activos."
                : "Cualquiera en el servidor puede consultar tu inventario con `/inventory usuario:`.",
            )
            .setFooter({
              text: "Zero Two · Privacidad de inventario",
              iconURL: botIcon,
            })
            .setTimestamp(),
        ],
        components: privacyRows(interaction.user.id, next),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetUser =
      interaction.options.getUser("usuario") ?? interaction.user;
    const isSelf = targetUser.id === interaction.user.id;

    let viewerMember: GuildMember | null = null;
    if (interaction.guild && !isSelf) {
      viewerMember =
        interaction.member instanceof GuildMember
          ? interaction.member
          : await interaction.guild.members
              .fetch(interaction.user.id)
              .catch(() => null);
    }

    const access = await resolveInventoryView(
      guildId,
      targetUser.id,
      interaction.user.id,
      viewerMember,
    );

    if (!access.allowed) {
      await interaction.reply({
        embeds: [secretEmbed(botIcon)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      access.inventoryPrivate &&
      (access.reason === "owner" || access.reason === "staff")
    ) {
      logBotEvent({
        level: "info",
        event: "economy",
        details: {
          action: "inventory_audit_view",
          targetUserId: targetUser.id,
          via: access.reason,
        },
        guildId,
        guildName: interaction.guild?.name,
        userId: interaction.user.id,
        username: interaction.user.username,
      });
    }

    const inv = await getInventory(guildId, targetUser.id);
    const owned = inv.filter((row) => row.quantity > 0);

    if (owned.length === 0 && isSelf) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setAuthor({
              name: "ZeroTwo Casino · Inventario",
              iconURL: botIcon,
            })
            .setTitle("🎒 Inventario Vacío")
            .setDescription(
              "No tienes ningún ítem.\n" +
                "Visita `/shop` para comprar mejoras y cajas.",
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter({
              text: access.inventoryPrivate
                ? "🔒 Privado · /inventory privacidad:"
                : "🌐 Público · /inventory privacidad:",
              iconURL: botIcon,
            })
            .setTimestamp(),
        ],
        components: privacyRows(interaction.user.id, access.inventoryPrivate),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { embed, instantButtons } = buildInventoryEmbed({
      target: targetUser,
      owned,
      botIcon,
      isSelf,
      viewReason: access.reason,
      inventoryPrivate: access.inventoryPrivate,
    });

    const components: ActionRowBuilder<ButtonBuilder>[] = [
      ...chunkButtons(instantButtons),
    ];
    if (isSelf) {
      components.push(...privacyRows(interaction.user.id, access.inventoryPrivate));
    }

    await interaction.reply({
      embeds: [embed],
      components: components.slice(0, 5),
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
