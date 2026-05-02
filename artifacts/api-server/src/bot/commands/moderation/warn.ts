import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client } from "discord.js";
import { Command } from "../../types.js";
import { db } from "@workspace/db";
import { warnsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("⚠️ Advierte a un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a advertir").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo de la advertencia").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const target = interaction.options.getUser("usuario", true);
    const reason = interaction.options.getString("motivo", true);

    const [warn] = await db.insert(warnsTable).values({
      guildId: interaction.guild?.id ?? "",
      userId: target.id,
      username: target.username,
      moderatorId: interaction.user.id,
      moderatorName: interaction.user.username,
      reason,
    }).returning();

    const warnCount = await db
      .select()
      .from(warnsTable)
      .then((rows) => rows.filter((r) => r.userId === target.id && r.guildId === (interaction.guild?.id ?? "")));

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("⚠️ Advertencia Registrada")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "Usuario", value: `${target.tag} (${target.id})`, inline: true },
        { name: "Moderador", value: `${interaction.user.tag}`, inline: true },
        { name: "Total advertencias", value: `${warnCount.length}`, inline: true },
        { name: "Motivo", value: reason },
        { name: "ID Advertencia", value: `#${warn?.id}`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() });

    await target.send({
      embeds: [new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle(`Has recibido una advertencia en ${interaction.guild?.name}`)
        .addFields(
          { name: "Motivo", value: reason },
          { name: "Total advertencias", value: `${warnCount.length}` }
        )
        .setTimestamp()]
    }).catch(() => null);

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
