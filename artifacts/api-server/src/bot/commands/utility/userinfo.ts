import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { isSpecialUserId, specialTreatmentLabel } from "../../lib/specialUser.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("👤 Despliega la ficha de parásito y estado de un usuario")
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Usuario del que se extraerá la información"),
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const user = interaction.options.getUser("usuario") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(user.id);
    const isSpecial = Boolean(member && isSpecialUserId(user.id));

    const createdTimestamp = Math.floor(user.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor ?? 0xff2d6b)
      .setAuthor({
        name: `Registro de Sujetos // Células de Identidad`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(`👤 Perfil: ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .addFields(
        {
          name: "🆔 Identificador Único",
          value: `\`${user.id}\``,
          inline: true,
        },
        {
          name: "🤖 Naturaleza",
          value: `\`${isSpecial ? "Owner / Piloto principal" : user.bot ? "Entidad de Código (Bot)" : "Humano / Parásito"}\``,
          inline: true,
        },
        {
          name: "📅 Conexión a Discord",
          value: `<t:${createdTimestamp}:D>\n(<t:${createdTimestamp}:R>)`,
          inline: false,
        },
      )
      .setTimestamp()
      .setFooter({
        text: `Base de Datos Estructural`,
        iconURL: client.user?.displayAvatarURL(),
      });

    if (member) {
      const joinedTimestamp = Math.floor((member.joinedTimestamp ?? 0) / 1000);
      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild?.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`)
        .slice(0, 8);

      embed.addFields(
        {
          name: "🏷️ Código / Apodo",
          value: `\`${member.nickname ?? "Sin designar"}\``,
          inline: true,
        },
        {
          name: "🔰 Llegada a la Plantación",
          value: `<t:${joinedTimestamp}:D> (<t:${joinedTimestamp}:R>)`,
          inline: true,
        },
        {
          name: `🛡️ Conexiones de Rango (${member.roles.cache.size - 1})`,
          value: roles.length > 0 ? roles.join(" ") : "`Sin roles asignados`",
          inline: false,
        },
      );

      if (isSpecial) {
        embed.addFields({
          name: "🌸 Trato especial",
          value: `\`${specialTreatmentLabel()}\`\nSin cooldowns y acceso durante mantenimiento.`,
          inline: false,
        });
      }
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
