import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription(
      "🪙 Ejecuta un lanzamiento cinético de moneda en tiempo real",
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const result = Math.random() < 0.5 ? "Cara" : "Cruz";

    const airFlips = Math.floor(Math.random() * 8) + 4;
    const forceNewtons = (Math.random() * 5 + 2).toFixed(2);
    const faceVisual =
      result === "Cara"
        ? "🟡 [ CARA - EMBLEMA CORPORATIVO ]"
        : "⚪ [ CRUZ - REVERSO DE CONTENCIÓN ]";

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Dinámica Vectorial // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🪙 Resultado del Volado Cinético")
      .setThumbnail(
        result === "Cara"
          ? "https://i.imgur.com/H6z0vYn.png"
          : "https://i.imgur.com/V9rPsnH.png",
      )
      .setDescription(
        `La moneda ha sido eyectada con una energía de \`${forceNewtons} N\` ejecutando \`${airFlips}\` rotaciones completas en el eje vertical antes de colisionar con el suelo.\n\n` +
          `\`\`\`arm\n== Resultado Final ==\n${faceVisual}\n\`\`\``,
      )
      .addFields({
        name: "📊 Estado de la Sesión",
        value: `Sujeto evaluado: <@${interaction.user.id}>\nSuerte del vector: ${result === "Cara" ? "🍀 Favorable" : "⚠️ Desfavorable"}`,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
