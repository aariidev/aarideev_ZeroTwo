import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { getBalance, deductBalance, addBalance } from "../../lib/economy.js";

const MIN_TRANSFER = 10;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("💸 Transfiere fichas a otro miembro")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Destinatario").setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("cantidad")
        .setDescription(`Fichas a enviar (mínimo ${MIN_TRANSFER})`)
        .setRequired(true)
        .setMinValue(MIN_TRANSFER),
    ) as SlashCommandBuilder,

  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guildId = interaction.guild?.id ?? "";
    const sender = interaction.user;
    const target = interaction.options.getUser("usuario", true);
    const amount = interaction.options.getInteger("cantidad", true);
    const botIcon = client.user?.displayAvatarURL();

    // Can't pay yourself
    if (target.id === sender.id) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription("❌ No puedes transferirte fichas a ti mismo."),
        ],
        ephemeral: true,
      });
      return;
    }

    // Can't pay bots
    if (target.bot) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription("❌ No puedes transferir fichas a un bot."),
        ],
        ephemeral: true,
      });
      return;
    }

    const { success, balance: senderBalance } = await deductBalance(guildId, sender.id, amount);

    if (!success) {
      const current = await getBalance(guildId, sender.id);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              `❌ Saldo insuficiente. Quieres enviar **${amount}** fichas pero solo tienes **${current}**.\n` +
                "Reclama tu daily con `/wallet`.",
            ),
        ],
        ephemeral: true,
      });
      return;
    }

    const targetBalance = await addBalance(guildId, target.id, amount);

    const embed = new EmbedBuilder()
      .setColor(0x00ff9f)
      .setAuthor({ name: "ZeroTwo Casino · Transferencia", iconURL: botIcon })
      .setTitle("💸 Transferencia Completada")
      .setDescription(
        `**${sender.username}** ha enviado **${amount.toLocaleString()} fichas** a **${target.username}**.`,
      )
      .addFields(
        {
          name: `📤 ${sender.username}`,
          value: `Saldo restante: \`${senderBalance.toLocaleString()}\` fichas`,
          inline: true,
        },
        {
          name: `📥 ${target.username}`,
          value: `Saldo nuevo: \`${targetBalance.toLocaleString()}\` fichas`,
          inline: true,
        },
      )
      .setFooter({
        text: "ZeroTwo Casino · Las transferencias no se pueden revertir",
        iconURL: botIcon,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
