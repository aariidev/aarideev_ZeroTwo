/**
 * /automod — pack de reglas AutoMod de Zero Two.
 *
 * setup / status / remove / list → ManageGuild (este servidor)
 * sync-all / global             → solo OWNER_IDS
 */
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
  getGuildAutomodSnapshot,
  automodPackNames,
  AUTOMOD_PREFIX,
} from "../../lib/automod.js";
import { BOT_VERSION } from "../../lib/version.js";

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

function bar(pct: number, len = 12): string {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * len);
  return "█".repeat(filled) + "░".repeat(Math.max(0, len - filled));
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("🛡️ AutoMod Zero Two — pack, estado y reglas")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("setup")
        .setDescription("📥 Instala el pack Zero Two (máx. 6 reglas)"),
    )
    .addSubcommand((s) =>
      s
        .setName("status")
        .setDescription("📊 Estado del pack en este servidor"),
    )
    .addSubcommand((s) =>
      s
        .setName("list")
        .setDescription("📋 Lista las reglas AutoMod activas"),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("🗑️ Quita solo reglas ZT | de Zero Two"),
    )
    .addSubcommand((s) =>
      s
        .setName("sync-all")
        .setDescription("🌍 [Owner] Instala el pack en todos los guilds"),
    )
    .addSubcommand((s) =>
      s
        .setName("global")
        .setDescription("🏅 [Owner] Progreso insignia Uses AutoMod"),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sub = interaction.options.getSubcommand();
    const owner = isOwner(interaction.user.id);
    const botIcon = client.user?.displayAvatarURL({ size: 64 });

    // Owner-only global ops
    if ((sub === "sync-all" || sub === "global") && !owner) {
      await interaction.reply({
        content:
          "❌ `sync-all` y `global` son exclusivos del owner del bot (`OWNER_IDS`).",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Guild required for local ops
    if (
      (sub === "setup" ||
        sub === "status" ||
        sub === "list" ||
        sub === "remove") &&
      !interaction.guild
    ) {
      await interaction.reply({
        content: "❌ Este subcomando solo funciona dentro de un servidor.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // ── status (local + optional global tip) ────────────────────────────────
    if (sub === "status") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const guild = interaction.guild!;
      const local = await getGuildAutomodSnapshot(guild);
      const pack = automodPackNames();
      const installed = pack.filter((n) =>
        local.rules.some((r) => r.name === n || r.name.includes(n.replace(AUTOMOD_PREFIX, ""))),
      ).length;

      const embed = new EmbedBuilder()
        .setColor(local.ours > 0 ? GREEN : AMBER)
        .setAuthor({ name: "Zero Two · AutoMod", iconURL: botIcon })
        .setTitle(`🛡️ Estado · ${local.guildName}`)
        .setDescription(
          local.canManage
            ? "El bot puede gestionar AutoMod en este servidor."
            : "⚠️ Al bot le falta **Gestionar servidor** — no puede leer/crear reglas aquí.",
        )
        .addFields(
          {
            name: "📋 Reglas en este guild",
            value: `\`${local.total}\` / 6 máx. Discord`,
            inline: true,
          },
          {
            name: "🌸 De Zero Two",
            value: `\`${local.ours}\``,
            inline: true,
          },
          {
            name: "✅ Activas",
            value: `\`${local.enabled}\``,
            inline: true,
          },
          {
            name: "📦 Pack Zero Two",
            value: `\`${installed}\` / \`${pack.length}\` componentes del pack\n\`${bar(Math.round((installed / pack.length) * 100))}\``,
            inline: false,
          },
          {
            name: "🧩 Qué instala el pack",
            value: pack.map((n) => `• \`${n}\``).join("\n"),
            inline: false,
          },
        )
        .setFooter({
          text: `Zero Two ${BOT_VERSION} · /automod setup · /automod list`,
        })
        .setTimestamp();

      if (owner) {
        try {
          const { total, ours } = await countAutomodRules(client);
          const target = 100;
          const pct = Math.min(100, Math.round((total / target) * 100));
          embed.addFields({
            name: "🏅 Meta global (owner)",
            value: [
              `Reglas en todos los guilds: **${total}** / **${target}**`,
              `De Zero Two: **${ours}**`,
              `\`${bar(pct)}\` **${pct}%**`,
              total >= target
                ? "✅ Meta insignia alcanzada (puede tardar en verse en el perfil)."
                : `Faltan **${target - total}** · usa \`/automod sync-all\` o setup en más servers.`,
            ].join("\n"),
            inline: false,
          });
        } catch {
          /* ignore */
        }
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ── list ────────────────────────────────────────────────────────────────
    if (sub === "list") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const local = await getGuildAutomodSnapshot(interaction.guild!);

      if (!local.canManage) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(PINK)
              .setTitle("🚫 Sin permiso")
              .setDescription(
                "El bot necesita **Gestionar servidor** para listar reglas AutoMod.",
              ),
          ],
        });
        return;
      }

      const lines =
        local.rules.length === 0
          ? "_No hay reglas AutoMod en este servidor._"
          : local.rules
              .map((r) => {
                const mark = r.enabled ? "🟢" : "⚪";
                const tag = r.ours ? " · ZT" : "";
                return `${mark} **${r.name}**${tag}\n└ \`${r.trigger}\` · \`${r.id}\``;
              })
              .join("\n");

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(CYAN)
            .setAuthor({ name: "Zero Two · AutoMod list", iconURL: botIcon })
            .setTitle(`📋 Reglas · ${local.guildName}`)
            .setDescription(lines.slice(0, 4000))
            .setFooter({
              text: `${local.total} reglas · ${local.ours} de Zero Two · ${local.enabled} activas`,
            })
            .setTimestamp(),
        ],
      });
      return;
    }

    // ── setup ───────────────────────────────────────────────────────────────
    if (sub === "setup") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await installAutomodPack(interaction.guild!);
      const ok = r.created > 0 || (r.skipped > 0 && r.errors.length === 0);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(r.created > 0 ? GREEN : r.errors.length ? PINK : AMBER)
            .setAuthor({ name: "Zero Two · AutoMod setup", iconURL: botIcon })
            .setTitle(ok ? "✅ Pack aplicado" : "⚠️ Setup con avisos")
            .setDescription(
              [
                `Servidor: **${r.guildName}**`,
                "",
                `🆕 Creadas: **${r.created}**`,
                `⏭️ Ya existían / límite: **${r.skipped}**`,
                r.errors.length
                  ? `\n**Avisos:**\n${r.errors.map((e) => `• ${e}`).join("\n")}`
                  : "\nSin errores de API.",
                "",
                "**Cobertura del pack:**",
                "• Anti-spam",
                "• Menciones masivas (límite 5)",
                "• Invitaciones Discord",
                "• Estafas / nitro falso",
                "• Presets Discord (insultos, sexual, slurs)",
                "• Links sospechosos (acortadores, grabify…)",
                "",
                "Siguiente: `/automod list` o `/automod status`.",
              ].join("\n"),
            )
            .setFooter({ text: `Prefijo de reglas: ${AUTOMOD_PREFIX}` })
            .setTimestamp(),
        ],
      });
      return;
    }

    // ── remove ──────────────────────────────────────────────────────────────
    if (sub === "remove") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const r = await removeAutomodPack(interaction.guild!);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(r.removed > 0 ? PINK : AMBER)
            .setAuthor({ name: "Zero Two · AutoMod remove", iconURL: botIcon })
            .setTitle("🗑️ Desinstalación del pack")
            .setDescription(
              [
                `Eliminadas **${r.removed}** regla(s) con prefijo Zero Two.`,
                r.errors.length
                  ? `\n**Errores:**\n${r.errors.map((e) => `• ${e}`).join("\n")}`
                  : r.removed === 0
                    ? "\nNo había reglas `ZT |` / `ZT ·` en este servidor."
                    : "\nLas reglas de otros bots o de Discord no se tocaron.",
              ].join("\n"),
            )
            .setTimestamp(),
        ],
      });
      return;
    }

    // ── global (owner) ──────────────────────────────────────────────────────
    if (sub === "global") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { total, ours, byGuild } = await countAutomodRules(client);
      const target = 100;
      const pct = Math.min(100, Math.round((total / target) * 100));
      const top = byGuild
        .slice(0, 12)
        .map((g, i) => `\`${String(i + 1).padStart(2, "0")}\` **${g.name}** — ${g.n}`)
        .join("\n");

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(total >= target ? GREEN : CYAN)
            .setAuthor({ name: "Zero Two · AutoMod global", iconURL: botIcon })
            .setTitle("🏅 Progreso insignia Uses AutoMod")
            .setDescription(
              [
                `Reglas totales (todos los guilds accesibles): **${total}** / **${target}**`,
                `Reglas Zero Two: **${ours}**`,
                `\`${bar(pct, 14)}\` **${pct}%**`,
                "",
                total >= target
                  ? "✅ Meta alcanzada. La insignia puede tardar en aparecer en el perfil de la app."
                  : `Faltan **${Math.max(0, target - total)}** reglas. Setup en más servidores (máx. 6 c/u) o \`/automod sync-all\`.`,
              ].join("\n"),
            )
            .addFields({
              name: "📊 Top servidores",
              value: top || "_Ningún servidor con reglas visibles_",
              inline: false,
            })
            .setFooter({
              text: `Zero Two ${BOT_VERSION} · Insignia de aplicación Discord`,
            })
            .setTimestamp(),
        ],
      });
      return;
    }

    // ── sync-all (owner) ────────────────────────────────────────────────────
    if (sub === "sync-all") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const results = await installAutomodEverywhere(client);
      const created = results.reduce((a, r) => a + r.created, 0);
      const skipped = results.reduce((a, r) => a + r.skipped, 0);
      const failed = results.filter((r) => r.errors.length).length;
      const { total, ours } = await countAutomodRules(client);
      const pct = Math.min(100, Math.round((total / 100) * 100));

      const failSample = results
        .filter((r) => r.errors.length)
        .slice(0, 5)
        .map((r) => `• **${r.guildName}**: ${r.errors[0]}`)
        .join("\n");

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(created > 0 ? GREEN : AMBER)
            .setAuthor({ name: "Zero Two · AutoMod sync-all", iconURL: botIcon })
            .setTitle("🌍 Sincronización global terminada")
            .setDescription(
              [
                `Servidores procesados: **${results.length}**`,
                `Reglas nuevas: **${created}**`,
                `Omitidas: **${skipped}**`,
                `Guilds con error: **${failed}**`,
                "",
                `Total ahora: **${total}** / 100  ·  ZT: **${ours}**`,
                `\`${bar(pct, 14)}\` **${pct}%**`,
                failSample ? `\n**Muestra de errores:**\n${failSample}` : "",
              ].join("\n"),
            )
            .setTimestamp(),
        ],
      });
      return;
    }
  },
};

export default command;
