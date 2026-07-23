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

import { BOT_VERSION as VERSION } from "../../lib/version.js";
import { helpImageFor } from "../../lib/helpAssets.js";

const META: Record<
  string,
  { emoji: string; category: string; usage: string; permission?: string }
> = {
  // ── Utilidad ────────────────────────────────────────────────────────────────
  ping:       { emoji: "🏓", category: "Utilidad", usage: "/ping" },
  avatar:     { emoji: "🖼️", category: "Utilidad", usage: "/avatar [usuario]" },
  serverinfo: { emoji: "🏠", category: "Utilidad", usage: "/serverinfo" },
  userinfo:   { emoji: "👤", category: "Utilidad", usage: "/userinfo [usuario]" },
  help:       { emoji: "📋", category: "Utilidad", usage: "/help [comando]" },
  zerotwoinf: { emoji: "⚙️", category: "Utilidad", usage: "/zerotwoinf" },
  cfgembed:   { emoji: "🎨", category: "Utilidad", usage: "/cfgembed [canal]", permission: "Gestionar Mensajes" },
  cfglogs:    { emoji: "📋", category: "Utilidad", usage: "/cfglogs <set|disable|status>", permission: "Gestionar Servidor" },
  ticket:     { emoji: "🎫", category: "Utilidad", usage: "/ticket <setup|panel|close|claim|add|remove|status>", permission: "Ver subcomandos" },

  // ── Moderación ──────────────────────────────────────────────────────────────
  ban:        { emoji: "🔨", category: "Moderación", usage: "/ban <usuario> [motivo] [días]", permission: "Banear Miembros" },
  kick:       { emoji: "👢", category: "Moderación", usage: "/kick <usuario> [motivo]", permission: "Expulsar Miembros" },
  mute:       { emoji: "🔇", category: "Moderación", usage: "/mute <usuario> <duración>", permission: "Silenciar Miembros" },
  unmute:     { emoji: "🔊", category: "Moderación", usage: "/unmute <usuario>", permission: "Silenciar Miembros" },
  timeout:    { emoji: "⏳", category: "Moderación", usage: "/timeout <usuario> <segundos>", permission: "Silenciar Miembros" },
  untimeout:  { emoji: "✅", category: "Moderación", usage: "/untimeout <usuario>", permission: "Silenciar Miembros" },
  unban:      { emoji: "🔓", category: "Moderación", usage: "/unban <id>", permission: "Banear Miembros" },
  warn:       { emoji: "⚠️", category: "Moderación", usage: "/warn <usuario> <motivo>", permission: "Silenciar Miembros" },
  warns:      { emoji: "📜", category: "Moderación", usage: "/warns <usuario>", permission: "Silenciar Miembros" },
  clearwarns: { emoji: "🧹", category: "Moderación", usage: "/clearwarns <usuario>", permission: "Silenciar Miembros" },
  delwarn:    { emoji: "🗑️", category: "Moderación", usage: "/delwarn id:<folio>", permission: "Silenciar Miembros" },
  purge:      { emoji: "🧼", category: "Moderación", usage: "/purge <cantidad>", permission: "Gestionar Mensajes" },
  slowmode:   { emoji: "🐢", category: "Moderación", usage: "/slowmode <segundos>", permission: "Gestionar Canales" },
  lock:       { emoji: "🔒", category: "Moderación", usage: "/lock [motivo]", permission: "Gestionar Canales" },
  unlock:     { emoji: "🔓", category: "Moderación", usage: "/unlock", permission: "Gestionar Canales" },
  logs:       { emoji: "📋", category: "Moderación", usage: "/logs <ver|buscar|borrar>", permission: "Silenciar Miembros" },

  // ── Diversión ───────────────────────────────────────────────────────────────
  "8ball":  { emoji: "🎱", category: "Diversión", usage: "/8ball <pregunta>" },
  coinflip: { emoji: "🪙", category: "Diversión", usage: "/coinflip" },
  roll:     { emoji: "🎲", category: "Diversión", usage: "/roll [caras]" },

  // ── Casino ──────────────────────────────────────────────────────────────────
  blackjack: { emoji: "🃏", category: "Casino", usage: "/blackjack" },
  slots:     { emoji: "🎰", category: "Casino", usage: "/slots <apuesta>" },
  wallet:    { emoji: "💳", category: "Casino", usage: "/wallet [usuario]" },
  shop:      { emoji: "🏪", category: "Casino", usage: "/shop" },
  inventory: { emoji: "🎒", category: "Casino", usage: "/inventory" },
  pay:       { emoji: "💸", category: "Casino", usage: "/pay <usuario> <cantidad>" },
  top:       { emoji: "🏆", category: "Casino", usage: "/top [tipo]" },

  // ── Música (estilo Jockie) ──────────────────────────────────────────────────
  play:        { emoji: "▶️", category: "Música", usage: "/play <query|url>" },
  skip:        { emoji: "⏭️", category: "Música", usage: "/skip" },
  stop:        { emoji: "⏹️", category: "Música", usage: "/stop" },
  pause:       { emoji: "⏸️", category: "Música", usage: "/pause" },
  queue:       { emoji: "📋", category: "Música", usage: "/queue [pagina]" },
  nowplaying:  { emoji: "🎵", category: "Música", usage: "/nowplaying" },
  volume:      { emoji: "🔊", category: "Música", usage: "/volume <0-150>" },
  loop:        { emoji: "🔁", category: "Música", usage: "/loop" },
  shuffle:     { emoji: "🔀", category: "Música", usage: "/shuffle" },
  leave:       { emoji: "🚪", category: "Música", usage: "/leave" },
  musicpanel:  { emoji: "🎛️", category: "Música", usage: "/musicpanel <set|panel|dj|status|disable>", permission: "Gestionar Servidor" },
  remove:      { emoji: "🗑️", category: "Música", usage: "/remove <posicion>" },
  clear:       { emoji: "🧹", category: "Música", usage: "/clear" },
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
  [ApplicationCommandOptionType.Subcommand]:  "subcomando",
};

const CATEGORY_ORDER = ["Utilidad", "Moderación", "Diversión", "Casino", "Música"];
const CATEGORY_EMOJI: Record<string, string> = {
  Utilidad:   "🛠️",
  Moderación: "🛡️",
  Diversión:  "🎮",
  Casino:     "🎰",
  Música:     "🎵",
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📋 Muestra el panel de comandos del sistema Zero Two")
    .addStringOption((opt) =>
      opt
        .setName("comando")
        .setDescription("Ver los detalles de un comando específico")
        .setRequired(false)
        .addChoices(
          ...Object.entries(META).slice(0, 25).map(([name, m]) => ({
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
              .setDescription(`❌ La unidad central no reconoce el comando \`${commandName}\`.`),
          ],
          ephemeral: true,
        });
      }

      const meta = META[commandName];
      const json = cmd.data.toJSON() as any;

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: `Calibración del Sistema // Zero Two ${VERSION}`,
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
            name: "⏱️ Cooldown",
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
          name: "🔐 Permiso requerido",
          value: `\`${meta.permission}\``,
          inline: true,
        });
      }

      const opts = json.options ?? [];
      if (opts.length > 0) {
        const optLines = opts.map((o: any) => {
          const typeLabel = OPTION_TYPE_LABEL[o.type] ?? "parámetro";
          const req = o.required ? "Requerido" : "Opcional";
          return `• \`${o.name}\` *(${typeLabel} | ${req})*\n  └ *${o.description}*`;
        });
        embed.addFields({
          name: "⚙️ Parámetros",
          value: optLines.join("\n"),
        });
      }

      embed
        .setTimestamp()
        .setFooter({
          text: `Zero Two ${VERSION} · Módulo de diagnóstico`,
          iconURL: client.user?.displayAvatarURL(),
        });
      return interaction.reply({ embeds: [embed] });
    }

    // ── VISTA GENERAL ────────────────────────────────────────────────────────
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
      const img = helpImageFor("main");
      const emb = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: `Unidad de Control Central // Zero Two ${VERSION}`,
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTitle("📋 Registro de Comandos de la Plantación")
        .setDescription(
          `Hola, cariño. Soy **Zero Two**, encargada de mantener el orden y la diversión en este escuadrón. 🌸\n\n` +
            `> Selecciona una categoría en el menú desplegable inferior.\n\n` +
            `• **Comandos Totales:** \`${totalCmds}\`\n` +
            `• **Módulos activos:** ${CATEGORY_ORDER.map((c) => `${CATEGORY_EMOJI[c]} ${c}`).join(" · ")}\n` +
            `• **Uso:** \`<obligatorio>\` · \`[opcional]\``,
        )
        .setThumbnail(client.user?.displayAvatarURL() ?? null)
        .setTimestamp()
        .setFooter({
          text: `Zero Two ${VERSION} · The Garden`,
          iconURL: client.user?.displayAvatarURL(),
        });
      if (img.url) emb.setImage(img.url);
      return { embed: emb, file: img.file };
    };

    const generateCatEmbed = (selected: string) => {
      const cmds = categories[selected] ?? [];
      const lines = cmds.map(
        (c) => `${c.emoji} \`/${c.name}\`\n  └ *${c.description}*`,
      );
      const img = helpImageFor(selected);
      const emb = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setAuthor({
          name: `Módulo: ${selected} // Zero Two ${VERSION}`,
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
      if (img.url) emb.setImage(img.url);
      return { embed: emb, file: img.file };
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

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    const main = generateMainEmbed();
    const response = await interaction.reply({
      embeds: [main.embed],
      files: main.file ? [main.file] : [],
      components: [row],
    });

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
        const m = generateMainEmbed();
        return i.update({
          embeds: [m.embed],
          files: m.file ? [m.file] : [],
        });
      }

      const cat = generateCatEmbed(selected);
      await i.update({
        embeds: [cat.embed],
        files: cat.file ? [cat.file] : [],
      });
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
