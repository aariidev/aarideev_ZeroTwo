import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../types.js";
import {
  countAutomodRules,
  installAutomodEverywhere,
  installAutomodPack,
  removeAutomodPack,
} from "../../lib/automod.js";

const PINK = 0xff2d6b;
const CYAN = 0x22d3ee;
const GREEN = 0x22c55e;
const AMBER = 0xf59e0b;

function isOwner(userId: string): boolean {
  return (process.env.OWNER_IDS ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription(
      "🛡️ AutoMod de Zero Two — reglas + progreso hacia la insignia de Discord",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("setup")
        .setDescription(
          "Instala el pack de reglas AutoMod en este servidor (máx. 6)",
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("status")
        .setDescription(
          "Cuenta reglas AutoMod (meta: 100 en total para la insignia de la app)",
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Quita solo las reglas creadas por Zero Two en este servidor"),
    )
    .addSubcommand((s) =>
      s
        .setName("sync-all")
        .setDescription(
          "[Owner] Instala el pack en todos los servidores donde el bot pueda",
        ),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({
        content: "❌ Solo el dev del bot puede usar esto.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "status") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { total, ours, byGuild } = await countAutomodRules(client);
      const target = 100;
      const pct = Math.min(100, Math.round((total / target) * 100));
      const barLen = 12;
      const filled = Math.round((pct / 100) * barLen);
      const bar =
        "█".repeat(filled) + "░".repeat(Math.max(0, barLen - filled));

      const top = byGuild
        .slice(0, 8)
        .map((g) => `• **${g.name}**: ${g.n}`)
        .join("\n");

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(total >= target ? GREEN : CYAN)
            .setAuthor({
              name: "Zero Two · AutoMod",
              iconURL: client.user?.displayAvatarURL() ?? undefined,
            })
            .setTitle("Progreso insignia AutoMod")
            .setDescription(
              [
                `Reglas totales (todas): **${total}** / **${target}**`,
                `Reglas Zero Two (\`ZT ·\`): **${ours}**`,
                `\`${bar}\` **${pct}%**`,
                "",
                total >= target
                  ? "✅ Meta alcanzada. La insignia **Uses AutoMod** debería aparecer en el perfil de la app (puede tardar en actualizarse)."
                  : `Faltan **${Math.max(0, target - total)}** reglas. Usa \`/automod setup\` en más servidores (máx. 6 por guild).`,
                top ? `\n**Por servidor:**\n${top}` : "",
              ].join("\n"),
            )
            .setFooter({
              text: "Insignia de la aplicación Discord · 100 reglas en total",
            })
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === "setup") {
      if (!interaction.guild) {
        await interaction.reply({
          content: "❌ Solo en servidores.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await installAutomodPack(interaction.guild);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(r.created > 0 ? GREEN : AMBER)
            .setTitle("AutoMod · Setup")
            .setDescription(
              [
                `Servidor: **${r.guildName}**`,
                `Creadas: **${r.created}**`,
                `Ya existían: **${r.skipped}**`,
                r.errors.length
                  ? `Avisos:\n${r.errors.map((e) => `• ${e}`).join("\n")}`
                  : "Sin errores.",
                "",
                "Reglas: anti-spam, menciones, invitaciones, estafas, insultos, contenido sexual (presets).",
                "Siguiente: `/automod status` para ver el total hacia la insignia.",
              ].join("\n"),
            ),
        ],
      });
      return;
    }

    if (sub === "remove") {
      if (!interaction.guild) {
        await interaction.reply({
          content: "❌ Solo en servidores.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await removeAutomodPack(interaction.guild);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setDescription(
              `🗑️ Eliminadas **${r.removed}** reglas Zero Two.` +
                (r.errors.length
                  ? `\n${r.errors.map((e) => `• ${e}`).join("\n")}`
                  : ""),
            ),
        ],
      });
      return;
    }

    if (sub === "sync-all") {
      if (!isOwner(interaction.user.id)) {
        await interaction.reply({
          content: "❌ Solo el owner del bot puede usar esto.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const results = await installAutomodEverywhere(client);
      const created = results.reduce((a, r) => a + r.created, 0);
      const skipped = results.reduce((a, r) => a + r.skipped, 0);
      const failed = results.filter((r) => r.errors.length).length;
      const { total } = await countAutomodRules(client);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setTitle("AutoMod · Sync global")
            .setDescription(
              [
                `Servidores procesados: **${results.length}**`,
                `Reglas nuevas: **${created}**`,
                `Omitidas (ya existían): **${skipped}**`,
                `Guilds con error: **${failed}**`,
                "",
                `Total de reglas ahora: **${total}** / 100`,
              ].join("\n"),
            ),
        ],
      });
      return;
    }
  },
};

export default command;
