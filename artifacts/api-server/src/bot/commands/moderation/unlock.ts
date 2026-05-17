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
    .setName("unlock")
    .setDescription(
      "🔓 Levanta el cierre de seguridad permitiendo transmisiones normales",
    )
    .addBooleanOption((opt) =>
      opt
        .setName("global")
        .setDescription("¿Restaurar canales abiertos masivamente?"),
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const isGlobal = interaction.options.getBoolean("global") ?? false;
    const everyone = interaction.guild?.roles.everyone;

    if (!everyone)
      return interaction.reply({
        content: "❌ Rol base desincronizado.",
        ephemeral: true,
      });

    await interaction.deferReply();

    const channelsToUnlock: TextChannel[] = [];
    if (isGlobal) {
      interaction.guild?.channels.cache
        .filter((c) => c.isTextBased() && !c.isThread())
        .forEach((c) => channelsToUnlock.push(c as TextChannel));
    } else {
      channelsToUnlock.push(interaction.channel as TextChannel);
    }

    let successCount = 0;
    for (const channel of channelsToUnlock) {
      try {
        await channel.permissionOverwrites.edit(
          everyone,
          { SendMessages: null },
          { reason: `Unlock por ${interaction.user.tag}` },
        );
        successCount++;
      } catch {
        continue;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Restauración Atmosférica // Zero Two",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("🔓 Zonas de Comunicación Desbloqueadas")
      .addFields(
        {
          name: "🌍 Frecuencia",
          value: isGlobal
            ? `\`Global (${successCount} zonas)\``
            : `<#${interaction.channelId}>`,
          inline: true,
        },
        {
          name: "🛡️ Autorizado por",
          value: `${interaction.user.tag}`,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
