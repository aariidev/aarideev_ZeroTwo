import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  ApplicationCommandOptionType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";
import { BotClient, Command } from "../../types.js";

const META: Record<
  string,
  { emoji: string; category: string; usage: string; permission?: string }
> = {
  ping: { emoji: "🏓", category: "Utilidad", usage: "/ping" },
  avatar: { emoji: "🖼️", category: "Utilidad", usage: "/avatar [usuario]" },
  serverinfo: { emoji: "🏠", category: "Utilidad", usage: "/serverinfo" },
  userinfo: { emoji: "👤", category: "Utilidad", usage: "/userinfo [usuario]" },
  help: { emoji: "📋", category: "Utilidad", usage: "/help [comando]" },
  ban: {
    emoji: "🔨",
    category: "Moderación",
    usage: "/ban <usuario> [motivo] [días]",
    permission: "Banear Miembros",
  },
  kick: {
    emoji: "👢",
    category: "Moderación",
    usage: "/kick <usuario> [motivo]",
    permission: "Expulsar Miembros",
  },
  mute: {
    emoji: "🔇",
    category: "Moderación",
    usage: "/mute <usuario> <duración>",
    permission: "Silenciar Miembros",
  },
  unmute: {
    emoji: "🔊",
    category: "Moderación",
    usage: "/unmute <usuario>",
    permission: "Silenciar Miembros",
  },
  timeout: {
    emoji: "⏳",
    category: "Moderación",
    usage: "/timeout <usuario> <segundos>",
    permission: "Silenciar Miembros",
  },
  untimeout: {
    emoji: "✅",
    category: "Moderación",
    usage: "/untimeout <usuario>",
    permission: "Silenciar Miembros",
  },
  unban: {
    emoji: "🔓",
    category: "Moderación",
    usage: "/unban <id>",
    permission: "Banear Miembros",
  },
  warn: {
    emoji: "⚠️",
    category: "Moderación",
    usage: "/warn <usuario> <motivo>",
    permission: "Silenciar Miembros",
  },
  warns: {
    emoji: "📜",
    category: "Moderación",
    usage: "/warns <usuario>",
    permission: "Silenciar Miembros",
  },
  clearwarns: {
    emoji: "🧹",
    category: "Moderación",
    usage: "/clearwarns <usuario>",
    permission: "Silenciar Miembros",
  },
  purge: {
    emoji: "🗑️",
    category: "Moderación",
    usage: "/purge <cantidad>",
    permission: "Gestionar Mensajes",
  },
  slowmode: {
    emoji: "🐢",
    category: "Moderación",
    usage: "/slowmode <segundos>",
    permission: "Gestionar Canales",
  },
  lock: {
    emoji: "🔒",
    category: "Moderación",
    usage: "/lock [motivo]",
    permission: "Gestionar Canales",
  },
  unlock: {
    emoji: "🔓",
    category: "Moderación",
    usage: "/unlock",
    permission: "Gestionar Canales",
  },
  logs: {
    emoji: "📋",
    category: "Moderación",
    usage: "/logs <ver|buscar|borrar>",
    permission: "Silenciar Miembros",
  },
  "8ball": { emoji: "🎱", category: "Diversión", usage: "/8ball <pregunta>" },
  coinflip: { emoji: "🪙", category: "Diversión", usage: "/coinflip" },
  roll: { emoji: "🎲", category: "Diversión", usage: "/roll [caras]" },
};

const OPTION_TYPE_LABEL: Record<number, string> = {
  [ApplicationCommandOptionType.String]: "texto",
  [ApplicationCommandOptionType.Integer]: "número",
  [ApplicationCommandOptionType.Number]: "decimal",
  [ApplicationCommandOptionType.Boolean]: "sí/no",
  [ApplicationCommandOptionType.User]: "usuario",
  [ApplicationCommandOptionType.Channel]: "canal",
  [ApplicationCommandOptionType.Role]: "rol",
  [ApplicationCommandOptionType.Mentionable]: "mención",
  [ApplicationCommandOptionType.Attachment]: "archivo",
  [ApplicationCommandOptionType.SubCommand]: "subcomando",
};

const CATEGORY_ORDER = ["Utilidad", "Moderación", "Diversión"];
const CATEGORY_EMOJI: Record<string, string> = {
  Utilidad: "🛠️",
  Moderación: "🛡️",
  Diversión: "🎮",
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📋 Muestra el panel de comandos del sistema Zero Two")
    .addStringOption((opt) =>
      opt
        .setName("comando")
        .setDescription(
          "Ver los detalles de calibración de un comando específico",
        )
        .setRequired(false)
        .addChoices(
          ...Object.entries(META).map(([name, m]) => ({
            name: `${m.emoji} ${name}`,
            value: name,
          })),
        ),
    ),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const botClient = client as BotClient;
    const commandName = interaction.options.getString("comando");
    const totalCmds = botClient.commands.size;

    // ── VISTA DE DETALLE DE COMANDO ──────────────────────────────────────────
    if (commandName) {
      const cmd = botClient.commands.get(commandName);
      if (!cmd) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff2d6b)
              .setDescription(
                `❌ La unidad central no reconoce el comando \`${commandName}\`.`,
              ),
          ],
          ephemeral: true,
        });
      }

      const meta = META[commandName];
      const json = cmd.data.toJSON() as any;

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: `Calibración del Sistema // Zero Two v2.1.0`,
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle(`${meta?.emoji ?? "📌"} Comando: /${commandName}`)
        .setDescription(`\`\`\`\n${json.description}\n\`\`\``)
        .addFields(
          {
            name: "📝 Modo de Uso",
            value: `\`\`\`md\n${meta?.usage ?? `/${commandName}`}\n\`\`\``,
            inline: false,
          },
          {
            name: "⏱️ Latencia de Cooldown",
            value: `\`${cmd.cooldown ?? 3} segundos\``,
            inline: true,
          },
          {
            name: `${CATEGORY_EMOJI[meta?.category ?? ""] ?? "📂"} Módulo`,
            value: `\`${meta?.category ?? "General"}\``,
            inline: true,
          },
        );

      if (meta?.permission) {
        embed.addFields({
          name: "🔐 Nivel de Acceso",
          value: `Requiere: \`${meta.permission}\``,
          inline: true,
        });
      }

      const opts = json.options ?? [];
      if (opts.length > 0) {
        const optLines = opts.map((o: any) => {
          const typeLabel = OPTION_TYPE_LABEL[o.type] ?? "parámetro";
          const req = o.required ? "Requerido" : "Opcional";
          return `• \`${o.name}\` *(Type: ${typeLabel} | ${req})*\n  └ *${o.description}*`;
        });
        embed.addFields({
          name: "⚙️ Parámetros de Sincronización",
          value: optLines.join("\n"),
        });
      }

      embed
        .setTimestamp()
        .setFooter({
          text: `Módulo de diagnóstico general`,
          iconURL: client.user?.displayAvatarURL(),
        });
      return interaction.reply({ embeds: [embed] });
    }

    // ── VISTA GENERAL (CON SELECT MENU) ──────────────────────────────────────
    const categories: Record<string, Array<any>> = {};
    for (const cat of CATEGORY_ORDER) categories[cat] = [];

    for (const [, cmd] of botClient.commands) {
      const meta = META[cmd.data.name];
      if (!meta) continue;
      categories[meta.category]?.push({
        name: cmd.data.name,
        description: cmd.data.description,
        emoji: meta.emoji,
      });
    }

    const generateMainEmbed = () => {
      return new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: "Unidad de Control Central // Zero Two v2.1.0",
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle("📋 Registro de Comandos de la Plantación")
        .setDescription(
          `Hola, cariño. Soy **Zero Two**, encargada de mantener el orden y la diversión en este escuadrón. 🌸\n\n` +
            `> Selecciona una categoría en el menú desplegable inferior para desplegar sus funciones de parásito.\n\n` +
            `• **Comandos Totales:** \`${totalCmds}\` de forma global.\n` +
            `• **Uso Estructurado:** \`<obligatorio>\`  •  \`[opcional]\``,
        )
        .setThumbnail(client.user?.displayAvatarURL() ?? null)
        .setTimestamp()
        .setFooter({
          text: "The Garden · Sistema de Diagnóstico",
          iconURL: client.user?.displayAvatarURL(),
        });
    };

    const menu = new StringSelectMenuBuilder()
      .setCustomId("help_menu")
      .setPlaceholder("Selecciona un módulo del sistema...")
      .addOptions(
        {
          label: "Menú Principal",
          description: "Volver a la central de control",
          value: "main",
          emoji: "🌸",
        },
        ...CATEGORY_ORDER.map((cat) => ({
          label: `Módulo ${cat}`,
          description: `Comandos del sector de ${cat.toLowerCase()}`,
          value: cat,
          emoji: CATEGORY_EMOJI[cat],
        })),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      menu,
    );
    const response = await interaction.reply({
      embeds: [generateMainEmbed()],
      components: [row],
    });

    // Colector interactivo en memoria
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60_000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "⚠️ No puedes interactuar con el panel de otro parásito.",
          ephemeral: true,
        });
      }

      const selected = i.values[0]!;

      if (selected === "main") {
        return i.update({ embeds: [generateMainEmbed()] });
      }

      const cmds = categories[selected] || [];
      const lines = cmds.map(
        (c) => `${c.emoji} \`/${c.name}\`\n  └ *${c.description}*`,
      );

      const catEmbed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: `Módulo: ${selected} // Zero Two`,
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle(`${CATEGORY_EMOJI[selected]} Funciones de ${selected}`)
        .setDescription(
          lines.length > 0
            ? lines.join("\n\n")
            : "*No hay comandos registrados en esta sección.*",
        )
        .setTimestamp()
        .setFooter({
          text: `${cmds.length} comandos activos en este sector`,
          iconURL: client.user?.displayAvatarURL(),
        });

      await i.update({ embeds: [catEmbed] });
    });

    collector.on("end", () => {
      menu
        .setDisabled(true)
        .setPlaceholder("Conexión expirada con el panel de control.");
      interaction.editReply({ components: [row] }).catch(() => null);
    });
  },
};

export default command;
