import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  GuildMember,
} from "discord.js";
import { Command } from "../../types.js";
import { musicManager } from "../../music/manager.js";
import { musicNoticePayload } from "../../music/embeds.js";
import { canControlMusic } from "../../music/permissions.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("🔊 Cambia el volumen del bot (0–150)")
    .addIntegerOption((o) =>
      o
        .setName("nivel")
        .setDescription("Volumen 0–150")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(150),
    ),
  cooldown: 2,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client;
    if (!interaction.guild) {
      await interaction.reply({
        ...musicNoticePayload("❌ Solo en servidores.", { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const member = interaction.member as GuildMember;
    const session = musicManager.get(interaction.guild.id);
    const perm = await canControlMusic(member, session);
    if (!perm.ok) {
      await interaction.reply({
        ...musicNoticePayload(perm.reason, { kind: "error", client }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const nivel = interaction.options.getInteger("nivel", true);
    const v = session!.setVolume(nivel);
    await interaction.reply(
      musicNoticePayload(`🔊 Volumen ajustado a **${v}%**`, {
        kind: "ok",
        client,
        banner: true,
        title: "Zero Two Music · Volumen",
      }),
    );
  },
};

export default command;
