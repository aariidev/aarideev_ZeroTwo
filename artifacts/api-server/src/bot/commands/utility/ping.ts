import {
  SlashCommandBuilder,
  EmbedBuilder,
  Client,
  ChatInputCommandInteraction,
  ColorResolvable,
} from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 Latencia del bot y del WebSocket en tiempo real"),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    
    const sent = await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff2d6b)
          .setDescription("```md\n# ESCANEANDO ENLACE KLAXOSAURIO...\n```"),
      ],
      fetchReply: true,
    });

    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    // Determinar calidad y color
    const getQuality = (ms: number) => {
      if (ms < 100) return { emoji: "🟢", text: "Óptimo", color: 0x00ff9d as ColorResolvable };
      if (ms < 200) return { emoji: "🟡", text: "Aceptable", color: 0xffcc00 as ColorResolvable };
      return { emoji: "🔴", text: "Elevado", color: 0xff2d6b as ColorResolvable };
    };

    const botQuality = getQuality(botLatency);
    const apiQuality = getQuality(apiLatency);

   
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const embed = new EmbedBuilder()
      .setColor(botQuality.color)
      .setAuthor({
        name: `Diagnóstico de Sincronización // Connect`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🏓 Latencia de Respuesta Establecida")
      .setDescription(
        "```md\n" +
          "# MÉTRICAS DE ENLACE KLAXOSAURIO\n" +
          `* Latencia del Bot     :: ${botLatency}ms  ${botQuality.emoji}\n` +
          `* Pulso de WebSocket   :: ${apiLatency}ms  ${apiQuality.emoji}\n` +
          `* Tiempo de Núcleo     :: ${uptimeStr}\n` +
          "```"
      )
      .addFields(
        {
          name: "Estado del Bot",
          value: `${botQuality.emoji} **${botQuality.text}**`,
          inline: true,
        },
        {
          name: "Estado de API",
          value: `${apiQuality.emoji} **${apiQuality.text}**`,
          inline: true,
        },
        {
          name: "Uptime",
          value: `\`${uptimeStr}\``,
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({
        text: `Estado del Núcleo: Operativo • ZeroTwo`,
        iconURL: client.user?.displayAvatarURL(),
      });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;