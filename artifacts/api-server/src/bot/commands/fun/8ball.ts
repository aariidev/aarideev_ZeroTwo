import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const responses = [
  "Sí, definitivamente.",
  "Es cierto.",
  "Sin duda.",
  "Sí, en mi opinión.",
  "Puedes confiar en ello.",
  "Como yo lo veo, sí.",
  "Muy probablemente.",
  "Las perspectivas son buenas.",
  "Las señales apuntan a sí.",
  "Respuesta poco clara, intenta de nuevo.",
  "Pregunta de nuevo más tarde.",
  "Mejor no decirte ahora.",
  "No puedo predecirlo ahora.",
  "Concéntrate y pregunta de nuevo.",
  "No cuentes con ello.",
  "Mi respuesta es no.",
  "Mis fuentes dicen que no.",
  "Las perspectivas no son muy buenas.",
  "Muy dudoso.",
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("🎱 La bola 8 mágica responde tus preguntas")
    .addStringOption((opt) =>
      opt.setName("pregunta").setDescription("Tu pregunta").setRequired(true)
    ),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const question = interaction.options.getString("pregunta", true);
    const response = responses[Math.floor(Math.random() * responses.length)]!;

    const embed = new EmbedBuilder()
      .setColor(0x1a1a2e)
      .setTitle("🎱 Bola 8 Mágica")
      .addFields(
        { name: "Pregunta", value: question },
        { name: "Respuesta", value: response }
      )
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
