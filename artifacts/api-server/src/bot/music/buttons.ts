import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type GuildMember,
  type Interaction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import {
  continueMusicSession,
  musicManager,
  memberVoiceChannel,
  resolveTracks,
} from "./manager.js";
import {
  buildQueuePage,
  musicControls,
  musicEmbedFiles,
  musicNoticePayload,
  nowPlayingEmbed,
  queuePageButtons,
  stoppedEmbed,
} from "./embeds.js";
import { schedulePanelRefresh } from "./panel.js";
import { getMusicPanelConfig } from "./panelStore.js";
import { canControlMusic, canRequestMusic } from "./permissions.js";

function touchPanel(interaction: Interaction, guildId: string): void {
  schedulePanelRefresh(interaction.client, guildId);
}

function isUnknownInteraction(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: number | string; message?: string };
  return (
    e.code === 10062 ||
    e.code === "10062" ||
    /Unknown interaction/i.test(String(e.message ?? ""))
  );
}

/** Sync check: is this the configured panel message? (uses cache when warm) */
async function isPanelMessage(
  interaction: Interaction,
  guildId: string,
): Promise<boolean> {
  if (!interaction.isMessageComponent()) return false;
  try {
    const cfg = await getMusicPanelConfig(guildId);
    return Boolean(
      cfg?.enabled &&
        cfg.messageId &&
        interaction.message?.id === cfg.messageId,
    );
  } catch {
    return false;
  }
}

async function safeDeferUpdate(
  interaction: MessageComponentInteraction,
): Promise<boolean> {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferUpdate();
    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    return false;
  }
}

async function safeDeferReply(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  ephemeral = true,
): Promise<boolean> {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply({ ephemeral });
    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    return false;
  }
}

async function safeReply(
  interaction: Interaction,
  options: Parameters<ButtonInteraction["reply"]>[0],
): Promise<void> {
  if (!interaction.isRepliable()) return;
  try {
    if (interaction.deferred || interaction.replied) {
      if (interaction.isMessageComponent() && interaction.deferred) {
        // Already deferred as update — use followUp for feedback
        await interaction.followUp(
          typeof options === "string"
            ? { content: options, ephemeral: true }
            : { ...options, ephemeral: true },
        );
      } else {
        await interaction.followUp(
          typeof options === "string" ? { content: options } : options,
        );
      }
    } else {
      await interaction.reply(options);
    }
  } catch (err) {
    if (isUnknownInteraction(err)) return;
    // last resort
    try {
      if (interaction.isRepliable() && !interaction.replied) {
        await interaction.reply({
          content: "⚠️ Interacción expirada. Vuelve a pulsar el botón.",
          ephemeral: true,
        });
      }
    } catch {
      /* ignore */
    }
  }
}

async function safeUpdate(
  interaction: MessageComponentInteraction,
  options: Parameters<MessageComponentInteraction["update"]>[0],
): Promise<boolean> {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(options);
    } else {
      await interaction.update(options);
    }
    return true;
  } catch (err) {
    if (isUnknownInteraction(err)) return false;
    try {
      await interaction.editReply(options);
      return true;
    } catch {
      return false;
    }
  }
}

async function safeEditReply(
  interaction: Interaction,
  options: Parameters<ButtonInteraction["editReply"]>[0],
): Promise<void> {
  if (!interaction.isRepliable()) return;
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(options);
    }
  } catch (err) {
    if (isUnknownInteraction(err)) return;
  }
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
  await safeReply(interaction, payload);
}

/** Control actions that must ACK within 3s (deferUpdate first). */
const CONTROL_ACTIONS = new Set([
  "prev",
  "pause",
  "skip",
  "stop",
  "volup",
  "voldown",
  "loop",
  "shuffle",
  "clear",
  "leave",
]);

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

    const voice = memberVoiceChannel(member);
    if (!voice) {
      await deny(interaction, "❌ Entra a un canal de voz primero.");
      return true;
    }

    await safeDeferReply(interaction, true);

    let tracks;
    try {
      tracks = await resolveTracks(query, member);
    } catch (err) {
      await safeEditReply(
        interaction,
        musicNoticePayload(
          `❌ No se pudo buscar: ${err instanceof Error ? err.message : "error"}`,
          { kind: "error", client: interaction.client },
        ),
      );
      return true;
    }

    if (!tracks.length) {
      await safeEditReply(
        interaction,
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
        ? `📜 **Mix/playlist:** ${tracks.length} pistas añadidas a la cola.`
        : `➕ Añadida: **${tracks[0]!.title.slice(0, 80)}**`;

    await safeEditReply(
      interaction,
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

  // Continue saved session after bot restart
  if (action === "continue") {
    await safeDeferReply(interaction, true);
    const result = await continueMusicSession(
      interaction.client,
      guildId,
      member,
    );
    if (!result.ok) {
      await safeEditReply(
        interaction,
        musicNoticePayload(result.reason, {
          kind: "error",
          client: interaction.client,
        }),
      );
      return true;
    }
    const { formatDuration } = await import("./types.js");
    await safeEditReply(
      interaction,
      musicNoticePayload(
        [
          `▶️ **Sesión reanudada**`,
          `**${result.title.slice(0, 100)}**`,
          result.fromSec > 0
            ? `Desde \`${formatDuration(result.fromSec)}\``
            : null,
          result.queueLen
            ? `Cola: **${result.queueLen}** pista(s) pendiente(s)`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
        {
          kind: "ok",
          client: interaction.client,
          banner: true,
          title: "Zero Two Music · Continue",
        },
      ),
    );
    touchPanel(interaction, guildId);
    return true;
  }

  if (action === "add") {
    try {
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
    } catch (err) {
      if (!isUnknownInteraction(err)) {
        await deny(interaction, "❌ No se pudo abrir el formulario.");
      }
    }
    return true;
  }

  // Queue pagination — ACK with update immediately
  if (action === "qpage") {
    const pageStr = interaction.customId.split(":")[3];
    const page = Math.max(1, parseInt(pageStr || "1", 10) || 1);
    if (!session || (!session.current && !session.queue.length)) {
      await deny(interaction, "📭 La cola está vacía.");
      return true;
    }
    const { embed, page: p, totalPages } = buildQueuePage(
      interaction.client,
      session.current,
      session.queue,
      page,
    );
    const files = musicEmbedFiles();
    const components = queuePageButtons(guildId, p, totalPages);
    await safeUpdate(interaction, {
      embeds: [embed],
      components,
      files: files.length ? files : undefined,
    });
    return true;
  }

  if (action === "queue") {
    if (!session || (!session.current && !session.queue.length)) {
      await deny(interaction, "📭 La cola está vacía.");
      return true;
    }
    const { embed, page: p, totalPages } = buildQueuePage(
      interaction.client,
      session.current,
      session.queue,
      1,
    );
    const files = musicEmbedFiles();
    await safeReply(interaction, {
      embeds: [embed],
      components: queuePageButtons(guildId, p, totalPages),
      files: files.length ? files : undefined,
      ephemeral: true,
    });
    return true;
  }

  // ── Control buttons: ACK first (3s window), then permissions / work ─────
  if (CONTROL_ACTIONS.has(action)) {
    // Always deferUpdate first so DB lookups don't expire the interaction
    await safeDeferUpdate(interaction);
  }

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
      await safeReply(
        interaction,
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
      // Already deferred via deferUpdate — refresh panel / NP embed
      const onPanel = await isPanelMessage(interaction, guildId);
      if (!onPanel && session.current && interaction.deferred) {
        const files = musicEmbedFiles();
        await safeEditReply(interaction, {
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
        }).catch?.(() => null);
        // editReply on deferred update edits the original message — good for NP embed
      }
      touchPanel(interaction, guildId);
      return true;
    }
    case "skip": {
      const title = session.current?.title ?? "—";
      session.skip();
      await safeReply(
        interaction,
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
      if (!onPanelStop && interaction.deferred) {
        const files = musicEmbedFiles();
        await safeEditReply(interaction, {
          embeds: [stoppedEmbed(interaction.client)],
          components: [],
          files: files.length ? files : undefined,
        });
      }
      touchPanel(interaction, guildId);
      return true;
    }
    case "volup":
    case "voldown": {
      const v = session.adjustVolume(action === "volup" ? 10 : -10);
      // Feedback ephemeral (does not re-ACK)
      await safeReply(
        interaction,
        musicNoticePayload(`🔊 Volumen: **${v}%**`, {
          kind: "ok",
          client: interaction.client,
          ephemeral: true,
          title: "Zero Two Music · Volumen",
        }),
      );
      touchPanel(interaction, guildId);
      return true;
    }
    case "loop": {
      const mode = session.cycleLoop();
      const label =
        mode === "off" ? "Off" : mode === "track" ? "Pista 🔂" : "Cola 🔁";
      await safeReply(
        interaction,
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
      await safeReply(
        interaction,
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
      await safeReply(
        interaction,
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
      session.destroy(true);
      await safeReply(
        interaction,
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
