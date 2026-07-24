import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const gigs = [
  "Extrae datos de un corpo en Kabuki. Paga 8k eddies. Riesgo medio. ¿Delta o te quedas flatline?",
  "Asesina a un fixer traidor en Watson. 12k eddies. Lleva chrome pesado, choom.",
  "Roba un shard de netrunner en Japantown. 5k eddies. Simple pero rápido.",
  "Protege un convoy de chrome en Pacifica. 15k eddies. Cyberpsychos sueltos.",
  "Hackea un vending machine de Militech. 3k eddies. Fácil para un netrunner como tú.",
  "Elimina a un gonk de Scavengers en Santo Domingo. 7k eddies. Sin testigos.",
  "Recupera un prototipo de cyberware en Northside. 20k eddies. Alta seguridad.",
  "Entrega un paquete caliente a un cliente en Heywood. 4k eddies. No preguntes qué es."
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("gig")
    .setDescription("🌃 Consigue un gig en Night City"),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const gig = gigs[Math.floor(Math.random() * gigs.length)];
    const embed = new EmbedBuilder()
      .setColor(0xff2e63)
      .setAuthor({ name: "Night City Gigs · ZeroTwo", iconURL: client.user?.displayAvatarURL() })
      .setTitle("Gig Disponible, Choom")
      .setDescription(gig)
      .setFooter({ text: "Delta rápido o te la pierdes | v3.0.0 Edgerunners", iconURL: client.user?.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;