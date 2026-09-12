import {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  type StringSelectMenuInteraction,
  type ChatInputCommandInteraction,
  ComponentType,
} from "discord.js";
import { execSync } from "child_process";
import { logger } from "../../../lib/logger.js";
import { chatWithZeroTwo } from "../../../lib/gemini.js";

interface Change {
  file: string;
  additions: number;
  deletions: number;
  changes: number;
}

interface ChangelogAnalysis {
  summary: string;
  categories: {
    [key: string]: string[];
  };
  impact: string;
  recommendations: string[];
}

// Cache para evitar llamadas repetidas a Gemini en la misma sesión
const changelogCache = new Map<string, { analysis: ChangelogAnalysis; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

async function analyzeChangesWithGemini(gitDiff: string, userId: string): Promise<ChangelogAnalysis> {
  // Verificar cache
  const cacheKey = "latest_changelog";
  const cached = changelogCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.analysis;
  }

  const prompt = `Analiza los siguientes cambios de git diff y proporciona un resumen estructurado en formato JSON.

## Git Diff Stats:
${gitDiff}

Por favor, responde SOLO con un objeto JSON válido (sin markdown, sin explicación adicional) con esta estructura exacta:
{
  "summary": "Resumen general de los cambios en 1-2 líneas",
  "categories": {
    "🚀 Nuevas Características": ["lista", "de", "cambios"],
    "🐛 Correcciones": ["lista", "de", "cambios"],
    "♻️ Refactorización": ["lista", "de", "cambios"],
    "📚 Documentación": ["lista", "de", "cambios"],
    "🔧 Mantenimiento": ["lista", "de", "cambios"]
  },
  "impact": "Descripción del impacto de estos cambios",
  "recommendations": ["recomendación 1", "recomendación 2"]
}

Sé específico y conciso. Enfócate en el impacto real para los usuarios.`;

  try {
    const response = await chatWithZeroTwo(userId, prompt, {
      userName: "Sistema",
      userHandle: "system",
      userId: userId,
      guildName: null,
      guildMemberCount: null,
      channelName: "changelog-analysis",
      botUptimeMs: null,
      botGuildCount: 0,
      exchangeCount: 1,
      currentDateTime: new Date().toLocaleString("es-ES"),
      accessTier: "public",
    });
    
    // Extraer JSON de la respuesta
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const analysis: ChangelogAnalysis = JSON.parse(jsonMatch[0]);
    
    // Cachear resultado
    changelogCache.set(cacheKey, {
      analysis,
      timestamp: Date.now(),
    });

    return analysis;
  } catch (err) {
    logger.error({ err }, "Error analizando cambios con Gemini");
    
    // Fallback analysis si Gemini falla
    return {
      summary: "Cambios detectados en el sistema",
      categories: {
        "🔧 Cambios": ["Actualizaciones en el código"],
      },
      impact: "El sistema ha sido actualizado",
      recommendations: ["Revisar cambios en git"],
    };
  }
}

async function getGitChanges(): Promise<string> {
  try {
    // Obtener últimos cambios
    const stats = execSync("git diff --stat", { encoding: "utf-8" });
    return stats;
  } catch {
    return "No se pudieron obtener los cambios de git";
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName("changelog")
    .setDescription("Ver el changelog y cambios recientes del bot con análisis de Gemini")
    .addStringOption((option) =>
      option
        .setName("tipo")
        .setDescription("Tipo de changelog a visualizar")
        .addChoices(
          { name: "Últimos cambios", value: "latest" },
          { name: "Análisis de Gemini", value: "analysis" },
          { name: "Resumen completo", value: "full" }
        )
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const changeType = interaction.options.getString("tipo") || "full";

    try {
      // Obtener cambios de git
      const gitDiff = await getGitChanges();

      if (changeType === "latest") {
        // Mostrar solo los cambios crudos
        const embed = new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setAuthor({
            name: "📋 Changelog · Últimos Cambios",
            iconURL: interaction.client.user?.displayAvatarURL(),
          })
          .setDescription("```\n" + gitDiff.slice(0, 2000) + "\n```")
          .setFooter({ text: "Ejecuta con tipo: analysis para ver análisis de Gemini" })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Analizar con Gemini
      const analysis = await analyzeChangesWithGemini(gitDiff, interaction.user.id);

      // Crear opciones del select menu
      const categories = Object.entries(analysis.categories);
      const selectOptions = categories
        .filter(([, items]) => items.length > 0)
        .map(([category, items]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(category)
            .setValue(category)
            .setDescription(`${items.length} cambio(s) en esta categoría`)
            .setEmoji(category.split(" ")[0])
        );

      // Si no hay opciones, agregar una por defecto
      if (selectOptions.length === 0) {
        selectOptions.push(
          new StringSelectMenuOptionBuilder()
            .setLabel("📚 Resumen")
            .setValue("summary")
            .setDescription("Ver resumen general")
            .setEmoji("📚")
        );
      }

      // Crear select menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("changelog_select")
        .setPlaceholder("Selecciona una categoría para ver detalles...")
        .addOptions(selectOptions);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      // Embed principal
      const mainEmbed = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setAuthor({
          name: "🌸 Zero Two · Changelog",
          iconURL: interaction.client.user?.displayAvatarURL(),
        })
        .setTitle("✨ Cambios Analizados por Gemini")
        .setDescription(analysis.summary)
        .addFields(
          {
            name: "📊 Impacto",
            value: analysis.impact,
            inline: false,
          },
          {
            name: "💡 Recomendaciones",
            value: analysis.recommendations.map((r) => `• ${r}`).join("\n") || "Sin recomendaciones",
            inline: false,
          }
        )
        .setThumbnail(interaction.client.user?.displayAvatarURL({ size: 256 }) ?? undefined)
        .setFooter({
          text: "Selecciona una categoría arriba para ver detalles",
          iconURL: interaction.client.user?.displayAvatarURL() ?? undefined,
        })
        .setTimestamp();

      const response = await interaction.editReply({
        embeds: [mainEmbed],
        components: [row],
      });

      // Listener para el select menu
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 5 * 60 * 1000, // 5 minutos
      });

      collector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
        const selectedCategory = selectInteraction.values[0];

        // Buscar la categoría seleccionada
        const categoryItems = analysis.categories[selectedCategory] || [];

        const detailEmbed = new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setAuthor({
            name: `${selectedCategory}`,
            iconURL: interaction.client.user?.displayAvatarURL(),
          })
          .setDescription(
            categoryItems.length > 0
              ? categoryItems.map((item, i) => `${i + 1}. ${item}`).join("\n")
              : "No hay cambios en esta categoría"
          )
          .setFooter({
            text: `Total: ${categoryItems.length} cambio(s)`,
            iconURL: interaction.client.user?.displayAvatarURL() ?? undefined,
          })
          .setTimestamp();

        await selectInteraction.update({
          embeds: [detailEmbed],
          components: [row],
        });
      });

      collector.on("end", async () => {
        // Deshabilitar select menu cuando expire
        const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          selectMenu.setDisabled(true)
        );

        try {
          await response.edit({ components: [disabledRow] });
        } catch {
          // Ignorar si el mensaje fue borrado
        }
      });
    } catch (err) {
      logger.error({ err }, "Error en comando changelog");

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ Error al generar changelog")
        .setDescription("No se pudo analizar los cambios. Intenta más tarde.")
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
