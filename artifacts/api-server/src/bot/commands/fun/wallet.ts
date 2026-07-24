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
import { getEconomy, claimDaily } from "../../lib/economy.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("💳 Tu saldo, stats y daily del casino")
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Ver la billetera de otro usuario")
        .setRequired(false),
    ) as SlashCommandBuilder,

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario") ?? interaction.user;
    const guildId = interaction.guild?.id ?? "";
    const isSelf = target.id === interaction.user.id;

    const eco = await getEconomy(guildId, target.id);

    const winRate =
      eco.gamesPlayed > 0
        ? ((eco.gamesWon / eco.gamesPlayed) * 100).toFixed(1)
        : "—";

    let dailyStatus = "";
    if (isSelf) {
      if (!eco.lastDaily) {
        dailyStatus = "✅ Disponible ahora";
      } else {
        const msLeft = 24 * 60 * 60 * 1000 - (Date.now() - eco.lastDaily.getTime());
        if (msLeft <= 0) {
          dailyStatus = "✅ Disponible ahora";
        } else {
          const h = Math.floor(msLeft / 3600000);
          const m = Math.floor((msLeft % 3600000) / 60000);
          dailyStatus = `⏳ ${h}h ${m}m restantes`;
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xec4899)
      .setAuthor({
        name: `${isSelf ? "Tu billetera" : `Billetera de ${target.username}`} · ZeroTwo Casino`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(`💳 ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        {
          name: "💰 Saldo Actual",
          value: `\`\`\`\n${eco.balance.toLocaleString()} fichas\n\`\`\``,
          inline: false,
        },
        {
          name: "📈 Total Ganado",
          value: `\`${eco.totalEarned.toLocaleString()}\``,
          inline: true,
        },
        {
          name: "📉 Total Perdido",
          value: `\`${eco.totalLost.toLocaleString()}\``,
          inline: true,
        },
        {
          name: "🎯 Win Rate",
          value: `\`${winRate}%\``,
          inline: true,
        },
        {
          name: "🃏 Partidas",
          value: `\`${eco.gamesPlayed}\` jugadas · \`${eco.gamesWon}\` ganadas`,
          inline: true,
        },
        {
          name: "🔥 Racha actual",
          value: `\`${eco.streak}\` victorias`,
          inline: true,
        },
        {
          name: "\u200b",
          value: "\u200b",
          inline: true,
        },
      )
      .setFooter({
        text: `ZeroTwo Casino · Cuenta creada ${eco.createdAt.toLocaleDateString("es-ES")}`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    if (isSelf) {
      embed.addFields({
        name: "📅 Recompensa Diaria",
        value: dailyStatus,
        inline: false,
      });
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    if (isSelf) {
      const now = Date.now();
      const canClaim =
        !eco.lastDaily ||
        now - eco.lastDaily.getTime() >= 24 * 60 * 60 * 1000;

      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`wallet_daily:${interaction.user.id}`)
            .setLabel("Reclamar Daily")
            .setEmoji("🎁")
            .setStyle(ButtonStyle.Success)
            .setDisabled(!canClaim),
        ),
      );
    }

    await interaction.reply({ embeds: [embed], components });
  },
};

export default command;
