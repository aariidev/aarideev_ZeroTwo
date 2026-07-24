import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import { musicManager } from "../../music/manager.js";
import {
  buildQueuePage,
  musicEmbedFiles,
  musicNoticePayload,
  queuePageButtons,
} from "../../music/embeds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("📋 Cola de reproducción — páginas y orden")
    .addIntegerOption((o) =>
      o
        .setName("pagina")
        .setDescription("Página de la cola")
        .setMinValue(1)
        .setRequired(false),
    ),
  cooldown: 2,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({
        ...musicNoticePayload("❌ Solo en servidores.", {
          kind: "error",
          client,
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const session = musicManager.get(interaction.guild.id);
    if (!session || (!session.current && !session.queue.length)) {
      await interaction.reply({
        ...musicNoticePayload(
          "📭 La cola está vacía.\nUsa **`/play`** para añadir pistas.",
          { kind: "info", client, banner: true, title: "Zero Two Music · Cola" },
        ),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const page = interaction.options.getInteger("pagina") ?? 1;
    const { embed, page: p, totalPages } = buildQueuePage(
      client,
      session.current,
      session.queue,
      page,
    );
    const files = musicEmbedFiles();
    await interaction.reply({
      embeds: [embed],
      components: queuePageButtons(interaction.guild.id, p, totalPages),
      files: files.length ? files : undefined,
    });
  },
};

export default command;
