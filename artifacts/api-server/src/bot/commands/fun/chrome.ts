import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";

const chromes = [
  "Kiroshi Optics MK.3 — Visión térmica + zoom 8x + threat detection. 45k eddies. Riesgo: ceguera temporal si te hackean el optic.",
  "Mantis Blades (custom) — Cuchillas retráctiles de titanio con vibración. 62k eddies. Preem para close combat, choom.",
  "Gorilla Arms MK.2 — Fuerza bruta + puñetazo cargado. 38k eddies. Ideal para romper puertas y gonks.",
  "Sandevistan MK.4 — Time dilation 3.2s. 85k eddies. El clásico de los edgerunners de verdad.",
  "Berserk Implant — Modo furia total + resistencia al dolor. 55k eddies. Alto riesgo de cyberpsychosis.",
  "Monowire (hidden) — Hilo de monoafilamento de 10m. 71k eddies. Silencioso y letal.",
  "Subdermal Armor — Placas de titanio bajo la piel. 29k eddies. +40% resistencia balística.",
  "Neural Link MK.5 — Hackeo rápido + ICE mejorado. 67k eddies. Para netrunners de élite."
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("chrome")
    .setDescription("Info o upgrade de cyberware estilo Edgerunners"),
  cooldown: 8,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const chrome = chromes[Math.floor(Math.random() * chromes.length)];
    const embed = new EmbedBuilder()
      .setColor(0xff2e63)
      .setAuthor({ name: "Night City Chrome · ZeroTwo", iconURL: client.user?.displayAvatarURL() })
      .setTitle("Chrome Disponible, Choom")
      .setDescription(chrome)
      .setFooter({ text: "Instálatelo o sigue siendo un gonk | v3.0.0 Edgerunners", iconURL: client.user?.displayAvatarURL() })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;