import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import { claimDaily, getEconomy } from "../../lib/economy.js";
import { logBotEvent } from "../../../lib/botLogger.js";
import { checkAndAssignLevelRoles } from "../../lib/levelRoles.js";

function msToHM(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription(
      "🎁 Reclama tu recompensa diaria de fichas. ¡Mantén la racha para bonificaciones!",
    ) as SlashCommandBuilder,

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guildId = interaction.guild?.id ?? "";
    if (!guildId) {
      return interaction.reply({
        content: "❌ Este comando solo funciona en un servidor.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const result = await claimDaily(guildId, interaction.user.id);

    if (!result.success) {
      const timeLeft = msToHM(result.msLeft);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xec4899)
            .setAuthor({
              name: "Recompensa Diaria // Zero Two",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTitle("⏳ Ya reclamaste tu recompensa hoy")
            .setDescription(
              `Vuelve en **${timeLeft}** para recibir tu siguiente recompensa.\n\n` +
                `Mantén la racha diaria para conseguir más bonificaciones. 🔥`,
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp(),
        ],
      });
    }

    // Obtener economía actualizada para mostrar saldo
    const eco = await getEconomy(guildId, interaction.user.id);

    // Intentar asignar rol por nivel si corresponde
    const guild = interaction.guild;
    if (guild) {
      try {
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (member) {
          await checkAndAssignLevelRoles(guild, member, eco.balance);
        }
      } catch {
        // No crítico — no interrumpir el flujo
      }
    }

    const streakEmoji = result.streak >= 7 ? "🔥" : result.streak >= 3 ? "⚡" : "✨";
    const isNewStreak = result.streak === 1;
    const BASE = 200;

    const embed = new EmbedBuilder()
      .setColor(0xec4899)
      .setAuthor({
        name: "Recompensa Diaria // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🎁 ¡Recompensa reclamada!")
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: "💰 Fichas recibidas",
          value: `\`\`\`\n+${result.coins.toLocaleString("es-ES")} fichas\n\`\`\``,
          inline: false,
        },
        {
          name: "💵 Base",
          value: `\`${BASE}\``,
          inline: true,
        },
        {
          name: "🎯 Bonus racha",
          value: `\`+${result.coins - BASE}\``,
          inline: true,
        },
        {
          name: `${streakEmoji} Racha`,
          value: `\`${result.streak} día${result.streak !== 1 ? "s" : ""}\``,
          inline: true,
        },
        {
          name: "💳 Saldo total",
          value: `\`${eco.balance.toLocaleString("es-ES")} fichas\``,
          inline: false,
        },
      )
      .setDescription(
        isNewStreak
          ? "¡Empieza a construir tu racha! Vuelve mañana para mantenerla. 🌸"
          : result.streak >= 7
            ? `¡Racha increíble de **${result.streak} días**! Sigue así. 🔥`
            : `Racha activa de **${result.streak} días** — ¡no la pierdas! ⚡`,
      )
      .setFooter({
        text: "Vuelve mañana a la misma hora · /wallet para ver tu saldo",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logBotEvent({
      level: "info",
      event: "economy",
      details: {
        action: "daily",
        coins: result.coins,
        streak: result.streak,
        newBalance: eco.balance,
      },
      guildId,
      guildName: interaction.guild?.name,
      userId: interaction.user.id,
      username: interaction.user.username,
    });
  },
};

export default command;
