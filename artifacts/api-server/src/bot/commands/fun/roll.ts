import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import { assetImage } from "../../lib/helpAssets.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription(
      "🎲 Lanza un dado cuántico de alta precisión con modificadores",
    )
    .addIntegerOption((opt) =>
      opt
        .setName("caras")
        .setDescription("Caras del dado (Default: 6)")
        .setMinValue(2)
        .setMaxValue(10000),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("modificador")
        .setDescription("Suma o resta un valor fijo al resultado final"),
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sides = interaction.options.getInteger("caras") ?? 6;
    const modifier = interaction.options.getInteger("modificador") ?? 0;

    const rawResult = Math.floor(Math.random() * sides) + 1;
    const finalResult = rawResult + modifier;

    let tier = "🎲 Lanzamiento Estándar";
    let comment = "Un resultado promedio. Ni grandioso, ni patético.";
    let color = 0xff2d6b;

    if (rawResult === sides) {
      tier = "🔥 ¡ÉXITO CRÍTICO PERFECTO! 🔥";
      comment =
        "¡Increíble! Has alcanzado la sincronización máxima del Franxx. ¡Directo al objetivo!";
      color = 0xffd700;
    } else if (rawResult === 1) {
      tier = "💀 PIFIA CATASTRÓFICA 💀";
      comment =
        "Qué rendimiento tan lamentable... ¿Seguro de que estás calificado para pilotar?";
      color = 0x3a0007;
    } else if (finalResult >= sides * 0.75) {
      tier = "⚡ Rendimiento Sobresaliente";
      comment = "Buen trabajo, estás demostrando de qué madera estás hecho.";
    }

    const img = assetImage("fun");
    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: "Módulo Probabilístico Estocástico // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(tier)
      .setDescription(
        `\`\`\`md\n* Dado Lanzado :: d${sides}\n* Valor Base    :: ${rawResult}\n* Modificador   :: ${modifier >= 0 ? `+${modifier}` : modifier}\n* Total Neto    :: ${finalResult}\n\`\`\``,
      )
      .addFields({ name: "💬 Comentario de 02", value: `*"${comment}"*` })
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
