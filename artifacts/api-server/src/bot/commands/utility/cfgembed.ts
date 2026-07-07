import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import { Command } from "../../types.js";
import {
  activeSessions,
  buildPanelEmbed,
  buildPreviewEmbed,
  buildSectionMenu,
  buildActionButtons,
} from "../../builders/cfgembed.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("cfgembed")
    .setDescription("🎨 Constructor interactivo de embeds personalizados")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption((opt) =>
      opt
        .setName("canal")
        .setDescription("Canal donde se enviará el embed (por defecto: este canal)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false),
    ) as SlashCommandBuilder,

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const userId = interaction.user.id;

    if (activeSessions.has(userId)) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setAuthor({
              name: "ZeroTwo · Constructor de Embeds",
              iconURL: client.user?.displayAvatarURL(),
            })
            .setDescription(
              "❌ Ya tienes un constructor abierto.\n" +
                "Ciérralo con **Cancelar** antes de iniciar uno nuevo.",
            ),
        ],
        ephemeral: true,
      });
      return;
    }

    const targetChannel =
      interaction.options.getChannel("canal") ?? interaction.channel;

    if (!targetChannel) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription("❌ No se pudo determinar el canal de destino."),
        ],
        ephemeral: true,
      });
      return;
    }

    // Fetch bot's banner (requires full user fetch)
    let botBannerURL: string | null = null;
    try {
      const botUser = await client.users.fetch(client.user!.id, { force: true });
      botBannerURL = botUser.bannerURL({ size: 1024 }) ?? null;
    } catch {
      // no banner configured — that's fine
    }

    const state = {
      color: 0xec4899,
      fields: [] as { name: string; value: string; inline: boolean }[],
      targetChannelId: targetChannel.id,
      originalInteraction: interaction,
      botBannerURL,
      imageURL: botBannerURL ?? undefined,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };

    activeSessions.set(userId, state);

    const botIcon = client.user?.displayAvatarURL();

    await interaction.reply({
      embeds: [buildPanelEmbed(state, botIcon), buildPreviewEmbed(state, botIcon)],
      components: [buildSectionMenu(userId), buildActionButtons(userId)],
      ephemeral: true,
    });
  },
};

export default command;
