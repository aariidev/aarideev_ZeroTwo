/**
 * Zero Two as primary music bot: disconnect competing bots from the same VC.
 */
import {
  PermissionFlagsBits,
  type Client,
  type Guild,
  type GuildMember,
  type VoiceBasedChannel,
  type VoiceState,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import { isCapOtherBotsEnabled } from "./panelStore.js";
import { musicManager } from "./manager.js";

/** Common music bot application names/tags heuristics (secondary to isBot). */
function looksLikeMusicBot(member: GuildMember): boolean {
  if (!member.user.bot) return false;
  // Don't kick ourselves
  if (member.id === member.client.user?.id) return false;
  return true; // all other bots in the VC when cap is on
}

export async function disconnectOtherBotsInChannel(
  channel: VoiceBasedChannel,
  reason = "Zero Two es el bot de música principal",
): Promise<number> {
  const me = channel.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.MoveMembers)) {
    logger.warn(
      { guildId: channel.guild.id },
      "music cap: falta permiso Desconectar miembros",
    );
    return 0;
  }

  let n = 0;
  for (const [, member] of channel.members) {
    if (!looksLikeMusicBot(member)) continue;
    try {
      await member.voice.disconnect(reason);
      n++;
    } catch (err) {
      logger.warn(
        { err, botId: member.id },
        "music cap: no se pudo desconectar bot",
      );
    }
  }
  return n;
}

/** Call when Zero Two joins / starts music in a channel. */
export async function enforcePrimaryMusicBot(
  guild: Guild,
  voiceChannelId: string | null,
): Promise<void> {
  if (!voiceChannelId) return;
  if (!(await isCapOtherBotsEnabled(guild.id))) return;

  const ch = await guild.channels.fetch(voiceChannelId).catch(() => null);
  if (!ch || !ch.isVoiceBased()) return;

  const kicked = await disconnectOtherBotsInChannel(ch);
  if (kicked > 0) {
    logger.info(
      { guildId: guild.id, kicked, channelId: voiceChannelId },
      "music cap: bots desconectados",
    );
  }
}

/**
 * voiceStateUpdate: if another bot joins our music channel, kick them.
 */
export function registerMusicBotCap(client: Client): void {
  client.on("voiceStateUpdate", (oldState: VoiceState, newState: VoiceState) => {
    void handleVoiceCap(oldState, newState);
  });
}

async function handleVoiceCap(
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  const guild = newState.guild ?? oldState.guild;
  if (!guild) return;
  if (!(await isCapOtherBotsEnabled(guild.id))) return;

  const session = musicManager.get(guild.id);
  const ourChannelId = session?.voiceChannelId;
  if (!ourChannelId) return;

  const meId = guild.client.user?.id;
  const member = newState.member ?? oldState.member;
  if (!member?.user.bot) return;
  if (member.id === meId) return;

  // Bot joined or moved into our music channel
  const joinedOur =
    newState.channelId === ourChannelId &&
    oldState.channelId !== ourChannelId;

  // Bot was already there / reconnected
  const stillInOurs = newState.channelId === ourChannelId;

  if (!joinedOur && !stillInOurs) return;
  // Only act on join/move into our channel
  if (!joinedOur && oldState.channelId === ourChannelId) return;

  if (joinedOur) {
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.MoveMembers)) return;
    try {
      await member.voice.disconnect(
        "Zero Two es el bot de música principal de este servidor",
      );
      logger.info(
        { guildId: guild.id, botId: member.id },
        "music cap: bot rival expulsado del VC",
      );
    } catch (err) {
      logger.warn({ err }, "music cap: disconnect failed");
    }
  }
}
