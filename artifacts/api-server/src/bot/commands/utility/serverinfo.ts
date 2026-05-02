import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("🏠 Muestra información del servidor"),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const guild = interaction.guild!;
    await guild.fetch();

    const verificationLevels = ["Ninguno", "Bajo", "Medio", "Alto", "Muy alto"];
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🏠 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .addFields(
        { name: "ID", value: guild.id, inline: true },
        { name: "Propietario", value: `<@${guild.ownerId}>`, inline: true },
        { name: "Creado", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "Miembros", value: `${guild.memberCount}`, inline: true },
        { name: "Canales", value: `${guild.channels.cache.size}`, inline: true },
        { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
        { name: "Verificación", value: verificationLevels[guild.verificationLevel] ?? "Desconocido", inline: true },
        { name: "Nivel de boost", value: `${guild.premiumTier}`, inline: true },
        { name: "Boosts", value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }) ?? null);
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
