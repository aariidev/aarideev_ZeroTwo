import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("👢 Expulsa a un usuario del servidor")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a expulsar").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo de la expulsión")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const reason = interaction.options.getString("motivo") ?? "Sin motivo especificado";
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) {
      return interaction.reply({ content: "No pude encontrar a ese usuario.", ephemeral: true });
    }
    if (!member.kickable) {
      return interaction.reply({ content: "No puedo expulsar a ese usuario.", ephemeral: true });
    }
    if (member.id === interaction.user.id) {
      return interaction.reply({ content: "No puedes expulsarte a ti mismo.", ephemeral: true });
    }

    await member.send({
      embeds: [new EmbedBuilder()
        .setColor(0xff8800)
        .setTitle(`Has sido expulsado de ${interaction.guild?.name}`)
        .addFields({ name: "Motivo", value: reason })
        .setTimestamp()]
    }).catch(() => null);

    await member.kick(reason);

    const embed = new EmbedBuilder()
      .setColor(0xff8800)
      .setTitle("👢 Usuario Expulsado")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "Usuario", value: `${target.tag} (${target.id})`, inline: true },
        { name: "Moderador", value: `${interaction.user.tag}`, inline: true },
        { name: "Motivo", value: reason }
      )
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
