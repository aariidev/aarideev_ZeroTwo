import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  TextChannel,
} from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription(
      "🐢 Modula el flujo temporal de datos limitando la velocidad de envío",
    )
    .addIntegerOption((opt) =>
      opt
        .setName("segundos")
        .setDescription("Tiempo de espera (0 para apagar, máx 21600)")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("global")
        .setDescription("¿Sincronizar este intervalo en toda la sección?"),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const seconds = interaction.options.getInteger("segundos", true);
    const isGlobal = interaction.options.getBoolean("global") ?? false;
    const currentChannel = interaction.channel as TextChannel;

    if (!currentChannel?.isTextBased() || currentChannel.isDMBased()) {
      return interaction.reply({
        content: "❌ Esta función requiere terminales de texto de servidor.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const targets: TextChannel[] = [];
    if (isGlobal && currentChannel.parent) {
      currentChannel.parent.children.cache
        .filter((c) => c.isTextBased() && !c.isThread())
        .forEach((c) => targets.push(c as TextChannel));
    } else {
      targets.push(currentChannel);
    }

    for (const ch of targets) {
      await ch
        .setRateLimitPerUser(
          seconds,
          `Slowmode: ${seconds}s | Mod: ${interaction.user.tag}`,
        )
        .catch(() => null);
    }

    const disabled = seconds === 0;
    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Filtro Regulador de Flujo // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(
        disabled
          ? "🐢 Sincronización Temporal Normalizada"
          : "🐢 Dilatación Temporal Activada",
      )
      .addFields(
        {
          name: "📍 Sector",
          value: isGlobal
            ? `\`Categoría Completa (${targets.length} canales)\``
            : `<#${currentChannel.id}>`,
          inline: true,
        },
        {
          name: "⏱️ Intervalo Exigido",
          value: disabled ? "`Sin retraso`" : `\`${seconds} segundos\``,
          inline: true,
        },
        {
          name: "🛡️ Supervisor",
          value: `${interaction.user.tag}`,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
