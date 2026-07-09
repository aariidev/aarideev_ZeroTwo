import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getLogChannelId,
  setLogChannelId,
  removeLogChannel,
} from "../../lib/modlog.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("cfglogs")
    .setDescription("📡 Configura el canal de logs de moderación del servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Define el canal donde se enviarán los logs de acción")
        .addChannelOption((opt) =>
          opt
            .setName("canal")
            .setDescription("Canal de destino para los logs")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Desactiva el envío de logs al canal configurado"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Muestra el canal de logs actualmente configurado"),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild?.id ?? "";

    if (sub === "set") {
      const channel = interaction.options.getChannel("canal", true);

      await setLogChannelId(guildId, channel.id);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff9f)
            .setAuthor({
              name: "Central de Logs // Zero Two",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTitle("📡 Canal de Logs Configurado")
            .setDescription(
              `Los registros de moderación ahora se enviarán a <#${channel.id}>.`,
            )
            .addFields(
              { name: "📌 Canal", value: `<#${channel.id}>`, inline: true },
              { name: "🆔 ID", value: `\`${channel.id}\``, inline: true },
              {
                name: "🛡️ Configurado por",
                value: `${interaction.user.tag}`,
                inline: true,
              },
            )
            .setFooter({
              text: "Eventos: ban · kick · warn · timeout · unban",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    if (sub === "disable") {
      const existing = await getLogChannelId(guildId);

      if (!existing) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff2d6b)
              .setDescription(
                "❌ No hay ningún canal de logs configurado para este servidor.",
              ),
          ],
          ephemeral: true,
        });
        return;
      }

      await removeLogChannel(guildId);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setAuthor({
              name: "Central de Logs // Zero Two",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTitle("🔕 Logs de Moderación Desactivados")
            .setDescription(
              "El canal de logs ha sido eliminado de la configuración.\n" +
                "Usa `/cfglogs set` para volver a activarlo.",
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    if (sub === "status") {
      const channelId = await getLogChannelId(guildId);

      if (!channelId) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff9900)
              .setAuthor({
                name: "Central de Logs // Zero Two",
                iconURL: client.user?.displayAvatarURL(),
              })
              .setTitle("📡 Estado del Canal de Logs")
              .setDescription(
                "⚠️ **Sin canal configurado.**\n" +
                  "Usa `/cfglogs set` para asignar un canal de destino.",
              )
              .setTimestamp(),
          ],
          ephemeral: true,
        });
        return;
      }

      const channel = interaction.guild?.channels.cache.get(channelId);
      const channelMention = channel ? `<#${channelId}>` : `\`${channelId}\` *(no encontrado)*`;

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff9f)
            .setAuthor({
              name: "Central de Logs // Zero Two",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTitle("📡 Estado del Canal de Logs")
            .addFields(
              { name: "✅ Canal Activo", value: channelMention, inline: true },
              { name: "🆔 ID", value: `\`${channelId}\``, inline: true },
            )
            .setFooter({
              text: "Eventos registrados: ban · kick · warn · timeout · unban",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  },
};

export default command;
