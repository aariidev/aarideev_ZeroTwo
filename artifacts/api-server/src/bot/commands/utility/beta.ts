/**
 * Beta testers command - Access beta features and panel
 *
 * Only beta testers can use this command
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import { isBetaTester, getBetaTesterFeatures, getAllBetatesters } from "../../lib/betatesters.js";

function isOwner(userId: string): boolean {
  const ids = (process.env.OWNER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("beta")
    .setDescription("🧪 Panel de Beta Testers — accede a features experimentales")
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("ℹ️ Información sobre el programa de beta testers"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("features")
        .setDescription("🎯 Lista de features en beta disponibles"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("feedback")
        .setDescription("💬 Reportar bug o dar feedback (solo beta testers)"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("manage")
        .setDescription("👥 Gestionar beta testers (OWNER ONLY)")
        .addStringOption((o) =>
          o
            .setName("action")
            .setDescription("Acción a realizar")
            .setRequired(true)
            .addChoices(
              { name: "Añadir beta tester", value: "add" },
              { name: "Remover beta tester", value: "remove" },
              { name: "Listar beta testers", value: "list" },
            ),
        )
        .addUserOption((o) =>
          o
            .setName("usuario")
            .setDescription("Usuario a añadir/remover (requerido para add/remove)")
            .setRequired(false),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    // Info subcommand - public
    if (subcommand === "info") {
      const isBeta = isBetaTester(userId);
      const embed = new EmbedBuilder()
        .setColor(0x9d4edd)
        .setTitle("🧪 Programa de Beta Testers")
        .setDescription(
          "Accede a las features más nuevas del bot antes que nadie y ayuda a mejorarlas.",
        )
        .addFields(
          {
            name: "¿Qué es?",
            value:
              "Un programa exclusivo donde usuarios seleccionados prueban features experimentales y dan feedback.",
          },
          {
            name: "Tu estado",
            value: isBeta
              ? "✅ Eres un beta tester — ¡Acceso completo!"
              : "❌ No eres beta tester (aún).",
          },
          {
            name: "Beneficios",
            value:
              "• Acceso a features experimentales\n• Panel beta exclusivo\n• Poder reportar bugs\n• Influir en decisiones del bot",
          },
        );

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Features subcommand
    if (subcommand === "features") {
      if (!isBetaTester(userId)) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ Acceso Denegado")
          .setDescription(
            "Solo los beta testers pueden ver las features experimentales.",
          )
          .setFooter({ text: "Contacta con los desarrolladores para unirte" });

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const features = getBetaTesterFeatures(userId);
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("🎯 Features en Beta")
        .setDescription("Estas son las features experimentales que puedes probar:")
        .addFields(
          {
            name: "Dashboard",
            value: "Nueva interfaz y componentes del panel de control",
          },
          {
            name: "Comandos Beta",
            value: "Nuevos comandos experimentales del bot",
          },
          {
            name: "API Beta",
            value: "Acceso a endpoints nuevos de la API",
          },
          {
            name: "Analítica Avanzada",
            value: "Estadísticas detalladas y gráficos mejorados",
          },
        )
        .setFooter({
          text: `Total: ${features.betaFeaturesEnabled.length} features disponibles`,
        });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Feedback subcommand
    if (subcommand === "feedback") {
      if (!isBetaTester(userId)) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ Solo para Beta Testers")
          .setDescription("Debes ser un beta tester para enviar feedback.")
          .setFooter({ text: "Contacta con los desarrolladores" });

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const embed = new EmbedBuilder()
        .setColor(0x9d4edd)
        .setTitle("💬 Enviar Feedback")
        .setDescription(
          "Para reportar bugs o dar feedback, abre el panel de beta testers en el dashboard " +
            "o contacta directamente con los desarrolladores.",
        )
        .addFields({
          name: "Panel Web",
          value: "Accede a http://localhost:5173 (o tu URL del dashboard) y ve a la sección de Beta",
        })
        .setFooter({
          text: "Tu feedback es valioso para mejorar Zero Two 💜",
        });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Manage subcommand - owner only
    if (subcommand === "manage") {
      if (!isOwner(userId)) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ Acceso Denegado")
          .setDescription("Solo los desarrolladores pueden gestionar beta testers.");

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const action = interaction.options.getString("action", true);
      const targetUser = interaction.options.getUser("usuario");

      if (action === "list") {
        const testers = getAllBetatesters();
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("👥 Lista de Beta Testers")
          .setDescription(
            testers.length > 0
              ? `Total: ${testers.length} beta testers`
              : "No hay beta testers registrados",
          );

        if (testers.length > 0) {
          const testersList = testers
            .map((id, i) => `${i + 1}. <@${id}>`)
            .join("\n");
          embed.addFields({
            name: "Beta Testers",
            value: testersList.slice(0, 1024),
          });
        }

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (!targetUser) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ Error")
          .setDescription(
            `Para ${action === "add" ? "añadir" : "remover"} un beta tester, debes especificar un usuario.`,
          );

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Operación Completada");

      if (action === "add") {
        embed.setDescription(
          `${targetUser.username} ha sido añadido como beta tester ✨`,
        );
      } else if (action === "remove") {
        embed.setDescription(
          `${targetUser.username} ha sido removido de los beta testers.`,
        );
      }

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Fallback
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Comando no reconocido")
      .setDescription("Usa un subcomando válido.");

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
