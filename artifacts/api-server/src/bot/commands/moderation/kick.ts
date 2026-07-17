import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";
import { sendModLog } from "../../lib/modlog.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription(
      "👢 Expulsa de forma inmediata a un parásito fuera de la plantación",
    )
    .addUserOption((opt) =>
      opt
        .setName("usuario")
        .setDescription("Objetivo a expulsar")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Causa de expulsión estructural"),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const reason =
      interaction.options.getString("motivo") ??
      "Violación de directrices generales.";
    const member =
      interaction.guild?.members.cache.get(target.id) ??
      (await interaction.guild?.members.fetch(target.id).catch(() => null));

    if (!member)
      return interaction.reply({
        content:
          "❌ No se localizó al parásito dentro de los cuadrantes del servidor.",
        flags: MessageFlags.Ephemeral,
      });
    if (!member.kickable)
      return interaction.reply({
        content:
          "❌ Error crítico: Jerarquía insuficiente para expulsar a este miembro.",
        flags: MessageFlags.Ephemeral,
      });
    if (member.id === interaction.user.id)
      return interaction.reply({
        content: "❌ No puedes auto-ejecutar un protocolo de expulsión.",
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply();

    let dmSent = false;
    try {
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setTitle(`👢 Expulsión ejecutada en ${interaction.guild?.name}`)
            .setDescription(`\`\`\`md\n* Causa :: ${reason}\n\`\`\``)
            .setFooter({
              text: "Puedes re-ingresar si obtienes una invitación válida.",
            }),
        ],
      });
      dmSent = true;
    } catch {
      dmSent = false;
    }

    try {
      await member.kick(`${reason} | Ejecutado por: ${interaction.user.tag}`);
    } catch (kickErr) {
      await interaction.editReply({
        content: `❌ No se pudo expulsar a ${target.tag}: ${
          kickErr instanceof Error ? kickErr.message : "error desconocido"
        }`,
      });
      throw kickErr;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Limpieza del Sistema // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("👢 Parásito Removido del Escuadrón")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        {
          name: "👤 Elemento Expulsado",
          value: `${target.tag} \`(${target.id})\``,
          inline: true,
        },
        {
          name: "🛡️ Supervisor al Cargo",
          value: `${interaction.user.tag}`,
          inline: true,
        },
        {
          name: "📝 Reporte de Salida",
          value: `\`\`\`\n${reason}\n\`\`\``,
          inline: false,
        },
        {
          name: "📬 Comunicación Externa",
          value: dmSent ? "✅ Canal DM Alertado" : "❌ Fallido / DM Privado",
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await sendModLog(client, interaction.guild?.id ?? "", embed, "kick");

    await logBotEvent({
      level: "warn",
      event: "kick",
      details: { reason },
      guildId: interaction.guild?.id,
      guildName: interaction.guild?.name,
      userId: target.id,
      username: target.username,
    });
  },
};

export default command;
