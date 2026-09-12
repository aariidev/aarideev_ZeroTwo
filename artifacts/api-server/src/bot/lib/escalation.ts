/**
 * Automatic warn escalation system.
 * Applies automatic actions when a user reaches certain warn thresholds.
 */
import { Client, GuildMember, EmbedBuilder, TextChannel } from "discord.js";
import { countWarns, listWarns } from "./warns.js";
import { logger } from "../../lib/logger.js";

export interface EscalationConfig {
  guildId: string;
  enabled: boolean;
  muteAt: number; // Mute user after X warns
  kickAt: number; // Kick user after X warns
  banAt: number; // Ban user after X warns
  notifyChannel?: string; // Channel to notify mods
}

// Default escalation thresholds
const DEFAULT_CONFIG: Partial<EscalationConfig> = {
  enabled: true,
  muteAt: 5,
  kickAt: 8,
  banAt: 10,
};

// In-memory cache for escalation configs (in production, use database)
const escalationConfigs = new Map<string, EscalationConfig>();

export async function getEscalationConfig(
  guildId: string,
): Promise<EscalationConfig> {
  if (escalationConfigs.has(guildId)) {
    return escalationConfigs.get(guildId)!;
  }

  const config: EscalationConfig = {
    guildId,
    ...DEFAULT_CONFIG,
  } as EscalationConfig;

  escalationConfigs.set(guildId, config);
  return config;
}

export async function setEscalationConfig(
  guildId: string,
  config: Partial<EscalationConfig>,
): Promise<void> {
  const current = await getEscalationConfig(guildId);
  const updated: EscalationConfig = { ...current, ...config, guildId };
  escalationConfigs.set(guildId, updated);
  logger.info({ guildId, config: updated }, "Escalation config updated");
}

export async function checkAndApplyEscalation(
  client: Client,
  guildId: string,
  userId: string,
  memberName: string,
): Promise<{ action?: string; applied: boolean; reason?: string }> {
  try {
    const config = await getEscalationConfig(guildId);
    if (!config.enabled) {
      return { applied: false };
    }

    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId).catch(() => null);

    if (!member) {
      return { applied: false, reason: "Member not found" };
    }

    const warnCount = await countWarns(guildId, userId);
    const me = guild.members.me;

    if (!me) {
      return { applied: false, reason: "Bot not in guild" };
    }

    // Check ban threshold
    if (config.banAt && warnCount >= config.banAt) {
      if (me.permissions.has("BanMembers")) {
        await member.ban({
          reason: `Automatic ban: ${warnCount} warns reached threshold (${config.banAt})`,
        });

        await notifyMods(
          client,
          guildId,
          config.notifyChannel,
          `🔴 **Automatic Ban** — ${memberName} (${userId}) has been banned after reaching ${warnCount} warns.`,
        );

        return { action: "ban", applied: true };
      }
    }

    // Check kick threshold
    if (config.kickAt && warnCount >= config.kickAt && warnCount < config.banAt) {
      if (me.permissions.has("KickMembers")) {
        await member.kick(
          `Automatic kick: ${warnCount} warns reached threshold (${config.kickAt})`,
        );

        await notifyMods(
          client,
          guildId,
          config.notifyChannel,
          `🟡 **Automatic Kick** — ${memberName} (${userId}) has been kicked after reaching ${warnCount} warns.`,
        );

        return { action: "kick", applied: true };
      }
    }

    // Check mute threshold
    if (config.muteAt && warnCount >= config.muteAt && warnCount < config.kickAt) {
      if (me.permissions.has("ModerateMembers")) {
        const muteDuration = 60 * 60 * 1000; // 1 hour
        await member.timeout(
          muteDuration,
          `Automatic mute: ${warnCount} warns reached threshold (${config.muteAt})`,
        );

        await notifyMods(
          client,
          guildId,
          config.notifyChannel,
          `🟠 **Automatic Mute** — ${memberName} (${userId}) has been muted for 1 hour after reaching ${warnCount} warns.`,
        );

        return { action: "mute", applied: true };
      }
    }

    return { applied: false };
  } catch (error) {
    logger.error(
      { guildId, userId, error },
      "Error checking escalation",
    );
    return { applied: false, reason: String(error) };
  }
}

async function notifyMods(
  client: Client,
  guildId: string,
  channelId: string | undefined,
  message: string,
): Promise<void> {
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle("⚠️ Automatic Moderation Action")
        .setDescription(message)
        .setColor(0xf59e0b)
        .setTimestamp();

      await (channel as TextChannel).send({ embeds: [embed] });
    }
  } catch (error) {
    logger.warn(
      { guildId, channelId, error },
      "Failed to notify mods channel",
    );
  }
}

export async function getInfractionHistory(
  guildId: string,
  userId: string,
): Promise<{
  total: number;
  recent: Array<{
    date: string;
    reason: string;
    moderator: string;
  }>;
}> {
  const warns = await listWarns(guildId, userId);
  return {
    total: warns.length,
    recent: warns.slice(0, 10).map((w) => ({
      date: new Date(w.createdAt).toISOString().split("T")[0],
      reason: w.reason,
      moderator: w.moderatorName,
    })),
  };
}
