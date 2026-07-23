/**
 * Quién puede controlar la música (skip, stop, volumen, etc.).
 *
 * Reglas:
 * 1. Debe estar en el mismo canal de voz que el bot (si hay sesión).
 * 2. Si hay rol DJ configurado → debe tenerlo (o Manage Guild / Admin).
 * 3. Sin rol DJ → cualquiera en el canal de voz del bot.
 * 4. Añadir canciones: solo hace falta estar en un canal de voz (el del bot o uno vacío).
 */
import {
  PermissionFlagsBits,
  type GuildMember,
} from "discord.js";
import type { GuildMusicSession } from "./manager.js";
import { getMusicPanelConfig } from "./panelStore.js";
import { memberVoiceChannel } from "./manager.js";

export type MusicPermResult = { ok: true } | { ok: false; reason: string };

function isGuildManager(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

/** Controles de la sesión activa (skip, pause, stop, loop, shuffle, prev, vol, clear, leave). */
export async function canControlMusic(
  member: GuildMember,
  session: GuildMusicSession | undefined | null,
): Promise<MusicPermResult> {
  if (!session) {
    return { ok: false, reason: "❌ No hay sesión de música activa." };
  }

  const voice = memberVoiceChannel(member);
  if (!voice || !session.voiceChannelId || voice.id !== session.voiceChannelId) {
    return {
      ok: false,
      reason: "❌ Entra al **canal de voz del bot** para controlar la música.",
    };
  }

  if (isGuildManager(member)) return { ok: true };

  const cfg = await getMusicPanelConfig(member.guild.id);
  const djRoleId = cfg?.djRoleId ?? null;
  if (djRoleId) {
    if (member.roles.cache.has(djRoleId)) return { ok: true };
    return {
      ok: false,
      reason: `❌ Solo el rol DJ <@&${djRoleId}> (o administradores) puede controlar la música.`,
    };
  }

  return { ok: true };
}

/** Añadir /play: debe estar en un canal de voz; si el bot ya está, el mismo. */
export function canRequestMusic(
  member: GuildMember,
  session: GuildMusicSession | undefined | null,
): MusicPermResult {
  const voice = memberVoiceChannel(member);
  if (!voice) {
    return {
      ok: false,
      reason: "❌ Entra a un **canal de voz** primero.",
    };
  }
  if (
    session?.voiceChannelId &&
    voice.id !== session.voiceChannelId
  ) {
    return {
      ok: false,
      reason: "❌ Entra al **mismo canal de voz** que el bot para pedir canciones.",
    };
  }
  return { ok: true };
}
