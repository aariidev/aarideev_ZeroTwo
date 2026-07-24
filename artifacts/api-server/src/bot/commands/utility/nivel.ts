/**
 * /nivel — XP, ranking y config de niveles.
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getUserLevel,
  getLeaderboard,
  getLevelSettings,
  updateLevelSettings,
  levelFromTotalXp,
  progressBar,
  rankTitle,
  grantXp,
} from "../../lib/levels.js";
import {
  formatAchievementList,
  parseAchievementsJson,
  ACHIEVEMENT_CATALOG,
} from "../../lib/achievements.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;
const GOLD = 0xffd700;
const GREEN = 0x22c55e;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nivel")
    .setDescription("📊 Niveles y experiencia del servidor")
    .addSubcommand((s) =>
      s
        .setName("ver")
        .setDescription("Ver tu nivel o el de otro usuario")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Usuario (por defecto: tú)"),
        ),
    )
    .addSubcommand((s) =>
      s.setName("top").setDescription("Ranking de XP del servidor"),
    )
    .addSubcommand((s) =>
      s
        .setName("logros")
        .setDescription("Ver logros de nivel desbloqueados")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Usuario (por defecto: tú)"),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("config")
        .setDescription("Configurar el sistema de niveles (admin)")
        .addBooleanOption((o) =>
          o.setName("activar").setDescription("Activar / desactivar XP"),
        )
        .addIntegerOption((o) =>
          o
            .setName("xp_min")
            .setDescription("XP mínimo por mensaje")
            .setMinValue(1)
            .setMaxValue(100),
        )
        .addIntegerOption((o) =>
          o
            .setName("xp_max")
            .setDescription("XP máximo por mensaje")
            .setMinValue(1)
            .setMaxValue(200),
        )
        .addIntegerOption((o) =>
          o
            .setName("cooldown")
            .setDescription("Cooldownoldown entre XP de mensajes (segundos)")
            .setMinValue(10)
            .setMaxValue(600),
        )
        .addIntegerOption((o) =>
          o
            .setName("voz_xp")
            .setDescription("XP por minuto en voz")
            .setMinValue(0)
            .setMaxValue(50),
        )
        .addChannelOption((o) =>
          o
            .setName("anuncios")
            .setDescription("Canal fijo de level-up (opcional)")
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("dar")
        .setDescription("[Admin] Dar XP a un usuario")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Objetivo").setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("cantidad")
            .setDescription("XP a otorgar")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100_000),
        ),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Solo en servidores.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const isAdmin = interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild,
    );

    if (sub === "ver") {
      const target = interaction.options.getUser("usuario") ?? interaction.user;
      const user = await getUserLevel(guildId, target.id);
      const prog = levelFromTotalXp(user.xp);
      const bar = progressBar(prog.xpIntoLevel, prog.xpNeeded);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setAuthor({
              name: "Zero Two · Niveles",
              iconURL: client.user?.displayAvatarURL() ?? undefined,
            })
            .setTitle(`📊 ${target.displayName}`)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .addFields(
              {
                name: "⭐ Nivel",
                value: `\`${user.level}\``,
                inline: true,
              },
              {
                name: "✨ XP total",
                value: `\`${user.xp.toLocaleString("es-ES")}\``,
                inline: true,
              },
              {
                name: "🏅 Rango",
                value: rankTitle(user.level),
                inline: true,
              },
              {
                name: "📈 Progreso",
                value: `\`${bar}\` **${prog.xpIntoLevel}** / **${prog.xpNeeded}** XP`,
                inline: false,
              },
              {
                name: "💬 Mensajes",
                value: `\`${user.totalMessages.toLocaleString("es-ES")}\``,
                inline: true,
              },
              {
                name: "🎙️ Minutos en voz",
                value: `\`${user.voiceMinutes.toLocaleString("es-ES")}\``,
                inline: true,
              },
              {
                name: "🏅 Logros",
                value: `\`${parseAchievementsJson((user as { achievements?: string }).achievements).length}\` / \`${ACHIEVEMENT_CATALOG.length}\` · \`/nivel logros\``,
                inline: true,
              },
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION}` })
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === "logros") {
      const target = interaction.options.getUser("usuario") ?? interaction.user;
      const user = await getUserLevel(guildId, target.id);
      const unlocked = parseAchievementsJson(
        (user as { achievements?: string }).achievements,
      );
      const { unlockedLines, lockedLines, unlockedCount } =
        formatAchievementList(unlocked);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GOLD)
            .setAuthor({
              name: "Zero Two · Logros",
              iconURL: client.user?.displayAvatarURL() ?? undefined,
            })
            .setTitle(`🏅 Logros de ${target.displayName}`)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .setDescription(
              `**${unlockedCount}** / **${ACHIEVEMENT_CATALOG.length}** desbloqueados`,
            )
            .addFields(
              {
                name: "✅ Desbloqueados",
                value: unlockedLines.slice(0, 1020),
                inline: false,
              },
              {
                name: "🔒 Bloqueados",
                value: lockedLines.slice(0, 1020),
                inline: false,
              },
            )
            .setFooter({ text: `Zero Two ${BOT_VERSION}` })
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === "top") {
      const board = await getLeaderboard(guildId, 10);
      const lines =
        board.length === 0
          ? "_Nadie tiene XP todavía. ¡Habla en el chat!_"
          : board
              .map((row, i) => {
                const medal =
                  i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `\`${i + 1}.\``;
                return `${medal} <@${row.userId}> — **Nv.${row.level}** · \`${row.xp}\` XP`;
              })
              .join("\n");

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GOLD)
            .setAuthor({
              name: `Ranking · ${interaction.guild.name}`,
              iconURL: interaction.guild.iconURL() ?? undefined,
            })
            .setTitle("🏆 Top XP")
            .setDescription(lines)
            .setFooter({ text: `Zero Two ${BOT_VERSION}` })
            .setTimestamp(),
        ],
      });
      return;
    }

    if (!isAdmin) {
      await interaction.reply({
        content: "❌ Necesitas **Gestionar servidor** para este subcomando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "config") {
      const activar = interaction.options.getBoolean("activar");
      const xpMin = interaction.options.getInteger("xp_min");
      const xpMax = interaction.options.getInteger("xp_max");
      const cooldown = interaction.options.getInteger("cooldown");
      const voz = interaction.options.getInteger("voz_xp");
      const anuncios = interaction.options.getChannel("anuncios");

      if (
        activar == null &&
        xpMin == null &&
        xpMax == null &&
        cooldown == null &&
        voz == null &&
        !anuncios
      ) {
        const s = await getLevelSettings(guildId);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(s.enabled ? GREEN : AMBER_SAFE)
              .setTitle("⚙️ Config de niveles")
              .addFields(
                {
                  name: "Estado",
                  value: s.enabled ? "✅ On" : "⏸️ Off",
                  inline: true,
                },
                {
                  name: "XP mensaje",
                  value: `\`${s.xpMin}\`–\`${s.xpMax}\``,
                  inline: true,
                },
                {
                  name: "Cooldownoldown",
                  value: `\`${s.cooldownSec}s\``,
                  inline: true,
                },
                {
                  name: "XP voz / min",
                  value: `\`${s.voiceXpPerMin}\``,
                  inline: true,
                },
                {
                  name: "Anuncios",
                  value: s.announceChannelId
                    ? `<#${s.announceChannelId}>`
                    : "`en el canal del mensaje`",
                  inline: false,
                },
              )
              .setFooter({
                text: "Pasa opciones para cambiar · Zero Two",
              }),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const s = await updateLevelSettings(guildId, {
        enabled: activar ?? undefined,
        xpMin: xpMin ?? undefined,
        xpMax: xpMax ?? undefined,
        cooldownSec: cooldown ?? undefined,
        voiceXpPerMin: voz ?? undefined,
        announceChannelId: anuncios?.id ?? undefined,
      });

      await interaction.reply({
        content: `✅ Niveles actualizados · ${s.enabled ? "ON" : "OFF"} · XP \`${s.xpMin}-${s.xpMax}\` · CD \`${s.cooldownSec}s\` · voz \`${s.voiceXpPerMin}/min\``,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "dar") {
      const target = interaction.options.getUser("usuario", true);
      const amount = interaction.options.getInteger("cantidad", true);
      const result = await grantXp({
        guildId,
        userId: target.id,
        amount,
        source: "admin",
        client,
        guild: interaction.guild,
      });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setTitle("✨ XP otorgada")
            .setDescription(
              `${target} recibió **${amount}** XP.\nNivel: **${result.oldLevel}** → **${result.newLevel}** · total \`${result.totalXp}\``,
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

const AMBER_SAFE = 0xf59e0b;

export default command;
