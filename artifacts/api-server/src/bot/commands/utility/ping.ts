import {
  SlashCommandBuilder,
  EmbedBuilder,
  Client,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription(
      "🏓 Analiza la tasa de respuesta y sincronización de código",
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const apiPing = Math.round(client.ws.ping);
    const botPing = Date.now() - interaction.createdTimestamp;

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: `Diagnóstico de Sincronización // Connect`,
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🏓 Latencia de Respuesta Establecida")
      .setDescription(
        `\`\`\`md\n` +
          `# MÉTRICAS DE ENLACE KLAXOSAURIO\n` +
          `* Latencia del Bot  :: ${botPing}ms\n` +
          `* Pulso de WebSocket :: ${apiPing}ms\n` +
          `\`\`\``,
      )
      .setTimestamp()
      .setFooter({
        text: `Estado del Núcleo: Operativo`,
        iconURL: client.user?.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
