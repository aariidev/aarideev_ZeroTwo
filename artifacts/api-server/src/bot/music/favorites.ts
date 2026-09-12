/**
 * Music favorites system — save and load custom playlists.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export interface SavedPlaylist {
  id: string;
  guildId: string;
  userId: string;
  name: string;
  tracks: Array<{
    title: string;
    url: string;
    duration: number;
  }>;
  createdAt: Date;
}

// In-memory storage for playlists (in production, use database)
const playlists = new Map<string, SavedPlaylist[]>();

function getPlaylistKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export async function createPlaylist(
  guildId: string,
  userId: string,
  name: string,
  tracks: Array<{ title: string; url: string; duration: number }>,
): Promise<SavedPlaylist> {
  const key = getPlaylistKey(guildId, userId);
  const playlist: SavedPlaylist = {
    id: `${Date.now()}`,
    guildId,
    userId,
    name,
    tracks,
    createdAt: new Date(),
  };

  if (!playlists.has(key)) {
    playlists.set(key, []);
  }

  const userPlaylists = playlists.get(key)!;

  // Limit to 10 playlists per user
  if (userPlaylists.length >= 10) {
    logger.warn(
      { guildId, userId },
      "User already has max playlists (10)",
    );
    throw new Error("You already have 10 saved playlists. Delete one first.");
  }

  userPlaylists.push(playlist);
  return playlist;
}

export async function listPlaylists(
  guildId: string,
  userId: string,
): Promise<SavedPlaylist[]> {
  const key = getPlaylistKey(guildId, userId);
  return playlists.get(key) || [];
}

export async function getPlaylist(
  guildId: string,
  userId: string,
  playlistId: string,
): Promise<SavedPlaylist | null> {
  const key = getPlaylistKey(guildId, userId);
  const list = playlists.get(key) || [];
  return list.find((p) => p.id === playlistId) || null;
}

export async function deletePlaylist(
  guildId: string,
  userId: string,
  playlistId: string,
): Promise<boolean> {
  const key = getPlaylistKey(guildId, userId);
  const list = playlists.get(key) || [];
  const index = list.findIndex((p) => p.id === playlistId);

  if (index === -1) return false;

  list.splice(index, 1);
  return true;
}

export async function renamePlaylist(
  guildId: string,
  userId: string,
  playlistId: string,
  newName: string,
): Promise<SavedPlaylist | null> {
  const playlist = await getPlaylist(guildId, userId, playlistId);
  if (!playlist) return null;

  playlist.name = newName.slice(0, 50);
  return playlist;
}

export async function addTrackToPlaylist(
  guildId: string,
  userId: string,
  playlistId: string,
  track: { title: string; url: string; duration: number },
): Promise<SavedPlaylist | null> {
  const playlist = await getPlaylist(guildId, userId, playlistId);
  if (!playlist) return null;

  // Limit to 100 tracks per playlist
  if (playlist.tracks.length >= 100) {
    throw new Error("Playlist is full (max 100 tracks)");
  }

  playlist.tracks.push(track);
  return playlist;
}

export async function removeTrackFromPlaylist(
  guildId: string,
  userId: string,
  playlistId: string,
  trackIndex: number,
): Promise<SavedPlaylist | null> {
  const playlist = await getPlaylist(guildId, userId, playlistId);
  if (!playlist) return null;

  if (trackIndex < 0 || trackIndex >= playlist.tracks.length) {
    return null;
  }

  playlist.tracks.splice(trackIndex, 1);
  return playlist;
}

export function formatPlaylistInfo(playlist: SavedPlaylist): string {
  const duration = playlist.tracks.reduce((sum, t) => sum + t.duration, 0);
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);

  return `**${playlist.name}** — ${playlist.tracks.length} songs, ${hours}h ${minutes}m`;
}
