import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";
import { db } from "@workspace/db";
import { warnsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warns")
    .setDescription("📋 Ver las advertencias de un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a consultar").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const guildId = interaction.guild?.id ?? "";

    const userWarns = await db
      .select()
      .from(warnsTable)
      .where(and(eq(warnsTable.userId, target.id), eq(warnsTable.guildId, guildId)))
      .orderBy(desc(warnsTable.createdAt));

    if (userWarns.length === 0) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x00ff00)
          .setDescription(`${target.username} no tiene advertencias en este servidor.`)],
        ephemeral: true
      });
    }

    const warnsText = userWarns.slice(0, 10).map((w, i) =>
      `\`#${w.id}\` **${i + 1}.** ${w.reason}\n  Por: <@${w.moderatorId}> • <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`
    ).join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle(`⚠️ Advertencias de ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(warnsText)
      .addFields({ name: "Total", value: `${userWarns.length}`, inline: true })
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
