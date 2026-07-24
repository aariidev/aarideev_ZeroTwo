/**
 * /welcome — mensajes de bienvenida / despedida y autoroles.
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  Role,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getWelcomeSettings,
  updateWelcomeSettings,
  renderWelcomeTemplate,
  buildWelcomeVars,
  safeEmbedText,
  DEFAULT_WELCOME_MESSAGE,
} from "../../lib/welcome.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;
const GREEN = 0x22c55e;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("🌸 Mensajes de bienvenida, despedida y autoroles")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName("status").setDescription("Ver configuración actual"),
    )
    .addSubcommand((s) =>
      s
        .setName("toggle")
        .setDescription("Activar o desactivar el sistema")
        .addBooleanOption((o) =>
          o.setName("activar").setDescription("true = on").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Configurar canales y mensajes")
        .addChannelOption((o) =>
          o
            .setName("canal")
            .setDescription("Canal de bienvenida")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        )
        .addChannelOption((o) =>
          o
            .setName("despedida")
            .setDescription("Canal de leave (por defecto = bienvenida)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        )
        .addStringOption((o) =>
          o
            .setName("mensaje")
            .setDescription("Plantilla welcome: {user} {username} {server} {memberCount} {accountAge}")
            .setMaxLength(1500),
        )
        .addStringOption((o) =>
          o
            .setName("mensaje_leave")
            .setDescription("Plantilla leave")
            .setMaxLength(1500),
        )
        .addBooleanOption((o) =>
          o.setName("embed").setDescription("Usar embed en welcome (default true)"),
        )
        .addBooleanOption((o) =>
          o
            .setName("embed_leave")
            .setDescription("Usar embed en leave (default true)"),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("autorole")
        .setDescription("Roles automáticos al unirse")
        .addStringOption((o) =>
          o
            .setName("accion")
            .setDescription("add | remove | clear | list")
            .setRequired(true)
            .addChoices(
              { name: "Añadir", value: "add" },
              { name: "Quitar", value: "remove" },
              { name: "Vaciar", value: "clear" },
              { name: "Listar", value: "list" },
            ),
        )
        .addRoleOption((o) =>
          o.setName("rol").setDescription("Rol (add/remove)"),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("test")
        .setDescription("Previsualiza el mensaje de bienvenida contigo"),
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

    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.reply({
        content: "❌ Necesitas **Gestionar servidor**.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "status") {
      const s = await getWelcomeSettings(guildId);
      let roles: string[] = [];
      try {
        roles = JSON.parse(s.autoroleIds) as string[];
      } catch {
        roles = [];
      }
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(s.enabled ? GREEN : PINK)
            .setAuthor({
              name: "Zero Two · Welcome",
              iconURL: client.user?.displayAvatarURL() ?? undefined,
            })
            .setTitle(s.enabled ? "🌸 Sistema activo" : "⏸️ Sistema inactivo")
            .addFields(
              {
                name: "Canal welcome",
                value: s.channelId ? `<#${s.channelId}>` : "`—`",
                inline: true,
              },
              {
                name: "Canal leave",
                value: s.leaveChannelId
                  ? `<#${s.leaveChannelId}>`
                  : s.channelId
                    ? `<#${s.channelId}> (mismo)`
                    : "`—`",
                inline: true,
              },
              {
                name: "Embeds",
                value: `welcome \`${s.welcomeEmbed}\` · leave \`${s.leaveEmbed}\``,
                inline: false,
              },
              {
                name: "Mensaje welcome",
                value: safeEmbedText(
                  `\`\`\`\n${(s.welcomeMessage || DEFAULT_WELCOME_MESSAGE).slice(0, 400)}\n\`\`\``,
                ),
                inline: false,
              },
              {
                name: "Mensaje leave",
                value: safeEmbedText(
                  `\`\`\`\n${(s.leaveMessage || "—").slice(0, 400)}\n\`\`\``,
                ),
                inline: false,
              },
              {
                name: "Autoroles",
                value: roles.length
                  ? roles.map((id) => `<@&${id}>`).join(" ")
                  : "`ninguno`",
                inline: false,
              },
            )
            .setFooter({
              text: `Vars: {user} {username} {server} {memberCount} {accountAge} · Zero Two ${BOT_VERSION}`,
            }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "toggle") {
      const on = interaction.options.getBoolean("activar", true);
      await updateWelcomeSettings(guildId, { enabled: on });
      await interaction.reply({
        content: on ? "✅ Welcome **activado**." : "⏸️ Welcome **desactivado**.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "set") {
      const canal = interaction.options.getChannel("canal");
      const leave = interaction.options.getChannel("despedida");
      const mensaje = interaction.options.getString("mensaje");
      const mensajeLeave = interaction.options.getString("mensaje_leave");
      const embed = interaction.options.getBoolean("embed");
      const embedLeave = interaction.options.getBoolean("embed_leave");

      if (
        !canal &&
        !leave &&
        !mensaje &&
        !mensajeLeave &&
        embed == null &&
        embedLeave == null
      ) {
        await interaction.reply({
          content:
            "❌ Pasa al menos un parámetro: `canal`, `despedida`, `mensaje`, `mensaje_leave`, `embed`…",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const s = await updateWelcomeSettings(guildId, {
        channelId: canal?.id,
        leaveChannelId: leave?.id,
        welcomeMessage: mensaje ?? undefined,
        leaveMessage: mensajeLeave ?? undefined,
        welcomeEmbed: embed ?? undefined,
        leaveEmbed: embedLeave ?? undefined,
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(GREEN)
            .setTitle("✅ Welcome actualizado")
            .setDescription(
              [
                s.channelId ? `Welcome → <#${s.channelId}>` : "Canal welcome sin cambiar",
                s.leaveChannelId
                  ? `Leave → <#${s.leaveChannelId}>`
                  : "Leave usa el mismo canal (si existe)",
              ].join("\n"),
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "autorole") {
      const accion = interaction.options.getString("accion", true);
      const role = interaction.options.getRole("rol") as Role | null;
      const s = await getWelcomeSettings(guildId);
      let roles: string[] = [];
      try {
        roles = JSON.parse(s.autoroleIds) as string[];
      } catch {
        roles = [];
      }

      if (accion === "list") {
        await interaction.reply({
          content: roles.length
            ? roles.map((id) => `<@&${id}>`).join(" ")
            : "Lista vacía.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (accion === "clear") {
        await updateWelcomeSettings(guildId, { autoroleIds: [] });
        await interaction.reply({
          content: "✅ Autoroles vaciados.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!role) {
        await interaction.reply({
          content: "❌ Indica un `rol`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (accion === "add") {
        if (!roles.includes(role.id)) roles.push(role.id);
        await updateWelcomeSettings(guildId, { autoroleIds: roles });
        await interaction.reply({
          content: `✅ Autorol añadido: ${role}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (accion === "remove") {
        roles = roles.filter((id) => id !== role.id);
        await updateWelcomeSettings(guildId, { autoroleIds: roles });
        await interaction.reply({
          content: `✅ Autorol quitado: ${role}`,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (sub === "test") {
      const member = interaction.member;
      if (!member || !("user" in member)) {
        await interaction.reply({
          content: "❌ No pude leerte como miembro.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const s = await getWelcomeSettings(guildId);
      const vars = buildWelcomeVars({
        user: interaction.user,
        guild: interaction.guild,
      });
      const text = renderWelcomeTemplate(s.welcomeMessage, vars);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(PINK)
            .setTitle("🧪 Preview welcome")
            .setDescription(
              safeEmbedText(text, DEFAULT_WELCOME_MESSAGE),
            )
            .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: `Zero Two ${BOT_VERSION}` }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
