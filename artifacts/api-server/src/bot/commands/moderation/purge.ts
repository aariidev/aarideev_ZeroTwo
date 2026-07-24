import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  TextChannel,
} from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("🧼 Borra mensajes del canal (máx. 14 días)")
    .addIntegerOption((opt) =>
      opt
        .setName("cantidad")
        .setDescription("Mensajes a purgar (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Filtrar la purga para que afecte solo a este usuario"),
    ),
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const amount = interaction.options.getInteger("cantidad", true);
    const targetUser = interaction.options.getUser("usuario");
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    const messages = await channel.messages.fetch({ limit: 100 });
    let toDelete = [...messages.values()];

    if (targetUser) {
      toDelete = toDelete.filter((m) => m.author.id === targetUser.id);
    }

    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    toDelete = toDelete
      .filter((m) => m.createdTimestamp > twoWeeksAgo)
      .slice(0, amount);

    if (toDelete.length === 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription(
              "❌ No se encontraron registros elegibles dentro del límite temporal compatible (14 días).",
            ),
        ],
      });
    }

    const deleted = await channel.bulkDelete(toDelete, true);

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Depuración de Canales // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🧹 Proceso de Purga Finalizado")
      .setDescription(
        `Se han eliminado con éxito **${deleted.size}** paquetes de datos del chat.`,
      )
      .addFields(
        { name: "📍 Sector Limpiado", value: `<#${channel.id}>`, inline: true },
        {
          name: "👤 Restricción de Autor",
          value: targetUser ? `${targetUser.tag}` : "`Ninguna (Purga Global)`",
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    await logBotEvent({
      level: "info",
      event: "purge",
      details: {
        channelId: channel.id,
        purgedCount: deleted.size,
        targetUserFilter: targetUser?.id ?? null,
      },
      guildId: interaction.guild?.id,
      guildName: interaction.guild?.name,
    });
  },
};

export default command;
