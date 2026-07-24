/**
 * /reglas — reglas del servidor en español (plantilla Zero Two).
 * /rules  — misma plantilla en inglés.
 *
 * Opcional: canal + ephemeral false para publicar y fijar.
 */
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  type TextChannel,
} from "discord.js";
import { Command } from "../../types.js";
import { buildRulesEmbed, rulesLinkRow } from "../../lib/serverRules.js";

function buildData(name: "reglas" | "rules", description: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addChannelOption((o) =>
      o
        .setName(name === "rules" ? "channel" : "canal")
        .setDescription(
          name === "rules"
            ? "Post rules publicly in this channel (staff)"
            : "Publicar las reglas en este canal (staff)",
        )
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false),
    ) as SlashCommandBuilder;
}

async function executeRules(
  interaction: ChatInputCommandInteraction,
  client: Client,
  lang: "es" | "en",
): Promise<void> {
  const channelOpt =
    interaction.options.getChannel("canal") ??
    interaction.options.getChannel("channel");
  const guildName = interaction.guild?.name;
  const embed = buildRulesEmbed(client, lang, guildName);
  const row = rulesLinkRow(lang);

  // Public post to a channel (requires Manage Messages / Manage Guild)
  if (channelOpt) {
    const canPost =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (!canPost) {
      await interaction.reply({
        content:
          lang === "en"
            ? "❌ You need **Manage Messages** to post rules in a channel."
            : "❌ Necesitas **Gestionar mensajes** para publicar las reglas en un canal.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const ch = await client.channels.fetch(channelOpt.id).catch(() => null);
    if (!ch || !ch.isTextBased() || ch.isDMBased()) {
      await interaction.reply({
        content:
          lang === "en"
            ? "❌ Invalid text channel."
            : "❌ Canal de texto inválido.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await (ch as TextChannel).send({
      embeds: [embed],
      components: [row],
    });

    await interaction.reply({
      content:
        lang === "en"
          ? `✅ Rules posted in ${ch}.`
          : `✅ Reglas publicadas en ${ch}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    embeds: [embed],
    components: [row],
  });
}

const reglasCmd: Command = {
  data: buildData("reglas", "📖 Muestra las reglas generales del servidor (ES)"),
  cooldown: 8,
  async execute(interaction, client) {
    await executeRules(interaction, client, "es");
  },
};

const rulesCmd: Command = {
  data: buildData("rules", "📖 Show the general server rules (EN)"),
  cooldown: 8,
  async execute(interaction, client) {
    await executeRules(interaction, client, "en");
  },
};

export default reglasCmd;
export { rulesCmd };
