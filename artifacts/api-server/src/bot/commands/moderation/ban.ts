import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 Banea a un usuario del servidor")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a banear").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo del ban")
    )
    .addIntegerOption((opt) =>
      opt.setName("dias").setDescription("Días de mensajes a eliminar (0-7)").setMinValue(0).setMaxValue(7)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const reason = interaction.options.getString("motivo") ?? "Sin motivo especificado";
    const days = interaction.options.getInteger("dias") ?? 0;

    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: "No pude encontrar a ese usuario en el servidor.", ephemeral: true });
    if (!member.bannable) return interaction.reply({ content: "No puedo banear a ese usuario.", ephemeral: true });
    if (member.id === interaction.user.id) return interaction.reply({ content: "No puedes banearte a ti mismo.", ephemeral: true });

    try {
      await member.send({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle(`Has sido baneado de ${interaction.guild?.name}`)
          .addFields({ name: "Motivo", value: reason })
          .setTimestamp()]
      }).catch(() => null);

      await member.ban({ reason, deleteMessageDays: days });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("🔨 Usuario Baneado")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "Usuario", value: `${target.tag} (${target.id})`, inline: true },
          { name: "Moderador", value: `${interaction.user.tag}`, inline: true },
          { name: "Motivo", value: reason }
        )
        .setTimestamp()
        .setFooter({ text: "ZeroTwo v2.1.0", iconURL: client.user?.displayAvatarURL() });

      await interaction.reply({ embeds: [embed] });

      await logBotEvent({
        level: "warn",
        event: "ban",
        details: { reason, deleteMessageDays: days },
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        userId: target.id,
        username: target.username,
        moderatorId: interaction.user.id,
        moderatorName: interaction.user.username,
      });
    } catch {
      await interaction.reply({ content: "Ocurrió un error al banear al usuario.", ephemeral: true });
    }
  },
};

export default command;
