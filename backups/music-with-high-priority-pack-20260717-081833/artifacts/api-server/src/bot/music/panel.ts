/**
 * Panel persistente de música: publicar y refrescar el mensaje del canal configurado.
 */
import {
  ChannelType,
  type Client,
  type GuildTextBasedChannel,
  type Message,
  type TextChannel,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import {
  musicEmbedFiles,
  musicPanelControls,
  musicPanelEmbed,
} from "./embeds.js";
import { musicManager } from "./manager.js";
import {
  getMusicPanelConfig,
  saveMusicPanelConfig,
  type MusicPanelConfig,
} from "./panelStore.js";

/** Debounce refreshes so skip/play storms don't rate-limit Discord. */
const refreshTimers = new Map<string, NodeJS.Timeout>();

export function schedulePanelRefresh(client: Client, guildId: string): void {
  const prev = refreshTimers.get(guildId);
  if (prev) clearTimeout(prev);
  refreshTimers.set(
    guildId,
    setTimeout(() => {
      refreshTimers.delete(guildId);
      void refreshMusicPanel(client, guildId);
    }, 350),
  );
}

function buildPanelView(client: Client, guildId: string, cfg: MusicPanelConfig) {
  const session = musicManager.get(guildId);
  const embed = musicPanelEmbed(client, {
    current: session?.current ?? null,
    queueLen: session?.queue.length ?? 0,
    volume: session?.volume ?? 80,
    loop: session?.loop ?? "off",
    paused: session?.paused ?? false,
    voiceChannelId: session?.voiceChannelId ?? null,
    playbackSec: session?.playbackSec ?? 0,
    hasHistory: session?.hasHistory ?? false,
    djRoleId: cfg.djRoleId,
  });
  const components = musicPanelControls(
    guildId,
    session?.paused ?? false,
    session?.hasHistory ?? false,
  );
  return { embed, components };
}

export async function refreshMusicPanel(
  client: Client,
  guildId: string,
): Promise<boolean> {
  const cfg = await getMusicPanelConfig(guildId);
  if (!cfg?.enabled || !cfg.channelId || !cfg.messageId) return false;

  try {
    const ch = await client.channels.fetch(cfg.channelId).catch(() => null);
    if (!ch || !ch.isTextBased() || ch.isDMBased()) return false;

    const { embed, components } = buildPanelView(client, guildId, cfg);
    // On live ticks, skip re-uploading the GIF to reduce rate limits / bandwidth
    const files = musicEmbedFiles();

    const msg = await (ch as TextChannel).messages
      .fetch(cfg.messageId)
      .catch(() => null);

    if (!msg) {
      const sent = await (ch as TextChannel).send({
        embeds: [embed],
        components,
        files: files.length ? files : undefined,
      });
      await saveMusicPanelConfig({
        ...cfg,
        messageId: sent.id,
      });
      return true;
    }

    await msg.edit({
      embeds: [embed],
      components,
      // Keep attachment reference stable if already present; re-upload only if needed
      files: msg.attachments.size === 0 && files.length ? files : undefined,
    });
    return true;
  } catch (err) {
    logger.warn({ err, guildId }, "music panel: refresh failed");
    return false;
  }
}

/**
 * Publica (o reemplaza) el panel en un canal y guarda la config.
 */
export async function publishMusicPanel(
  client: Client,
  guildId: string,
  channel: GuildTextBasedChannel,
  extras?: { djRoleId?: string | null },
): Promise<{ config: MusicPanelConfig; message: Message }> {
  const prev = await getMusicPanelConfig(guildId);
  if (prev?.channelId && prev.messageId) {
    try {
      const oldCh = await client.channels.fetch(prev.channelId).catch(() => null);
      if (oldCh && oldCh.isTextBased() && !oldCh.isDMBased()) {
        await (oldCh as TextChannel).messages
          .delete(prev.messageId)
          .catch(() => null);
      }
    } catch {
      /* ignore */
    }
  }

  const djRoleId =
    extras?.djRoleId !== undefined ? extras.djRoleId : (prev?.djRoleId ?? null);

  const draft: MusicPanelConfig = {
    guildId,
    channelId: channel.id,
    messageId: null,
    djRoleId,
    enabled: true,
  };

  const { embed, components } = buildPanelView(client, guildId, draft);
  const files = musicEmbedFiles();

  if (
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.GuildAnnouncement
  ) {
    throw new Error("Canal inválido para el panel");
  }

  const message = await channel.send({
    embeds: [embed],
    components,
    files: files.length ? files : undefined,
  });

  const config: MusicPanelConfig = {
    ...draft,
    messageId: message.id,
  };
  await saveMusicPanelConfig(config);
  return { config, message };
}
