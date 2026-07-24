import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const outcomes = [
  "Estable. Tu chrome está bajo control. +5 humanity. Sigue así, choom.",
  "Alto riesgo. Sientes que el metal te habla. -12 humanity. Descansa o te flatlineas.",
  "Cyberpsycho episode inminente. Visión roja, manos temblando. Corre a un ripperdoc YA.",
  "Totalmente estable. Eres un edgerunner de verdad. +8 humanity. Preem.",
  "Gonk moment. Olvidaste tu medicación anti-psycho. -20 humanity. No salgas de casa hoy.",
  "Perfect sync con tu chrome. Eres una máquina. +15 humanity. Legend status.",
  "Warning: ICE cracking. Tu Sandevistan quiere más. Baja la dosis o delta.",
  "Full cyberpsycho. Atacas a tu propio fixer. Busca ayuda antes de que sea tarde, delta."
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("psycho")
    .setDescription("💉 Test de cyberpsychosis estilo Edgerunners"),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    const embed = new EmbedBuilder()
      .setColor(0xff2e63)
      .setAuthor({ name: "Cyberpsycho Check · ZeroTwo", iconURL: client.user?.displayAvatarURL() })
      .setTitle("Resultado del Test, Choom")
      .setDescription(outcome)
      .setFooter({ text: "Controla tu chrome o te controla él | v3.0.0 Edgerunners", iconURL: client.user?.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;