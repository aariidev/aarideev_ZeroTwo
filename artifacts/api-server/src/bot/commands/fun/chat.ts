import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  TextChannel,
} from "discord.js";
import { Command } from "../../types.js";
import {
  chatWithZeroTwo,
  clearUserHistory,
  getUserHistory,
  type ChatContext,
} from "../../../lib/gemini.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("💬 Abre un nexo de comunicación directo con ZeroTwo")
    .addSubcommand((sub) =>
      sub
        .setName("mensaje")
        .setDescription("Envía un mensaje a ZeroTwo")
        .addStringOption((opt) =>
          opt
            .setName("texto")
            .setDescription("Lo que quieres decirle a ZeroTwo")
            .setRequired(true)
            .setMaxLength(800),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Borra el historial de conversación con ZeroTwo"),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "reset") {
      clearUserHistory(interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: "ZeroTwo · Sistema de Comunicación",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          "💢 Hmm... Archivos borrados. ¿Empezamos de cero, parásito?\n\n*La unidad ZeroTwo ha limpiado el registro de comunicación.*",
        )
        .setFooter({ text: "El nexo ha sido reiniciado." })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const texto = interaction.options.getString("texto", true);

    await interaction.deferReply();

    // ── Build context ─────────────────────────────────────────────────────────
    const guild = interaction.guild;
    const channel = interaction.channel;
    const history = getUserHistory(interaction.user.id);

    const ctx: ChatContext = {
      userName: interaction.user.displayName,
      userHandle: interaction.user.username,
      userId: interaction.user.id,
      guildName: guild?.name ?? null,
      guildMemberCount: guild?.memberCount ?? null,
      channelName:
        channel && "name" in channel
          ? (channel as TextChannel).name
          : null,
      botUptimeMs: client.uptime ?? null,
      botGuildCount: client.guilds.cache.size,
      exchangeCount: Math.floor(history.length / 2),
      currentDateTime: new Date().toLocaleString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
      }),
    };

    try {
      const respuesta = await chatWithZeroTwo(interaction.user.id, texto, ctx);
      const newHistory = getUserHistory(interaction.user.id);
      const exchanges = Math.floor(newHistory.length / 2);

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: `${interaction.user.displayName} → ZeroTwo`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .addFields({
          name: "📡 Transmisión recibida",
          value: `\`\`\`${texto.length > 200 ? texto.slice(0, 197) + "..." : texto}\`\`\``,
        })
        .addFields({
          name: "🌸 Respuesta del Núcleo 002",
          value: respuesta,
        })
        .setFooter({
          text: [
            guild ? `📡 ${guild.name}` : "📨 MD",
            `💬 ${exchanges} intercambio${exchanges !== 1 ? "s" : ""}`,
            "/chat reset para limpiar",
          ].join("  ·  "),
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const isConfigError =
        err instanceof Error && err.message.includes("GEMINI_API_KEY");

      const embed = new EmbedBuilder()
        .setColor(0xef4444)
        .setAuthor({
          name: "ZeroTwo · Error de Sincronización",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          isConfigError
            ? "❌ **Nexo de comunicación no disponible.**\nEl núcleo no tiene acceso al sistema de IA. Contacta al administrador."
            : "❌ **Fallo en la transmisión, parásito.**\nAlgo interrumpió el enlace con mi núcleo. Inténtalo de nuevo en unos segundos.",
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
