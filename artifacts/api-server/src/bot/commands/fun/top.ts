import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { db, economyTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const MEDALS = ["🥇", "🥈", "🥉"];
const RANK_COLORS = [0xffd700, 0xc0c0c0, 0xcd7f32];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("top")
    .setDescription("🏆 Ranking de fichas del servidor — los 10 más ricos del casino")
    .addStringOption((o) =>
      o
        .setName("tipo")
        .setDescription("Clasificar por")
        .setRequired(false)
        .addChoices(
          { name: "💰 Saldo actual", value: "balance" },
          { name: "📈 Total ganado", value: "earned" },
          { name: "🃏 Partidas jugadas", value: "games" },
        ),
    ) as SlashCommandBuilder,

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guildId = interaction.guild?.id ?? "";
    const tipo = interaction.options.getString("tipo") ?? "balance";

    await interaction.deferReply();

    const sortCol =
      tipo === "earned"
        ? economyTable.totalEarned
        : tipo === "games"
          ? economyTable.gamesPlayed
          : economyTable.balance;

    const rows = await db
      .select()
      .from(economyTable)
      .where(eq(economyTable.guildId, guildId))
      .orderBy(desc(sortCol))
      .limit(10);

    if (rows.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xec4899)
            .setDescription("❌ Nadie ha jugado todavía en este servidor. ¡Sé el primero con `/blackjack`!"),
        ],
      });
      return;
    }

    const typeLabel =
      tipo === "earned" ? "Total Ganado" : tipo === "games" ? "Partidas" : "Saldo";
    const typeEmoji =
      tipo === "earned" ? "📈" : tipo === "games" ? "🃏" : "💰";

    let leaderboard = "";
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const medal = MEDALS[i] ?? `**${i + 1}.**`;
      const value =
        tipo === "earned"
          ? `${row.totalEarned.toLocaleString()} fichas`
          : tipo === "games"
            ? `${row.gamesPlayed} partidas`
            : `${row.balance.toLocaleString()} fichas`;

      const winRate =
        row.gamesPlayed > 0
          ? `${((row.gamesWon / row.gamesPlayed) * 100).toFixed(0)}% WR`
          : "—";

      leaderboard += `${medal} <@${row.userId}> — **${value}** · \`${winRate}\`\n`;
    }

    const embedColor = RANK_COLORS[0] ?? 0xffd700;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name: `ZeroTwo Casino · Top ${typeLabel}`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(`${typeEmoji} Ranking del Casino — ${interaction.guild?.name ?? "Servidor"}`)
      .setDescription(leaderboard)
      .setThumbnail(interaction.guild?.iconURL() ?? null)
      .addFields({
        name: "📊 Clasificando por",
        value: `${typeEmoji} ${typeLabel}`,
        inline: true,
      })
      .setFooter({
        text: `ZeroTwo Casino · ${rows.length} jugadores · Usa /blackjack para subir el ranking`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
