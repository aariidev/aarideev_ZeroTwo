import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import { assetImage } from "../../lib/helpAssets.js";

const RESPONSES = {
  positive: [
    "Sí, mi telemetría lo confirma con total certeza. ✨",
    "Absolutamente, las señales están alineadas a tu favor.",
    "Puedes apostar tu Franxx a que sí.",
    "Mis sensores indican un 98.7% de probabilidad afirmativa.",
  ],
  neutral: [
    "La respuesta está nublada por interferencias en la conexión. Inténtalo de nuevo.",
    "No puedo predecirlo ahora, mis niveles de energía están fluctuando.",
    "Concéntrate más y vuelve a interrogar a la terminal.",
  ],
  negative: [
    "Mi diagnóstico dice que no. Olvídalo. ❌",
    "Las posibilidades caen a cero. No cuentes con ello.",
    "Fuentes centrales indican un panorama completamente desalentador.",
    "No... y no me hagas repetirlo.",
  ],
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("🎱 Pregunta al núcleo — sí, no o misterio")
    .addStringOption((opt) =>
      opt
        .setName("pregunta")
        .setDescription("La incógnita que deseas proyectar")
        .setRequired(true),
    ),
  cooldown: 4,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const question = interaction.options.getString("pregunta", true);

    if (question.length < 5) {
      return interaction.reply({
        content:
          "❌ Tu pregunta es demasiado corta y carece de firma psíquica. Formula algo con más sustancia, parásito.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const quantumStability = Math.floor(Math.random() * 40) + 60;
    const categories = ["positive", "neutral", "negative"] as const;
    const randomCategory =
      categories[Math.floor(Math.random() * categories.length)]!;
    const pool = RESPONSES[randomCategory];
    const finalAnswer = pool[Math.floor(Math.random() * pool.length)]!;

    const img = assetImage("fun");
    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Núcleo de Predicción Psíquica // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🎱 Enlace de Conciencia Establecido")
      .addFields(
        {
          name: "❓ Interrogante Transmitido",
          value: `\`\`\`📥 ${question}\`\`\``,
        },
        { name: "🔮 Diagnóstico de la Unidad", value: `**${finalAnswer}**` },
        {
          name: "📊 Estabilidad del Nexo",
          value: `\`${quantumStability}% de precisión analítica\``,
          inline: true,
        },
        {
          name: "🧠 Estado Mental",
          value:
            randomCategory === "positive"
              ? "🎵 Alegre / Cooperativa"
              : randomCategory === "neutral"
                ? "💤 Indiferente"
                : "💢 Irritada",
          inline: true,
        },
      )
      .setThumbnail(client.user?.displayAvatarURL({ size: 128 }) ?? null)
      .setTimestamp();

    if (img.url) embed.setImage(img.url);

    await interaction.reply({
      embeds: [embed],
      files: img.file ? [img.file] : undefined,
    });
  },
};

export default command;
