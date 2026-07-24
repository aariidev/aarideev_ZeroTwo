import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";
import { sendModLog } from "../../lib/modlog.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("giverole")
    .setDescription("🎖️ Da o quita un rol a un miembro")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Miembro objetivo de la operación")
        .setRequired(true),
    )
    .addRoleOption((opt) =>
      opt
        .setName("rol")
        .setDescription("Rol a asignar o retirar")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("accion")
        .setDescription("Dar o quitar el rol")
        .setRequired(false)
        .addChoices(
          { name: "➕ Dar rol", value: "add" },
          { name: "➖ Quitar rol", value: "remove" },
        ),
    )
    .addStringOption((opt) =>
      opt
        .setName("motivo")
        .setDescription("Motivo del cambio de rango"),
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const role = interaction.options.getRole("rol", true);
    const action = interaction.options.getString("accion") ?? "add";
    const reason =
      interaction.options.getString("motivo") ??
      "Sin motivo especificado.";

    // Verificar que el rol no es @everyone ni un rol de bot
    if (role.id === interaction.guild?.id) {
      void interaction.reply({
        content: "❌ No puedo operar sobre el rol `@everyone`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Obtener el miembro objetivo
    const member =
      interaction.guild?.members.cache.get(target.id) ??
      (await interaction.guild?.members.fetch(target.id).catch(() => null));

    if (!member) {
      void interaction.reply({
        content: "❌ No se localizó al parásito dentro de los cuadrantes del servidor.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Obtener el objeto de rol completo desde el guild
    const guildRole =
      interaction.guild?.roles.cache.get(role.id) ??
      (await interaction.guild?.roles.fetch(role.id).catch(() => null));

    if (!guildRole) {
      void interaction.reply({
        content: "❌ No se pudo localizar el rol en el servidor.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Verificar jerarquía: el rol objetivo debe estar por debajo del bot
    const botMember = interaction.guild?.members.me;
    if (
      botMember &&
      guildRole.position >= botMember.roles.highest.position
    ) {
      void interaction.reply({
        content:
          "❌ No puedo gestionar ese rol — está por encima o al mismo nivel que mi rango en la jerarquía.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Verificar jerarquía: el rol objetivo debe estar por debajo del ejecutor
    const executorMember =
      interaction.guild?.members.cache.get(interaction.user.id) ??
      (await interaction.guild?.members.fetch(interaction.user.id).catch(() => null));

    if (
      executorMember &&
      guildRole.position >= executorMember.roles.highest.position &&
      interaction.guild?.ownerId !== interaction.user.id
    ) {
      void interaction.reply({
        content:
          "❌ No tienes rango suficiente para operar sobre ese rol.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const alreadyHas = member.roles.cache.has(guildRole.id);

    // Verificar si la acción es redundante
    if (action === "add" && alreadyHas) {
      await interaction.editReply({
        content: `⚠️ **${target.username}** ya tiene el rol ${guildRole}.`,
      });
      return;
    }
    if (action === "remove" && !alreadyHas) {
      await interaction.editReply({
        content: `⚠️ **${target.username}** no tiene el rol ${guildRole} para retirarlo.`,
      });
      return;
    }

    try {
      if (action === "add") {
        await member.roles.add(guildRole, `${reason} | Ejecutado por: ${interaction.user.tag}`);
      } else {
        await member.roles.remove(guildRole, `${reason} | Ejecutado por: ${interaction.user.tag}`);
      }
    } catch (err) {
      await interaction.editReply({
        content: `❌ No se pudo modificar el rol: ${
          err instanceof Error ? err.message : "error desconocido"
        }`,
      });
      throw err;
    }

    const isAdd = action === "add";
    const embed = new EmbedBuilder()
      .setColor(isAdd ? 0x57f287 : 0xff2d6b)
      .setAuthor({
        name: isAdd
          ? "Asignación de Rango // Zero Two"
          : "Retiro de Rango // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle(
        isAdd
          ? "🎖️ Rango Asignado al Escuadrón"
          : "🎖️ Rango Retirado del Miembro",
      )
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        {
          name: "👤 Miembro Objetivo",
          value: `${target.tag} \`(${target.id})\``,
          inline: true,
        },
        {
          name: "🎖️ Rol Operado",
          value: `${guildRole} \`(${guildRole.id})\``,
          inline: true,
        },
        {
          name: "🛡️ Supervisor al Cargo",
          value: `${interaction.user.tag}`,
          inline: true,
        },
        {
          name: "⚙️ Operación",
          value: isAdd ? "✅ Rol **asignado**" : "🗑️ Rol **retirado**",
          inline: true,
        },
        {
          name: "📝 Fundamentación",
          value: `\`\`\`\n${reason}\n\`\`\``,
          inline: false,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await sendModLog(
      client,
      interaction.guild?.id ?? "",
      embed,
      "member_roles",
    );

    await logBotEvent({
      level: "info",
      event: "member_roles",
      details: {
        action: isAdd ? "add" : "remove",
        roleId: guildRole.id,
        roleName: guildRole.name,
        reason,
      },
      guildId: interaction.guild?.id,
      guildName: interaction.guild?.name,
      userId: target.id,
      username: target.username,
    });
  },
};

export default command;
