import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Client, TextChannel } from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("🧹 Elimina mensajes del canal")
    .addIntegerOption((opt) =>
      opt.setName("cantidad").setDescription("Cantidad de mensajes a eliminar (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Filtrar mensajes de un usuario específico")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const amount = interaction.options.getInteger("cantidad", true);
    const targetUser = interaction.options.getUser("usuario");
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    const messages = await channel.messages.fetch({ limit: 100 });
    let toDelete = [...messages.values()].slice(0, amount);

    if (targetUser) {
      toDelete = toDelete.filter((m) => m.author.id === targetUser.id).slice(0, amount);
    }

    // Only delete messages newer than 14 days
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    toDelete = toDelete.filter((m) => m.createdTimestamp > twoWeeksAgo);

    const deleted = await channel.bulkDelete(toDelete, true);

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🧹 Mensajes Eliminados")
        .setDescription(`Se eliminaron **${deleted.size}** mensajes.${targetUser ? ` (filtrado por ${targetUser.tag})` : ""}`)
        .setTimestamp()
        .setFooter({ text: "ZeroTwo v2.0", iconURL: client.user?.displayAvatarURL() })]
    });
  },
};

export default command;
