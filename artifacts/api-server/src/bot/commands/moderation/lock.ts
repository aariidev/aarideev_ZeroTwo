import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  TextChannel,
} from "discord.js";
import { Command } from "../../types.js";
import { logBotEvent } from "../../../lib/botLogger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription(
      "🔒 Cierra los canales de texto bloqueando el envío de transmisiones",
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Causa del bloqueo del sector"),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("global")
        .setDescription("¿Bloquear todos los canales públicos esenciales?"),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const reason =
      interaction.options.getString("motivo") ??
      "Cuarentena de seguridad activa.";
    const isGlobal = interaction.options.getBoolean("global") ?? false;
    const everyone = interaction.guild?.roles.everyone;

    if (!everyone)
      return interaction.reply({
        content: "❌ Imposible mapear el rol base `@everyone`.",
        ephemeral: true,
      });

    await interaction.deferReply();

    const channelsToLock: TextChannel[] = [];
    if (isGlobal) {
      const allText = interaction.guild?.channels.cache.filter(
        (c) => c.isTextBased() && !c.isThread() && !c.isDMBased(),
      );
      allText?.forEach((c) => channelsToLock.push(c as TextChannel));
    } else {
      channelsToLock.push(interaction.channel as TextChannel);
    }

    let successCount = 0;
    for (const channel of channelsToLock) {
      try {
        await channel.permissionOverwrites.edit(
          everyone,
          { SendMessages: false },
          { reason: `Lock: ${reason} | Por: ${interaction.user.tag}` },
        );
        successCount++;
      } catch {
        continue;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Contención Perimetral // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🔒 Protocolo Lock Completo")
      .addFields(
        {
          name: "🌍 Cobertura",
          value: isGlobal
            ? `\`Múltiple (${successCount} zonas afectadas)\``
            : `<#${interaction.channelId}>`,
          inline: true,
        },
        {
          name: "🛡️ Activado por",
          value: `${interaction.user.tag}`,
          inline: true,
        },
        {
          name: "📝 Justificación de Alerta",
          value: `\`\`\`\n${reason}\n\`\`\``,
          inline: false,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    await logBotEvent({
      level: "warn",
      event: "lock",
      details: { reason, totalChannels: successCount },
      guildId: interaction.guild?.id,
      guildName: interaction.guild?.name,
    });
  },
};

export default command;
