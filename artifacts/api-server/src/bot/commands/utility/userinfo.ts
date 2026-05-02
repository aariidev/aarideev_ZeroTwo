import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("👤 Muestra información de un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a consultar")
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const user = interaction.options.getUser("usuario") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(user.id);

    const roles = member?.roles.cache
      .filter((r) => r.id !== interaction.guild?.id)
      .map((r) => `<@&${r.id}>`)
      .slice(0, 10)
      .join(", ") || "Ninguno";

    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor ?? 0x5865f2)
      .setTitle(`👤 ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "ID", value: user.id, inline: true },
        { name: "Bot", value: user.bot ? "Sí" : "No", inline: true },
        { name: "Cuenta creada", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });

    if (member) {
      embed.addFields(
        { name: "Apodo", value: member.nickname ?? "Ninguno", inline: true },
        { name: "En servidor desde", value: `<t:${Math.floor((member.joinedTimestamp ?? 0) / 1000)}:D>`, inline: true },
        { name: `Roles (${member.roles.cache.size - 1})`, value: roles, inline: false }
      );
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
