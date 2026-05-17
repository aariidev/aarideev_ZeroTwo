import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("🏠 Muestra el reporte analítico del estado del servidor"),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guild = interaction.guild!;
    await guild.fetch();

    const verificationLevels = [
      "Ninguno (Libre)",
      "Bajo (Email)",
      "Medio (Registrado)",
      "Alto (10 min en server)",
      "Muy alto (Celular)",
    ];
    const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: `Análisis de Entorno // Reporte de Plantación`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(`🏠 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 512 }) ?? null)
      .addFields(
        { name: "🆔 ID de Entorno", value: `\`${guild.id}\``, inline: true },
        {
          name: "👑 Comandante / Owner",
          value: `<@${guild.ownerId}>`,
          inline: true,
        },
        {
          name: "📅 Fundación Oficial",
          value: `<t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)`,
          inline: false,
        },
        {
          name: "👥 Población Total",
          value: `\`${guild.memberCount} parásitos\``,
          inline: true,
        },
        {
          name: "💬 Sectores (Canales)",
          value: `\`${guild.channels.cache.size} zonas\``,
          inline: true,
        },
        {
          name: "🔮 Protocolos (Roles)",
          value: `\`${guild.roles.cache.size} rangos\``,
          inline: true,
        },
        {
          name: "🔒 Filtro de Seguridad",
          value: `\`${verificationLevels[guild.verificationLevel] ?? "Desconocido"}\``,
          inline: true,
        },
        {
          name: "⚡ Nivel de Energía Boost",
          value: `\`Nivel ${guild.premiumTier}\` (${guild.premiumSubscriptionCount ?? 0} Boosts)`,
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({
        text: `Estadísticas críticas del entorno de control`,
        iconURL: client.user?.displayAvatarURL(),
      });

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }) ?? null);
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
