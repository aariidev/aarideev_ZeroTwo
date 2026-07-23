/**
 * Tests unitarios para GuildMusicSession.
 *
 * Se mockean todas las dependencias de @discordjs/voice, play-dl,
 * discord.js y la BD para poder ejecutar los tests sin conexiones reales.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// @discordjs/voice — mock completo
vi.mock("@discordjs/voice", () => {
  const AudioPlayerStatus = {
    Idle: "idle",
    Playing: "playing",
    Paused: "paused",
    Buffering: "buffering",
    AutoPaused: "autopaused",
  } as const;

  const VoiceConnectionStatus = {
    Ready: "ready",
    Signalling: "signalling",
    Connecting: "connecting",
    Destroyed: "destroyed",
    Disconnected: "disconnected",
  } as const;

  const mockPlayer = {
    state: { status: AudioPlayerStatus.Idle },
    on: vi.fn(),
    play: vi.fn(),
    stop: vi.fn().mockReturnValue(true),
    pause: vi.fn().mockReturnValue(true),
    unpause: vi.fn().mockReturnValue(true),
  };

  return {
    AudioPlayerStatus,
    VoiceConnectionStatus,
    NoSubscriberBehavior: { Play: "play" },
    StreamType: { OggOpus: "ogg/opus" },
    createAudioPlayer: vi.fn(() => ({ ...mockPlayer })),
    createAudioResource: vi.fn(() => ({ playbackDuration: 0, volume: { setVolume: vi.fn() } })),
    joinVoiceChannel: vi.fn(() => ({
      on: vi.fn(),
      subscribe: vi.fn(),
      destroy: vi.fn(),
      state: { status: "ready" },
    })),
    entersState: vi.fn().mockResolvedValue(undefined),
    getVoiceConnection: vi.fn().mockReturnValue(null),
  };
});

// play-dl
vi.mock("play-dl", () => ({
  default: {
    search: vi.fn().mockResolvedValue([]),
    stream: vi.fn().mockResolvedValue({ stream: { pipe: vi.fn() }, type: "opus" }),
  },
}));

// ffmpeg-static
vi.mock("ffmpeg-static", () => ({ default: "/usr/bin/ffmpeg" }));

// @workspace/db
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onDuplicateKeyUpdate: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  musicSessionsTable: {},
  eq: vi.fn(),
}));

// logger
vi.mock("../../../lib/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// stream helpers — simula carga exitosa
vi.mock("../../music/stream.js", () => ({
  createTrackResource: vi.fn().mockResolvedValue({
    resource: { playbackDuration: 0, volume: { setVolume: vi.fn() } },
    kill: vi.fn(),
  }),
  ytdlpSearchUrl: vi.fn().mockResolvedValue("https://www.youtube.com/watch?v=test"),
  ytdlpSearchMeta: vi.fn().mockResolvedValue(null),
  ytdlpPlaylistEntries: vi.fn().mockResolvedValue([]),
  isYoutubePlaylistOrMixUrl: vi.fn().mockReturnValue(false),
  getStreamDiagnostics: vi.fn().mockReturnValue({ cookies: true }),
}));

// embeds / panel / capBots
vi.mock("../../music/embeds.js", () => ({
  nowPlayingEmbed: vi.fn().mockReturnValue({}),
  idleQueueEmbed: vi.fn().mockReturnValue({}),
  musicControls: vi.fn().mockReturnValue([]),
  musicEmbedFiles: vi.fn().mockReturnValue([]),
  musicNoticeEmbed: vi.fn().mockReturnValue({}),
}));
vi.mock("../../music/panel.js", () => ({ schedulePanelRefresh: vi.fn() }));
vi.mock("../../music/panelStore.js", () => ({ hasActiveMusicPanel: vi.fn().mockResolvedValue(false) }));
vi.mock("../../music/capBots.js", () => ({ enforcePrimaryMusicBot: vi.fn() }));
vi.mock("../../music/sessionStore.js", () => ({
  saveMusicSession: vi.fn().mockResolvedValue(undefined),
  clearMusicSession: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTrack(title: string): import("../../music/types.js").Track {
  return {
    title,
    url: `https://www.youtube.com/watch?v=${title}`,
    durationSec: 180,
    thumbnail: null,
    requestedBy: { id: "user1", tag: "user#0001", avatarURL: null },
    source: "youtube",
  };
}

// ── Import after mocks ────────────────────────────────────────────────────────

// We import the manager module dynamically AFTER mocks are set up so that
// the module sees the mocked AudioPlayer constructor.
const { GuildMusicSession, musicManager } = await import("../../music/manager.js");

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GuildMusicSession — estado inicial", () => {
  it("crea la sesión con valores por defecto", () => {
    const session = new GuildMusicSession("guild1", {} as never);
    expect(session.guildId).toBe("guild1");
    expect(session.queue).toHaveLength(0);
    expect(session.current).toBeNull();
    expect(session.history).toHaveLength(0);
    expect(session.volume).toBe(80);
    expect(session.loop).toBe("off");
    expect(session.paused).toBe(false);
  });
});

describe("GuildMusicSession — toSnapshot", () => {
  it("incluye todos los campos necesarios", () => {
    const session = new GuildMusicSession("guild2", {} as never);
    const snap = session.toSnapshot();
    expect(snap).toMatchObject({
      guildId: "guild2",
      current: null,
      queue: [],
      history: [],
      volume: 80,
      loop: "off",
    });
    expect(typeof snap.playbackSec).toBe("number");
  });
});

describe("GuildMusicSession — setVolume / adjustVolume", () => {
  it("setVolume aplica límites (0–150)", () => {
    const session = new GuildMusicSession("guild3", {} as never);
    expect(session.setVolume(-10)).toBe(0);
    expect(session.setVolume(200)).toBe(150);
    expect(session.setVolume(75)).toBe(75);
  });

  it("adjustVolume modifica relativo al actual", () => {
    const session = new GuildMusicSession("guild4", {} as never);
    session.setVolume(80);
    expect(session.adjustVolume(10)).toBe(90);
    expect(session.adjustVolume(-30)).toBe(60);
  });
});

describe("GuildMusicSession — cycleLoop", () => {
  it("cicla off → track → queue → off", () => {
    const session = new GuildMusicSession("guild5", {} as never);
    expect(session.loop).toBe("off");
    expect(session.cycleLoop()).toBe("track");
    expect(session.cycleLoop()).toBe("queue");
    expect(session.cycleLoop()).toBe("off");
  });
});

describe("GuildMusicSession — skip", () => {
  it("retorna false si no hay nada reproduciendo", () => {
    const session = new GuildMusicSession("guild6", {} as never);
    expect(session.skip()).toBe(false);
  });

  it("retorna true si hay pista actual", () => {
    const session = new GuildMusicSession("guild7", {} as never);
    // inyectar pista directamente en la propiedad pública
    session.current = makeTrack("A");
    expect(session.skip()).toBe(true);
  });
});

describe("GuildMusicSession — clearQueue / remove", () => {
  it("clearQueue vacía la cola y devuelve el conteo", () => {
    const session = new GuildMusicSession("guild8", {} as never);
    session.queue.push(makeTrack("A"), makeTrack("B"), makeTrack("C"));
    expect(session.clearQueue()).toBe(3);
    expect(session.queue).toHaveLength(0);
  });

  it("remove retorna null si el índice es inválido", () => {
    const session = new GuildMusicSession("guild9", {} as never);
    session.queue.push(makeTrack("A"));
    expect(session.remove(0)).toBeNull();
    expect(session.remove(2)).toBeNull();
  });

  it("remove elimina la pista correcta (1-indexed)", () => {
    const session = new GuildMusicSession("guild10", {} as never);
    const a = makeTrack("A");
    const b = makeTrack("B");
    session.queue.push(a, b);
    const removed = session.remove(1);
    expect(removed?.title).toBe("A");
    expect(session.queue).toHaveLength(1);
    expect(session.queue[0]?.title).toBe("B");
  });
});

describe("GuildMusicSession — shuffle", () => {
  it("no lanza error con cola vacía y devuelve 0", () => {
    const session = new GuildMusicSession("guild11", {} as never);
    expect(session.shuffle()).toBe(0);
  });

  it("conserva todos los elementos tras el shuffle", () => {
    const session = new GuildMusicSession("guild12", {} as never);
    const tracks = ["A", "B", "C", "D", "E"].map(makeTrack);
    session.queue.push(...tracks);
    session.shuffle();
    expect(session.queue).toHaveLength(5);
    const titles = session.queue.map((t) => t.title).sort();
    expect(titles).toEqual(["A", "B", "C", "D", "E"]);
  });
});

describe("GuildMusicSession — stop", () => {
  it("limpia cola, current e history", () => {
    const session = new GuildMusicSession("guild13", {} as never);
    session.current = makeTrack("X");
    session.queue.push(makeTrack("Y"), makeTrack("Z"));
    // @ts-expect-error – history es privado pero accesible en runtime
    session.history.push(makeTrack("W"));
    session.stop();
    expect(session.current).toBeNull();
    expect(session.queue).toHaveLength(0);
    expect(session.history).toHaveLength(0);
    expect(session.loop).toBe("off");
  });
});

describe("GuildMusicSession — previous", () => {
  it("retorna false si no hay historial", async () => {
    const session = new GuildMusicSession("guild14", {} as never);
    const result = await session.previous();
    expect(result).toBe(false);
  });
});

describe("GuildMusicSession — setResumeOffset / hasHistory", () => {
  it("setResumeOffset no acepta valores negativos", () => {
    const session = new GuildMusicSession("guild15", {} as never);
    session.setResumeOffset(-5);
    // No lanza error — el offset se guarda como 0
    expect(session.playbackSec).toBe(0);
  });

  it("hasHistory es false cuando history está vacío", () => {
    const session = new GuildMusicSession("guild16", {} as never);
    expect(session.hasHistory).toBe(false);
  });

  it("hasHistory es true cuando hay pistas en history", () => {
    const session = new GuildMusicSession("guild17", {} as never);
    // @ts-expect-error – acceso directo a la propiedad
    session.history.push(makeTrack("A"));
    expect(session.hasHistory).toBe(true);
  });
});

describe("musicManager", () => {
  beforeEach(() => {
    // Limpia el manager entre tests
    // @ts-expect-error – acceso interno para tests
    musicManager["sessions"]?.clear?.();
  });

  it("getOrCreate crea una nueva sesión", () => {
    const client = {} as never;
    const session = musicManager.getOrCreate("guild-test", client);
    expect(session).toBeDefined();
    expect(session.guildId).toBe("guild-test");
  });

  it("getOrCreate devuelve la misma instancia en llamadas sucesivas", () => {
    const client = {} as never;
    const s1 = musicManager.getOrCreate("guild-same", client);
    const s2 = musicManager.getOrCreate("guild-same", client);
    expect(s1).toBe(s2);
  });

  it("get devuelve undefined si la sesión no existe", () => {
    expect(musicManager.get("guild-inexistente")).toBeUndefined();
  });

  it("drop elimina la sesión del mapa", () => {
    const client = {} as never;
    musicManager.getOrCreate("guild-drop", client);
    musicManager.drop("guild-drop");
    expect(musicManager.get("guild-drop")).toBeUndefined();
  });
});

describe("GuildMusicSession — playbackSec", () => {
  it("devuelve 0 sin resource activo", () => {
    const session = new GuildMusicSession("guild18", {} as never);
    expect(session.playbackSec).toBe(0);
  });
});
