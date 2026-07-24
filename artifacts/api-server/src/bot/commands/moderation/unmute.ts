import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("🔊 Quita el silencio a un miembro")
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Parásito a restaurar")
        .setRequired(true),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member)
      return interaction.reply({
        content: "❌ El parásito no se encuentra en el servidor.",
        ephemeral: true,
      });
    if (!member.communicationDisabledUntil)
      return interaction.reply({
        content: "❌ Este sujeto no se encuentra bajo aislamiento temporal.",
        ephemeral: true,
      });

    await member.timeout(null, `Restablecido por ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Re-calibración de Enlace // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🔊 Frecuencia de Comunicación Restaurada")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        {
          name: "👤 Usuario Re-conectado",
          value: `${target.tag}`,
          inline: true,
        },
        {
          name: "🛡️ Autorizado por",
          value: `${interaction.user.tag}`,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
