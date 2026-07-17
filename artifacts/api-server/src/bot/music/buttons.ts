import {
  EmbedBuilder,
  type GuildMember,
  type Interaction,
} from "discord.js";
import { musicManager, memberVoiceChannel } from "./manager.js";
import { musicControls, nowPlayingEmbed, queueEmbed } from "./embeds.js";

/**
 * Handle music control buttons (pause, skip, stop, loop, shuffle, queue, np).
 */
export async function handleMusicButtons(
  interaction: Interaction,
): Promise<boolean> {
  if (!interaction.isButton()) return false;
  const [ns, action, guildId] = interaction.customId.split(":");
  if (ns !== "music" || !action || !guildId) return false;
  if (!interaction.guild || interaction.guild.id !== guildId) {
    await interaction.reply({
      content: "❌ Sesión de otro servidor.",
      ephemeral: true,
    });
    return true;
  }

  const member = interaction.member as GuildMember;
  const voice = memberVoiceChannel(member);
  const session = musicManager.get(guildId);

  if (!session) {
    await interaction.reply({
      content: "❌ No hay música activa.",
      ephemeral: true,
    });
    return true;
  }

  if (!voice || voice.id !== session.voiceChannelId) {
    await interaction.reply({
      content: "❌ Entra al canal de voz del bot para usar los controles.",
      ephemeral: true,
    });
    return true;
  }

  switch (action) {
    case "pause": {
      if (session.paused) session.resume();
      else session.pause();
      if (session.current) {
        await interaction.update({
          embeds: [
            nowPlayingEmbed(interaction.client, session.current, {
              position: 1,
              queueLen: session.queue.length,
              volume: session.volume,
              loop: session.loop,
              paused: session.paused,
            }),
          ],
          components: musicControls(guildId, session.paused),
        });
      } else {
        await interaction.deferUpdate();
      }
      return true;
    }
    case "skip": {
      const title = session.current?.title ?? "—";
      session.skip();
      await interaction.reply({ content: `⏭️ Saltada: **${title.slice(0, 80)}**` });
      return true;
    }
    case "stop": {
      session.stop();
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff2d6b)
            .setDescription("⏹️ Reproducción detenida y cola vaciada."),
        ],
        components: [],
      });
      return true;
    }
    case "loop": {
      const mode = session.cycleLoop();
      const label =
        mode === "off" ? "Off" : mode === "track" ? "Track 🔂" : "Queue 🔁";
      await interaction.reply({ content: `Loop → **${label}**`, ephemeral: true });
      return true;
    }
    case "shuffle": {
      const n = session.shuffle();
      await interaction.reply({
        content: n ? `🔀 Cola mezclada (**${n}**)` : "❌ Cola vacía.",
        ephemeral: true,
      });
      return true;
    }
    case "queue": {
      await interaction.reply({
        embeds: [
          queueEmbed(
            interaction.client,
            session.current,
            session.queue,
            1,
          ),
        ],
        ephemeral: true,
      });
      return true;
    }
    case "np": {
      if (!session.current) {
        await interaction.reply({
          content: "❌ Nada sonando.",
          ephemeral: true,
        });
        return true;
      }
      await interaction.reply({
        embeds: [
          nowPlayingEmbed(interaction.client, session.current, {
            position: 1,
            queueLen: session.queue.length,
            volume: session.volume,
            loop: session.loop,
            paused: session.paused,
          }),
        ],
        components: musicControls(guildId, session.paused),
        ephemeral: true,
      });
      return true;
    }
    default:
      return false;
  }
}
