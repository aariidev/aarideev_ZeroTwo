import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";
import { db } from "@workspace/db";
import { warnsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clearwarns")
    .setDescription("🗑️ Elimina todas las advertencias de un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const guildId = interaction.guild?.id ?? "";

    const deleted = await db
      .delete(warnsTable)
      .where(and(eq(warnsTable.userId, target.id), eq(warnsTable.guildId, guildId)))
      .returning();

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("🗑️ Advertencias Eliminadas")
      .setDescription(`Se eliminaron **${deleted.length}** advertencias de ${target.tag}.`)
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
