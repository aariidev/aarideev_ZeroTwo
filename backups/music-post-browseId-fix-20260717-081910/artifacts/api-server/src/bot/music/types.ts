export type LoopMode = "off" | "track" | "queue";

export interface Track {
  title: string;
  url: string;
  durationSec: number;
  thumbnail: string | null;
  requestedBy: {
    id: string;
    tag: string;
    avatarURL: string | null;
  };
  source: "youtube" | "soundcloud" | "spotify" | "url" | "search";
  /** Original Spotify URL if resolved via Spotify */
  spotifyUrl?: string;
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "?:??";
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((sec / 60) % 60)
    .toString()
    .padStart(2, "0");
  const h = Math.floor(sec / 3600);
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}
