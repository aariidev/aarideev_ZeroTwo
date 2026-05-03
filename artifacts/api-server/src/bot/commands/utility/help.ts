import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  ApplicationCommandOptionType,
} from "discord.js";
import { BotClient, Command } from "../../types.js";

// ── Per-command metadata ──────────────────────────────────────────────────────
const META: Record<string, { emoji: string; category: string; usage: string; permission?: string }> = {
  // Utility
  ping:       { emoji: "🏓", category: "Utilidad",   usage: "/ping",                           },
  avatar:     { emoji: "🖼️",  category: "Utilidad",   usage: "/avatar [usuario]",               },
  serverinfo: { emoji: "🏠", category: "Utilidad",   usage: "/serverinfo",                     },
  userinfo:   { emoji: "👤", category: "Utilidad",   usage: "/userinfo [usuario]",             },
  help:       { emoji: "📋", category: "Utilidad",   usage: "/help [comando]",                 },
  // Moderation
  ban:        { emoji: "🔨", category: "Moderación", usage: "/ban <usuario> [motivo] [días]",  permission: "Banear Miembros"        },
  kick:       { emoji: "👢", category: "Moderación", usage: "/kick <usuario> [motivo]",        permission: "Expulsar Miembros"      },
  mute:       { emoji: "🔇", category: "Moderación", usage: "/mute <usuario> <duración>",      permission: "Silenciar Miembros"    },
  unmute:     { emoji: "🔊", category: "Moderación", usage: "/unmute <usuario>",               permission: "Silenciar Miembros"    },
  timeout:    { emoji: "⏳", category: "Moderación", usage: "/timeout <usuario> <segundos>",   permission: "Silenciar Miembros"    },
  untimeout:  { emoji: "✅", category: "Moderación", usage: "/untimeout <usuario>",            permission: "Silenciar Miembros"    },
  unban:      { emoji: "🔓", category: "Moderación", usage: "/unban <id>",                     permission: "Banear Miembros"        },
  warn:       { emoji: "⚠️",  category: "Moderación", usage: "/warn <usuario> <motivo>",        permission: "Silenciar Miembros"    },
  warns:      { emoji: "📜", category: "Moderación", usage: "/warns <usuario>",                permission: "Silenciar Miembros"    },
  clearwarns: { emoji: "🧹", category: "Moderación", usage: "/clearwarns <usuario>",           permission: "Silenciar Miembros"    },
  purge:      { emoji: "🗑️",  category: "Moderación", usage: "/purge <cantidad>",               permission: "Gestionar Mensajes"    },
  slowmode:   { emoji: "🐢", category: "Moderación", usage: "/slowmode <segundos>",            permission: "Gestionar Canales"     },
  lock:       { emoji: "🔒", category: "Moderación", usage: "/lock [motivo]",                  permission: "Gestionar Canales"     },
  unlock:     { emoji: "🔓", category: "Moderación", usage: "/unlock",                         permission: "Gestionar Canales"     },
  logs:       { emoji: "📋", category: "Moderación", usage: "/logs <ver|buscar|borrar>",       permission: "Silenciar Miembros"    },
  // Fun
  "8ball":    { emoji: "🎱", category: "Diversión",  usage: "/8ball <pregunta>",               },
  coinflip:   { emoji: "🪙", category: "Diversión",  usage: "/coinflip",                       },
  roll:       { emoji: "🎲", category: "Diversión",  usage: "/roll [caras]",                   },
};

const OPTION_TYPE_LABEL: Record<number, string> = {
  [ApplicationCommandOptionType.String]:      "texto",
  [ApplicationCommandOptionType.Integer]:     "número",
  [ApplicationCommandOptionType.Number]:      "decimal",
  [ApplicationCommandOptionType.Boolean]:     "sí/no",
  [ApplicationCommandOptionType.User]:        "usuario",
  [ApplicationCommandOptionType.Channel]:     "canal",
  [ApplicationCommandOptionType.Role]:        "rol",
  [ApplicationCommandOptionType.Mentionable]: "mención",
  [ApplicationCommandOptionType.Attachment]:  "archivo",
  [ApplicationCommandOptionType.SubCommand]:  "subcomando",
};

const CATEGORY_ORDER = ["Utilidad", "Moderación", "Diversión"];
const CATEGORY_EMOJI: Record<string, string> = {
  "Utilidad":   "🛠️",
  "Moderación": "🛡️",
  "Diversión":  "🎮",
};

// ─────────────────────────────────────────────────────────────────────────────

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📋 Muestra información detallada de todos los comandos")
    .addStringOption((opt) =>
      opt
        .setName("comando")
        .setDescription("Nombre del comando para ver sus detalles")
        .setRequired(false)
        .addChoices(
          ...Object.entries(META).map(([name, m]) => ({
            name: `${m.emoji} ${name} — ${CATEGORY_EMOJI[m.category]} ${m.category}`,
            value: name,
          }))
        )
    ),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const botClient = client as BotClient;
    const commandName = interaction.options.getString("comando");
    const totalCmds = botClient.commands.size;

    // ── DETAIL VIEW ──────────────────────────────────────────────────────────
    if (commandName) {
      const cmd = botClient.commands.get(commandName);
      if (!cmd) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff2d6b)
              .setDescription(`❌ No encontré el comando \`${commandName}\`.`),
          ],
          ephemeral: true,
        });
      }

      const meta = META[commandName];
      const json = cmd.data.toJSON() as {
        description: string;
        options?: Array<{ name: string; description: string; type: number; required?: boolean; choices?: Array<{ name: string }> }>;
      };

      const embed = new EmbedBuilder()
        .setColor(0xec4899)
        .setAuthor({
          name: `ZeroTwo v2.1.0 · Comandos`,
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle(`${meta?.emoji ?? "📌"} /${commandName}`)
        .setDescription(`> ${json.description}`)
        .setTimestamp();

      // Usage
      embed.addFields({
        name: "📝 Uso",
        value: `\`${meta?.usage ?? `/${commandName}`}\``,
        inline: false,
      });

      // Options / subcommands
      const opts = json.options ?? [];
      if (opts.length > 0) {
        const optLines = opts.map((o) => {
          const typeLabel = OPTION_TYPE_LABEL[o.type] ?? "opción";
          const req = o.required ? "**requerido**" : "opcional";
          const choices =
            o.choices && o.choices.length > 0
              ? `\n  ↳ Opciones: ${o.choices.map((c) => `\`${c.name}\``).join(", ")}`
              : "";
          if (o.type === ApplicationCommandOptionType.SubCommand) {
            return `\`${o.name}\` — ${o.description}`;
          }
          return `\`${o.name}\` [${typeLabel}] · ${req}\n  ↳ ${o.description}${choices}`;
        });

        embed.addFields({
          name: opts[0]?.type === ApplicationCommandOptionType.SubCommand ? "📂 Subcomandos" : "⚙️ Opciones",
          value: optLines.join("\n\n"),
          inline: false,
        });
      }

      // Metadata row
      embed.addFields(
        {
          name: "⏱️ Cooldown",
          value: `${cmd.cooldown ?? 3}s`,
          inline: true,
        },
        {
          name: `${CATEGORY_EMOJI[meta?.category ?? ""] ?? "📂"} Categoría`,
          value: meta?.category ?? "—",
          inline: true,
        }
      );

      if (meta?.permission) {
        embed.addFields({
          name: "🔐 Permiso requerido",
          value: meta.permission,
          inline: true,
        });
      }

      embed.setFooter({
        text: `Usa /help para ver todos los comandos  •  ${totalCmds} comandos en total`,
        iconURL: client.user?.displayAvatarURL(),
      });

      return interaction.reply({ embeds: [embed] });
    }

    // ── OVERVIEW ─────────────────────────────────────────────────────────────
    const categories: Record<string, Array<{ name: string; description: string; emoji: string }>> = {};
    for (const cat of CATEGORY_ORDER) categories[cat] = [];

    for (const [, cmd] of botClient.commands) {
      const meta = META[cmd.data.name];
      if (!meta) continue;
      const json = cmd.data.toJSON() as { description: string };
      categories[meta.category]?.push({
        name: cmd.data.name,
        description: json.description,
        emoji: meta.emoji,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xec4899)
      .setAuthor({
        name: "ZeroTwo v2.1.0",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("📋 Lista de Comandos")
      .setDescription(
        `Hola, soy **02** — tu bot de moderación y diversión.\n` +
        `Usa \`/help <comando>\` para ver los detalles de cualquier comando.\n\n` +
        `**\`<requerido>\`**  •  **\`[opcional]\`**`
      )
      .setThumbnail(client.user?.displayAvatarURL() ?? null)
      .setTimestamp()
      .setFooter({
        text: `${totalCmds} comandos disponibles`,
        iconURL: client.user?.displayAvatarURL(),
      });

    for (const cat of CATEGORY_ORDER) {
      const cmds = categories[cat];
      if (!cmds || cmds.length === 0) continue;

      const lines = cmds.map(
        (c) => `${c.emoji} \`/${c.name}\` — ${c.description.replace(/^[^\s]+ /, "")}`
      );

      embed.addFields({
        name: `${CATEGORY_EMOJI[cat]} ${cat} · ${cmds.length} comandos`,
        value: lines.join("\n"),
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
