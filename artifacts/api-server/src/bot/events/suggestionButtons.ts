/**
 * Buttons on suggestion messages: approve / reject / implemented.
 */
import {
  PermissionFlagsBits,
  type ButtonInteraction,
  type Client,
  type Interaction,
} from "discord.js";
import { reviewSuggestion, type SuggestionStatus } from "../lib/suggestions.js";
import { logger } from "../../lib/logger.js";

function mapAction(action: string): SuggestionStatus | null {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  if (action === "done") return "implemented";
  return null;
}

export async function handleSuggestionButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith("sug:")) return false;

  const parts = interaction.customId.split(":");
  // sug:approve:123
  const action = parts[1];
  const id = Number(parts[2]);
  const status = mapAction(action ?? "");
  if (!status || !Number.isFinite(id)) return false;

  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Solo en servidores.",
      ephemeral: true,
    });
    return true;
  }

  const member = interaction.member;
  const perms =
    member && "permissions" in member ? member.permissions : null;
  const can =
    typeof perms !== "string" &&
    perms?.has?.(PermissionFlagsBits.ManageMessages);

  if (!can) {
    await interaction.reply({
      content: "❌ Necesitas **Gestionar mensajes** para moderar sugerencias.",
      ephemeral: true,
    });
    return true;
  }

  await interaction.deferReply({ ephemeral: true });
  const result = await reviewSuggestion({
    id,
    guildId: interaction.guild.id,
    status,
    reviewerId: interaction.user.id,
    client: interaction.client,
  });

  if (!result.ok) {
    await interaction.editReply({ content: `❌ ${result.reason}` });
    return true;
  }

  await interaction.editReply({
    content: `✅ Sugerencia **#${id}** → **${status}**.`,
  });
  return true;
}

export function registerSuggestionButtons(client: Client): void {
  client.on("interactionCreate", (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("sug:")) return;
    void handleSuggestionButton(interaction).catch((err) =>
      logger.warn({ err }, "suggestionButtons"),
    );
  });
}
