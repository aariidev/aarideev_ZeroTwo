import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember,
  type Interaction,
} from "discord.js";
import { musicManager, memberVoiceChannel, resolveTracks } from "./manager.js";
import {
  musicControls,
  musicEmbedFiles,
  musicNoticePayload,
  nowPlayingEmbed,
  queueEmbed,
  stoppedEmbed,
} from "./embeds.js";
import { schedulePanelRefresh } from "./panel.js";
import { getMusicPanelConfig } from "./panelStore.js";
import { canControlMusic, canRequestMusic } from "./permissions.js";

function touchPanel(interaction: Interaction, guildId: string): void {
  schedulePanelRefresh(interaction.client, guildId);
}

async function isPanelMessage(
  interaction: Interaction,
  guildId: string,
): Promise<boolean> {
  if (!interaction.isMessageComponent()) return false;
  const cfg = await getMusicPanelConfig(guildId);
  return Boolean(
    cfg?.enabled &&
      cfg.messageId &&
      interaction.message?.id === cfg.messageId,
  );
}

async function deny(
  interaction: Interaction,
  reason: string,
): Promise<void> {
  const payload = musicNoticePayload(reason, {
    kind: "error",
    client: interaction.client,
    ephemeral: true,
  });
  if (interaction.isRepliable()) {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
}

/**
 * Handle music control buttons + play modal (panel / NP embeds).
 */
export async function handleMusicButtons(
  interaction: Interaction,
): Promise<boolean> {
  // Modal submit: add track from panel
  if (interaction.isModalSubmit()) {
    const [ns, kind, guildId] = interaction.customId.split(":");
    if (ns !== "music" || kind !== "playmodal" || !guildId) return false;
    if (!interaction.guild || interaction.guild.id !== guildId) {
      await deny(interaction, "❌ Sesión de otro servidor.");
      return true;
    }

    const query = interaction.fields.getTextInputValue("query")?.trim();
    if (!query) {
      await deny(interaction, "❌ Escribe un nombre o URL.");
      return true;
    }

    const member = interaction.member as GuildMember;
    const sessionExisting = musicManager.get(guildId);
    const req = canRequestMusic(member, sessionExisting);
    if (!req.ok) {
      await deny(interaction, req.reason);
      return true;
    }

    const voice = memberVoiceChannel(member)!;
    await interaction.deferReply({ ephemeral: true });

    let tracks;
    try {
      tracks = await resolveTracks(query, member);
    } catch (err) {
      await interaction.editReply(
        musicNoticePayload(
          `❌ No se pudo buscar: ${err instanceof Error ? err.message : "error"}`,
          { kind: "error", client: interaction.client },
        ),
      );
      return true;
    }

    if (!tracks.length) {
      await interaction.editReply(
        musicNoticePayload("❌ Sin resultados. Prueba otra búsqueda o URL.", {
          kind: "error",
          client: interaction.client,
        }),
      );
      return true;
    }

    const session = musicManager.getOrCreate(guildId, interaction.client);
    session.connect(voice);
    await session.enqueue(tracks, interaction.channelId);

    const title =
      tracks.length > 1
        ? `📜 **${tracks.length}** pistas añadidas a la cola.`
        : `➕ Añadida: **${tracks[0]!.title.slice(0, 80)}**`;

    await interaction.editReply(
      musicNoticePayload(title, {
        kind: "ok",
        client: interaction.client,
        title: "Zero Two Music · Añadido",
      }),
    );
    touchPanel(interaction, guildId);
    return true;
  }

  if (!interaction.isButton()) return false;
  const [ns, action, guildId] = interaction.customId.split(":");
  if (ns !== "music" || !action || !guildId) return false;
  if (!interaction.guild || interaction.guild.id !== guildId) {
    await deny(interaction, "❌ Esta sesión pertenece a otro servidor.");
    return true;
  }

  const member = interaction.member as GuildMember;
  const session = musicManager.get(guildId);

  // "Añadir" → modal (no control perm beyond being able to open it)
  if (action === "add") {
    const modal = new ModalBuilder()
      .setCustomId(`music:playmodal:${guildId}`)
      .setTitle("Añadir canción")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("query")
            .setLabel("Nombre, YouTube o Spotify")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("ej: Bohemian Rhapsody · o un enlace")
            .setRequired(true)
            .setMaxLength(200),
        ),
      );
    await interaction.showModal(modal);
    return true;
  }

  // Queue view: anyone can peek (ephemeral)
  if (action === "queue") {
    if (!session || (!session.current && !session.queue.length)) {
      await deny(interaction, "📭 La cola está vacía.");
      return true;
    }
    const files = musicEmbedFiles();
    await interaction.reply({
      embeds: [
        queueEmbed(
          interaction.client,
          session.current,
          session.queue,
          1,
        ),
      ],
      files: files.length ? files : undefined,
      ephemeral: true,
    });
    return true;
  }

  // Control actions need DJ / same voice
  const perm = await canControlMusic(member, session);
  if (!perm.ok) {
    await deny(interaction, perm.reason);
    return true;
  }

  if (!session) {
    await deny(interaction, "❌ No hay música activa.");
    return true;
  }

  switch (action) {
    case "prev": {
      const ok = await session.previous();
      await interaction.reply(
        musicNoticePayload(
          ok
            ? "⏮️ Reproduciendo la pista **anterior**."
            : "❌ No hay pistas en el historial.",
          {
            kind: ok ? "ok" : "error",
            client: interaction.client,
            ephemeral: true,
            title: "Zero Two Music · Anterior",
          },
        ),
      );
      touchPanel(interaction, guildId);
      return true;
    }
    case "pause": {
      if (session.paused) session.resume();
      else session.pause();
      const onPanel = await isPanelMessage(interaction, guildId);
      if (onPanel) {
        await interaction.deferUpdate();
        touchPanel(interaction, guildId);
      } else if (session.current) {
        const files = musicEmbedFiles();
        try {
          await interaction.update({
            embeds: [
              nowPlayingEmbed(interaction.client, session.current, {
                position: 1,
                queueLen: session.queue.length,
                volume: session.volume,
                loop: session.loop,
                paused: session.paused,
                playbackSec: session.playbackSec,
                hasHistory: session.hasHistory,
              }),
            ],
            components: musicControls(
              guildId,
              session.paused,
              session.hasHistory,
            ),
            files: files.length ? files : undefined,
          });
        } catch {
          await interaction.deferUpdate().catch(() => null);
        }
        touchPanel(interaction, guildId);
      } else {
        await interaction.deferUpdate();
      }
      return true;
    }
    case "skip": {
      const title = session.current?.title ?? "—";
      session.skip();
      await interaction.reply(
        musicNoticePayload(`⏭️ Saltada: **${title.slice(0, 80)}**`, {
          kind: "ok",
          client: interaction.client,
          ephemeral: true,
          title: "Zero Two Music · Saltar",
        }),
      );
      touchPanel(interaction, guildId);
      return true;
    }
    case "stop": {
      session.stop();
      const onPanelStop = await isPanelMessage(interaction, guildId);
      if (onPanelStop) {
        await interaction.deferUpdate();
      } else {
        try {
          await interaction.update({
            embeds: [stoppedEmbed(interaction.client)],
            components: [],
            files: musicEmbedFiles(),
          });
        } catch {
          await interaction.reply(
            musicNoticePayload("⏹️ Reproducción detenida y cola vaciada.", {
              kind: "ok",
              client: interaction.client,
              ephemeral: true,
            }),
          );
        }
      }
      touchPanel(interaction, guildId);
      return true;
    }
    case "volup":
    case "voldown": {
      const v = session.adjustVolume(action === "volup" ? 10 : -10);
      const onPanel = await isPanelMessage(interaction, guildId);
      if (onPanel) {
        await interaction.deferUpdate();
      } else {
        await interaction.reply(
          musicNoticePayload(`🔊 Volumen: **${v}%**`, {
            kind: "ok",
            client: interaction.client,
            ephemeral: true,
            title: "Zero Two Music · Volumen",
          }),
        );
      }
      touchPanel(interaction, guildId);
      return true;
    }
    case "loop": {
      const mode = session.cycleLoop();
      const label =
        mode === "off" ? "Off" : mode === "track" ? "Pista 🔂" : "Cola 🔁";
      await interaction.reply(
        musicNoticePayload(`🔁 Loop cambiado a **${label}**`, {
          kind: "ok",
          client: interaction.client,
          ephemeral: true,
          title: "Zero Two Music · Loop",
        }),
      );
      touchPanel(interaction, guildId);
      return true;
    }
    case "shuffle": {
      const n = session.shuffle();
      await interaction.reply(
        musicNoticePayload(
          n
            ? `🔀 Cola mezclada (**${n}** pistas).`
            : "❌ La cola está vacía.",
          {
            kind: n ? "ok" : "error",
            client: interaction.client,
            ephemeral: true,
            title: "Zero Two Music · Mezclar",
          },
        ),
      );
      touchPanel(interaction, guildId);
      return true;
    }
    case "clear": {
      const n = session.clearQueue();
      await interaction.reply(
        musicNoticePayload(
          n
            ? `🗑️ Cola vaciada (**${n}** pistas eliminadas). La actual sigue sonando.`
            : "📭 La cola ya estaba vacía.",
          {
            kind: n ? "ok" : "info",
            client: interaction.client,
            ephemeral: true,
            title: "Zero Two Music · Vaciar cola",
          },
        ),
      );
      touchPanel(interaction, guildId);
      return true;
    }
    case "leave": {
      session.destroy();
      await interaction.reply(
        musicNoticePayload("👋 Bot desconectado del canal de voz.", {
          kind: "ok",
          client: interaction.client,
          ephemeral: true,
          title: "Zero Two Music · Salir",
        }),
      );
      touchPanel(interaction, guildId);
      return true;
    }
    default:
      return false;
  }
}
