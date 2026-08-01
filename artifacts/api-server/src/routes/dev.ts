import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { spawn, execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { db } from "@workspace/db";
import { botConfigTable, changelogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { devState } from "../lib/devState.js";
import { EmbedBuilder, ChannelType, type TextChannel, type Client } from "discord.js";
import { logger } from "../lib/logger.js";

const execFileAsync = promisify(execFile);

const router = Router();
const DEV_USER_ID = "819080793447333918";
let botClient: Client | null = null;
let consoleBusy = false;

// When bundled by esbuild, import.meta.url → artifacts/api-server/dist/index.mjs
const DIST_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_PKG_DIR = path.resolve(DIST_DIR, "..");
const REPO_ROOT = path.resolve(DIST_DIR, "../..");

export type RestartMode = "soft" | "reload" | "hard";

interface RestartTracker {
  inProgress: boolean;
  mode: RestartMode | null;
  phase: string;
  startedAt: number | null;
  finishedAt: number | null;
  ok: boolean | null;
  log: string[];
  error: string | null;
}

const restartState: RestartTracker = {
  inProgress: false,
  mode: null,
  phase: "idle",
  startedAt: null,
  finishedAt: null,
  ok: null,
  log: [],
  error: null,
};

function restartLog(line: string) {
  const stamp = new Date().toISOString().slice(11, 19);
  const entry = `[${stamp}] ${line}`;
  restartState.log.push(entry);
  if (restartState.log.length > 80) restartState.log.shift();
  logger.info(entry);
}

function setRestartPhase(phase: string) {
  restartState.phase = phase;
}

export function setBotClientForDev(client: Client) {
  botClient = client;
}

function ownerIds(): string[] {
  return (process.env.OWNER_IDS ?? DEV_USER_ID)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Dev routes: must be an OWNER (Discord session) AND present valid DEV_TOKEN.
 * Non-owners never get access even if they guess the token.
 */
function requireDevAuth(req: Request, res: Response, next: NextFunction) {
  const owners = ownerIds();
  const sessionUserId = req.sessionUser?.id;

  if (!sessionUserId || !owners.includes(sessionUserId)) {
    logger.warn(
      { sessionUserId },
      "Dev API blocked — caller is not the developer/owner",
    );
    return res.status(403).json({
      error: "Dev panel is restricted to the bot developer.",
      code: "DEV_OWNER_ONLY",
    });
  }

  const token = req.headers["x-dev-token"];
  const expected = process.env.DEV_TOKEN;

  if (!expected) {
    req.log?.error(
      "🔒 El token maestro DEV_TOKEN no está definido en el entorno.",
    );
    return res
      .status(503)
      .json({ error: "Dev panel not configured on this node." });
  }

  if (!token || token !== expected) {
    return res
      .status(401)
      .json({ error: "Access denied. Invalid developer token." });
  }

  next();
}

function isBotOnline(): boolean {
  return botLooksOnline(botClient);
}

function guildsCount(): number {
  return botClient?.guilds.cache.size ?? 0;
}

/** Shape expected by the dashboard Dev Panel */
function buildStatusPayload() {
  const current = devState.current;
  const online = isBotOnline();
  const rawPing = botClient?.ws.ping ?? -1;
  return {
    maintenanceMode: current.maintenanceMode,
    maintenanceMessage: current.maintenanceMessage,
    botOnline: online,
    guildsCount: guildsCount(),
    restartInProgress: restartState.inProgress,
    restart: {
      inProgress: restartState.inProgress,
      mode: restartState.mode,
      phase: restartState.phase,
      startedAt: restartState.startedAt,
      finishedAt: restartState.finishedAt,
      ok: restartState.ok,
      error: restartState.error,
      log: restartState.log.slice(-30),
      elapsedMs: restartState.startedAt
        ? (restartState.finishedAt ?? Date.now()) - restartState.startedAt
        : 0,
    },
    systemUptime: process.uptime(),
    // discord.js can report -1 briefly even while ready; keep UI green
    ping: online && rawPing < 0 ? 0 : rawPing,
    botName: botClient?.user?.username ?? null,
    botTag: botClient?.user?.tag ?? null,
  };
}

function botLooksOnline(client: Client | null = botClient): boolean {
  if (!client) return false;
  try {
    if (client.isReady() && client.user) return true;
    // Fallback: user hydrated + at least one guild or ws ping available
    if (client.user && (client.guilds.cache.size > 0 || client.ws.ping >= 0)) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Wait until the client is usable after login.
 * Registers listeners BEFORE login should be started; also polls (events can race).
 */
function waitForBotReady(
  client: Client,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (botLooksOnline(client)) {
      resolve(true);
      return;
    }

    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      try {
        client.off("clientReady", onReady);
        client.off("ready", onReady);
      } catch {
        /* ignore */
      }
      resolve(ok);
    };

    const onReady = () => {
      // Give the client a tick to hydrate user/guilds
      setTimeout(() => done(botLooksOnline(client) || Boolean(client.user)), 50);
    };

    client.once("clientReady", onReady);
    client.once("ready", onReady);

    const poll = setInterval(() => {
      if (botLooksOnline(client)) done(true);
    }, 250);

    const timer = setTimeout(() => done(botLooksOnline(client)), timeoutMs);

    // Immediate re-check (login may have already finished)
    if (botLooksOnline(client)) done(true);
  });
}

/**
 * Soft gateway restart: destroy + login, wait for ready, re-apply presence.
 * Retries login once on failure. Listeners are registered before login.
 */
async function performSoftRestart(): Promise<{ ok: boolean; lines: string[] }> {
  const lines: string[] = [];
  const push = (s: string) => {
    lines.push(s);
    restartLog(s);
  };

  if (!botClient) {
    push("✗ Bot client no inicializado");
    return { ok: false, lines };
  }
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    push("✗ DISCORD_TOKEN ausente");
    return { ok: false, lines };
  }

  const client = botClient;

  // Snapshot music sessions so /continue works after restart
  try {
    const { musicManager } = await import("../bot/music/manager.js");
    await musicManager.saveAll();
    push("→ Sesiones de música guardadas");
  } catch {
    push("⚠ No se pudieron guardar sesiones de música");
  }

  // ── Attempt 0: gentle shard reconnect (no full destroy) ──────────────────
  try {
    setRestartPhase("disconnect");
    const shards = client.ws?.shards;
    if (shards && shards.size > 0) {
      push(`→ Reconectando ${shards.size} shard(s)…`);
      const readyP = waitForBotReady(client, 20_000);
      for (const shard of shards.values()) {
        try {
          // Force close; manager will resume/reconnect
          shard.close(1000);
        } catch {
          try {
            // @ts-expect-error reconnect exists on WebSocketShard in djs 14
            await shard.reconnect?.();
          } catch {
            /* ignore */
          }
        }
      }
      // Nudge: if still offline after close, fall through to destroy+login
      const gentleOk = await Promise.race([
        readyP,
        new Promise<boolean>((r) => setTimeout(() => r(false), 8_000)),
      ]);
      if (gentleOk || botLooksOnline(client)) {
        setRestartPhase("presence");
        push("→ Shards online — aplicando presence…");
        try {
          const { applyRichPresence, startPresenceRefresh } = await import(
            "../bot/lib/presence.js"
          );
          applyRichPresence(client);
          startPresenceRefresh(client);
        } catch (presErr) {
          push(
            `⚠ presence: ${presErr instanceof Error ? presErr.message : String(presErr)}`,
          );
        }
        await new Promise((r) => setTimeout(r, 400));
        push(
          `✓ Online · ${client.user?.tag ?? "?"} · ${guildsCount()} guilds · ${client.ws.ping >= 0 ? client.ws.ping : "—"}ms`,
        );
        setRestartPhase("done");
        return { ok: true, lines };
      }
      push("⚠ Reconnect suave no bastó — destroy + login…");
    }
  } catch (err) {
    push(
      `⚠ Reconnect suave falló: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Full destroy + login (2 attempts) ────────────────────────────────────
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      setRestartPhase("disconnect");
      push(
        attempt > 1
          ? `→ Reintento destroy+login (${attempt}/2)…`
          : "→ Cerrando sesión de Discord (destroy)…",
      );
      try {
        client.destroy();
      } catch (err) {
        push(
          `⚠ destroy: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Cool-down so Discord accepts a new gateway session
      await new Promise((r) => setTimeout(r, attempt === 1 ? 1500 : 3000));

      setRestartPhase("login");
      push("→ Login al gateway…");

      // CRITICAL: start waiting BEFORE login so we never miss clientReady
      const readyPromise = waitForBotReady(client, 30_000);
      await client.login(token);

      setRestartPhase("ready");
      push("→ Esperando READY…");
      const ready = (await readyPromise) || botLooksOnline(client);
      if (!ready) {
        throw new Error(
          "Timeout esperando READY (client.user / isReady). Prueba HARD restart.",
        );
      }

      setRestartPhase("presence");
      push("→ Aplicando rich presence…");
      try {
        const { applyRichPresence, startPresenceRefresh } = await import(
          "../bot/lib/presence.js"
        );
        applyRichPresence(client);
        startPresenceRefresh(client);
      } catch (presErr) {
        push(
          `⚠ presence: ${presErr instanceof Error ? presErr.message : String(presErr)}`,
        );
      }

      await new Promise((r) => setTimeout(r, 500));
      const ping = client.ws.ping;
      push(
        `✓ Online · ${client.user?.tag ?? "?"} · ${guildsCount()} guilds · ${ping >= 0 ? ping : "—"}ms`,
      );
      setRestartPhase("done");
      return { ok: true, lines };
    } catch (err) {
      lastErr = err;
      push(
        `✗ Intento ${attempt} falló: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }

  setRestartPhase("failed");
  push(
    `✗ Restart fallido: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
  push("ℹ Usa HARD (respawn) si el gateway sigue roto.");
  return { ok: false, lines };
}

async function beginRestartJob(
  mode: RestartMode,
): Promise<{ accepted: boolean; error?: string }> {
  if (restartState.inProgress || consoleBusy) {
    return { accepted: false, error: "Ya hay un reinicio/comando en curso" };
  }
  if (!botClient && mode === "soft") {
    return { accepted: false, error: "Bot client no inicializado" };
  }

  restartState.inProgress = true;
  restartState.mode = mode;
  restartState.phase = "starting";
  restartState.startedAt = Date.now();
  restartState.finishedAt = null;
  restartState.ok = null;
  restartState.error = null;
  restartState.log = [];
  restartLog(`Iniciando restart mode=${mode}`);

  setImmediate(async () => {
    try {
      if (mode === "reload" || mode === "hard") {
        setRestartPhase("rebuild");
        restartLog("→ Rebuild api-server…");
        const build = await doRebuild();
        for (const l of build) {
          if (!l.startsWith("→ rebuild")) restartLog(l);
        }
        if (!build.some((l) => l.includes("Build OK"))) {
          restartState.ok = false;
          restartState.error = "Build falló";
          setRestartPhase("failed");
          return;
        }
      }

      if (mode === "hard") {
        setRestartPhase("respawn");
        restartLog("→ Respawn del proceso Node…");
        scheduleRespawn([]);
        // process will exit; mark as ok-ish
        restartState.ok = true;
        return;
      }

      // soft or reload → gateway restart
      const result = await performSoftRestart();
      restartState.ok = result.ok;
      if (!result.ok) {
        restartState.error = result.lines.find((l) => l.startsWith("✗")) ?? "fallo";
      }
    } catch (err) {
      restartState.ok = false;
      restartState.error =
        err instanceof Error ? err.message : String(err);
      setRestartPhase("failed");
      restartLog(`✗ ${restartState.error}`);
    } finally {
      if (mode !== "hard") {
        restartState.inProgress = false;
        restartState.finishedAt = Date.now();
        if (restartState.phase !== "failed" && restartState.ok) {
          setRestartPhase("done");
        }
      }
    }
  });

  return { accepted: true };
}

async function persistConfig(key: string, value: string) {
  await db
    .insert(botConfigTable)
    .values({ key, value, updatedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: { value, updatedAt: new Date() },
    });
}

// ── GET /status ──────────────────────────────────────────────────────────────

router.get("/status", requireDevAuth, async (req: Request, res: Response) => {
  try {
    res.status(200).json(buildStatusPayload());
  } catch (err) {
    req.log?.error(
      { err },
      "❌ Error de lectura en la configuración global de desarrollo",
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /maintenance ────────────────────────────────────────────────────────

router.post(
  "/maintenance",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const enabled = Boolean(req.body?.enabled);
      const message =
        typeof req.body?.message === "string" && req.body.message.trim()
          ? req.body.message.trim()
          : undefined;

      devState.setMaintenance(enabled, message);

      await Promise.all([
        persistConfig("maintenance_mode", enabled ? "true" : "false"),
        message
          ? persistConfig("maintenance_message", message)
          : Promise.resolve(),
      ]);

      res.status(200).json({
        maintenanceMode: devState.current.maintenanceMode,
        maintenanceMessage: devState.current.maintenanceMessage,
        ...buildStatusPayload(),
      });
    } catch (err) {
      req.log?.error({ err }, "❌ Error al conmutar modo mantenimiento");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── POST /maintenance/generate — Gemini drafts maintenance message ───────────

router.post(
  "/maintenance/generate",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error:
            "GEMINI_API_KEY no configurado. Añádelo al .env y reinicia el api-server.",
        });
      }

      const notes =
        typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined;
      const reason =
        typeof req.body?.reason === "string"
          ? req.body.reason.trim()
          : undefined;
      const eta =
        typeof req.body?.eta === "string" ? req.body.eta.trim() : undefined;
      const useGit = req.body?.useGit !== false;

      let digests: string | undefined;
      if (useGit) {
        const { collectBotChangesDigest } = await import(
          "../lib/changelogDigest.js"
        );
        const { digest } = await collectBotChangesDigest({
          maxCommits: 25,
          since: "14 days ago",
        });
        digests = digest;
      }

      const { generateMaintenanceWithGemini, getGeminiModel } = await import(
        "../lib/gemini.js"
      );
      const draft = await generateMaintenanceWithGemini({
        digests,
        notes,
        reason,
        eta,
      });

      res.status(200).json({
        ok: true,
        model: getGeminiModel(),
        draft,
      });
    } catch (err) {
      req.log?.error({ err }, "❌ Gemini maintenance generate failed");
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : "No se pudo generar el mensaje de mantenimiento",
      });
    }
  },
);

// ── POST /announce/generate — Gemini drafts broadcast ────────────────────────

router.post(
  "/announce/generate",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error:
            "GEMINI_API_KEY no configurado. Añádelo al .env y reinicia el api-server.",
        });
      }

      const notes =
        typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined;
      const tone =
        typeof req.body?.tone === "string" ? req.body.tone.trim() : undefined;
      const useGit = req.body?.useGit !== false;

      let digests: string | undefined;
      if (useGit) {
        const { collectBotChangesDigest } = await import(
          "../lib/changelogDigest.js"
        );
        const { digest } = await collectBotChangesDigest({
          maxCommits: 30,
          since: "21 days ago",
        });
        digests = digest;
      }

      const { generateBroadcastWithGemini, getGeminiModel } = await import(
        "../lib/gemini.js"
      );
      const draft = await generateBroadcastWithGemini({
        digests,
        notes,
        tone,
        guildCount: guildsCount(),
      });

      res.status(200).json({
        ok: true,
        model: getGeminiModel(),
        draft,
        guildsCount: guildsCount(),
      });
    } catch (err) {
      req.log?.error({ err }, "❌ Gemini announce generate failed");
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : "No se pudo generar el anuncio con Gemini",
      });
    }
  },
);

// ── POST /announce ───────────────────────────────────────────────────────────

router.post(
  "/announce",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const title =
        typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const message =
        typeof req.body?.message === "string" ? req.body.message.trim() : "";

      if (!title || !message) {
        return res
          .status(400)
          .json({ error: "Missing required fields: title, message" });
      }

      if (!botClient || !isBotOnline()) {
        return res.status(503).json({ error: "Bot is offline" });
      }

      const embed = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setTitle(title)
        .setDescription(message)
        .setTimestamp()
        .setFooter({ text: "ZeroTwo · Broadcast" });

      let sent = 0;
      const guilds = [...botClient.guilds.cache.values()];
      const total = guilds.length;

      for (const guild of guilds) {
        try {
          let channel =
            guild.systemChannel ??
            guild.publicUpdatesChannel ??
            null;

          if (!channel || !channel.isTextBased()) {
            const me = guild.members.me;
            channel =
              guild.channels.cache.find((ch) => {
                if (ch.type !== ChannelType.GuildText) return false;
                if (!me) return true;
                return ch
                  .permissionsFor(me)
                  ?.has(["SendMessages", "EmbedLinks"]);
              }) ?? null;
          }

          if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send({ embeds: [embed] });
            sent++;
          }
        } catch (guildErr) {
          req.log?.warn(
            { guildErr, guildId: guild.id },
            "No se pudo enviar anuncio a un servidor",
          );
        }
      }

      res.status(200).json({ sent, total });
    } catch (err) {
      req.log?.error({ err }, "❌ Error en broadcast de anuncio");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── POST /restart ────────────────────────────────────────────────────────────
// body: { mode?: "soft" | "reload" | "hard" }
// soft   = gateway reconnect (default)
// reload = pnpm build + gateway reconnect
// hard   = pnpm build + process respawn (loads new code fully)

router.post(
  "/restart",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const rawMode = String(req.body?.mode ?? "soft").toLowerCase();
      const mode: RestartMode =
        rawMode === "hard" || rawMode === "reload" || rawMode === "soft"
          ? rawMode
          : "soft";

      const job = await beginRestartJob(mode);
      if (!job.accepted) {
        return res.status(409).json({
          error: job.error ?? "Restart rejected",
          restart: buildStatusPayload().restart,
        });
      }

      res.status(202).json({
        ok: true,
        message: `Restart ${mode} iniciado`,
        mode,
        botOnline: false,
        status: buildStatusPayload(),
      });
    } catch (err) {
      restartState.inProgress = false;
      req.log?.error({ err }, "❌ Error iniciando restart del bot");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── GET /changelogs ──────────────────────────────────────────────────────────

router.get(
  "/changelogs",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const rows = await db
        .select()
        .from(changelogsTable)
        .orderBy(desc(changelogsTable.createdAt))
        .limit(50);

      res.status(200).json(
        rows.map((row) => ({
          id: row.id,
          version: row.version,
          title: row.title,
          description: row.description,
          type: row.type,
          createdAt:
            row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : String(row.createdAt),
        })),
      );
    } catch (err) {
      req.log?.error({ err }, "❌ Error listando changelogs");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── POST /changelogs/generate — Gemini drafts from git + notes ───────────────

router.post(
  "/changelogs/generate",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error:
            "GEMINI_API_KEY no configurado. Añádelo al .env y reinicia el api-server.",
        });
      }

      const hintVersion =
        typeof req.body?.version === "string"
          ? req.body.version.trim()
          : undefined;
      const hintType =
        typeof req.body?.type === "string" ? req.body.type.trim() : undefined;
      const extraNotes =
        typeof req.body?.notes === "string" ? req.body.notes.trim() : undefined;
      const since =
        typeof req.body?.since === "string" ? req.body.since.trim() : undefined;
      const maxCommits =
        typeof req.body?.maxCommits === "number"
          ? Math.min(80, Math.max(5, req.body.maxCommits))
          : 40;
      const autoPublish = req.body?.autoPublish === true;

      const { collectBotChangesDigest } = await import(
        "../lib/changelogDigest.js"
      );
      const { generateChangelogWithGemini, getGeminiModel } = await import(
        "../lib/gemini.js"
      );

      const { digest, meta } = await collectBotChangesDigest({
        maxCommits,
        since,
      });

      const draft = await generateChangelogWithGemini({
        digests: digest,
        hintVersion,
        hintType,
        extraNotes,
      });

      let published = null as null | Record<string, unknown>;
      if (autoPublish) {
        const ids = await db
          .insert(changelogsTable)
          .values({
            version: draft.version,
            title: draft.title,
            description: draft.description,
            type: draft.type,
          })
          .$returningId();
        const newId = ids[0]?.id;
        const [entry] = newId
          ? await db
              .select()
              .from(changelogsTable)
              .where(eq(changelogsTable.id, newId))
              .limit(1)
          : [];
        published = entry
          ? {
              ...entry,
              createdAt: entry.createdAt.toISOString(),
            }
          : null;
      }

      res.status(200).json({
        ok: true,
        model: getGeminiModel(),
        meta,
        draft,
        published,
      });
    } catch (err) {
      req.log?.error({ err }, "❌ Gemini changelog generate failed");
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : "No se pudo generar el changelog con Gemini",
      });
    }
  },
);

// ── POST /changelogs ─────────────────────────────────────────────────────────

router.post(
  "/changelogs",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const { version, title, description, type, announceChannelId } = req.body;

      if (!version?.trim() || !title?.trim() || !description?.trim()) {
        return res.status(400).json({
          error: "Missing required fields: version, title, description",
        });
      }

      const validTypes = ["feature", "fix", "improvement", "breaking"];
      const entryType = validTypes.includes(type) ? type : "feature";

      const ids = await db
        .insert(changelogsTable)
        .values({
          version: version.trim(),
          title: title.trim(),
          description: description.trim(),
          type: entryType,
        })
        .$returningId();
      const newId = ids[0]?.id;
      const [entry] = newId
        ? await db
            .select()
            .from(changelogsTable)
            .where(eq(changelogsTable.id, newId))
            .limit(1)
        : [];

      if (announceChannelId && botClient && isBotOnline()) {
        try {
          const channel = (await botClient.channels.fetch(
            announceChannelId,
          )) as TextChannel;
          if (channel?.isTextBased()) {
            const typeColors: Record<string, number> = {
              feature: 0xec4899,
              fix: 0xef4444,
              improvement: 0x3b82f6,
              breaking: 0xf59e0b,
            };

            const embed = new EmbedBuilder()
              .setColor(typeColors[entryType] ?? 0xec4899)
              .setTitle(`🚀 Actualización del Núcleo — v${version.trim()}`)
              .setAuthor({ name: "ZeroTwo Engine Updates" })
              .setDescription(
                `### 🛠️ ${title.trim()}\n\n${description.trim()}`,
              )
              .setTimestamp()
              .setFooter({ text: `Categoría: ${entryType.toUpperCase()}` });

            await channel.send({ embeds: [embed] });
          }
        } catch (discordErr) {
          req.log?.warn(
            { discordErr },
            "⚠️ El changelog se guardó pero falló el envío del embed a Discord",
          );
        }
      }

      res.status(201).json({
        ...entry,
        createdAt: entry?.createdAt.toISOString(),
      });
    } catch (err) {
      req.log?.error({ err }, "❌ Imposible registrar o anunciar el changelog");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── DELETE /changelogs/:id ───────────────────────────────────────────────────

router.delete(
  "/changelogs/:id",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id))
        return res.status(400).json({ error: "Invalid id format" });

      const existing = await db
        .select({ id: changelogsTable.id })
        .from(changelogsTable)
        .where(eq(changelogsTable.id, id))
        .limit(1);

      if (!existing[0])
        return res.status(404).json({ error: "Changelog entry not found" });

      await db.delete(changelogsTable).where(eq(changelogsTable.id, id));

      res.status(200).json({ success: true, deletedId: id });
    } catch (err) {
      req.log?.error({ err }, "❌ Error eliminando la entrada del changelog");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── Dev console (whitelist only — never free shell) ──────────────────────────

const CONSOLE_HELP = [
  "Comandos disponibles (whitelist):",
  "  help              — esta ayuda",
  "  status            — estado bot / API / mantenimiento",
  "  ping              — latencia WebSocket",
  "  guilds            — lista servidores (top 20)",
  "  version           — versión del bot",
  "  restart           — reconectar gateway Discord",
  "  rebuild           — pnpm build del api-server",
  "  update            — git pull + rebuild",
  "  deploy            — update + restart gateway",
  "  reload            — rebuild + restart gateway",
  "  respawn           — rebuild + reiniciar proceso Node (carga código nuevo)",
  "  maintenance on|off [mensaje…]",
  "  clear             — limpia la consola (solo UI)",
].join("\n");

async function runShell(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 120_000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      shell: process.platform === "win32",
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({
        code: -1,
        stdout,
        stderr: stderr + "\n[timeout]",
      });
    }, timeoutMs);
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: String(err) });
    });
  });
}

function trimOutput(s: string, max = 8000): string {
  if (s.length <= max) return s;
  return `…[truncado ${s.length - max} chars]\n` + s.slice(-max);
}

async function doDiscordRestart(): Promise<string[]> {
  if (restartState.inProgress) {
    return ["✗ Restart ya en curso"];
  }
  restartState.inProgress = true;
  restartState.mode = "soft";
  restartState.phase = "starting";
  restartState.startedAt = Date.now();
  restartState.finishedAt = null;
  restartState.ok = null;
  restartState.error = null;
  restartState.log = [];
  try {
    const result = await performSoftRestart();
    restartState.ok = result.ok;
    if (!result.ok) {
      restartState.error =
        result.lines.find((l) => l.startsWith("✗")) ?? "fallo";
    }
    return result.lines;
  } finally {
    restartState.inProgress = false;
    restartState.finishedAt = Date.now();
  }
}

async function doRebuild(): Promise<string[]> {
  const lines: string[] = [`→ rebuild en ${API_PKG_DIR}`];
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = await runShell(pnpm, ["run", "build"], API_PKG_DIR, 180_000);
  if (result.stdout.trim()) lines.push(trimOutput(result.stdout.trim()));
  if (result.stderr.trim()) lines.push(trimOutput(result.stderr.trim()));
  if (result.code === 0) {
    lines.push("✓ Build OK");
  } else {
    lines.push(`✗ Build falló (code ${result.code})`);
  }
  return lines;
}

async function doGitPull(): Promise<string[]> {
  const lines: string[] = [`→ git pull en ${REPO_ROOT}`];
  try {
    const { stdout, stderr } = await execFileAsync(
      "git",
      ["pull", "--ff-only", "origin", "main"],
      { cwd: REPO_ROOT, timeout: 120_000, windowsHide: true },
    );
    if (stdout.trim()) lines.push(trimOutput(stdout.trim()));
    if (stderr.trim()) lines.push(trimOutput(stderr.trim()));
    lines.push("✓ git pull OK");
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    if (e.stdout) lines.push(trimOutput(String(e.stdout).trim()));
    if (e.stderr) lines.push(trimOutput(String(e.stderr).trim()));
    lines.push(`✗ git pull: ${e.message ?? String(err)}`);
  }
  return lines;
}

function scheduleRespawn(lines: string[]): string[] {
  lines.push("→ Programando respawn del proceso en 1.5s…");
  lines.push("  (carga el dist nuevo; la API caerá un momento)");
  setTimeout(() => {
    try {
      const child = spawn(process.execPath, process.argv.slice(1), {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
        env: process.env,
        windowsHide: true,
      });
      child.unref();
      logger.warn("♻️ Dev console: respawn spawned, exiting");
    } catch (err) {
      logger.error({ err }, "♻️ Dev console: respawn failed");
    }
    process.exit(0);
  }, 1500);
  return lines;
}

router.post(
  "/console",
  requireDevAuth,
  async (req: Request, res: Response) => {
    try {
      if (consoleBusy) {
        return res.status(409).json({
          ok: false,
          lines: ["✗ Consola ocupada — espera a que termine el comando actual"],
        });
      }

      const raw =
        typeof req.body?.command === "string" ? req.body.command.trim() : "";
      if (!raw) {
        return res.status(400).json({
          ok: false,
          lines: ["✗ Escribe un comando. Usa `help`."],
        });
      }

      // Reject anything that looks like shell injection / paths
      if (/[;&|`$<>]/.test(raw) || raw.includes("..")) {
        return res.status(400).json({
          ok: false,
          lines: ["✗ Caracteres no permitidos. Solo comandos de la whitelist."],
        });
      }

      const parts = raw.split(/\s+/);
      const cmd = (parts[0] ?? "").toLowerCase();
      const args = parts.slice(1);
      const lines: string[] = [`$ ${raw}`];

      const finish = (ok: boolean, extra: string[] = []) => {
        res.status(200).json({
          ok,
          command: raw,
          lines: [...lines, ...extra],
          status: buildStatusPayload(),
        });
      };

      switch (cmd) {
        case "help":
        case "?":
          return finish(true, [CONSOLE_HELP]);

        case "clear":
          return finish(true, ["__CLEAR__"]);

        case "status": {
          const s = buildStatusPayload();
          return finish(true, [
            `bot: ${s.botOnline ? "ONLINE" : "OFFLINE"} · ${s.botName ?? "—"}`,
            `guilds: ${s.guildsCount} · ping: ${s.ping}ms · uptime API: ${Math.floor(s.systemUptime ?? 0)}s`,
            `maintenance: ${s.maintenanceMode ? "ON" : "OFF"}`,
            `restartInProgress: ${s.restartInProgress}`,
            `cwd: ${process.cwd()}`,
            `repo: ${REPO_ROOT}`,
          ]);
        }

        case "ping":
          return finish(true, [
            `ws ping: ${botClient?.ws.ping ?? "n/a"}ms`,
            `ready: ${isBotOnline()}`,
          ]);

        case "version": {
          try {
            const { BOT_VERSION } = await import("../bot/lib/version.js");
            return finish(true, [`version: ${BOT_VERSION}`]);
          } catch {
            return finish(true, ["version: unknown"]);
          }
        }

        case "guilds": {
          if (!botClient) return finish(false, ["✗ Bot offline"]);
          const list = [...botClient.guilds.cache.values()]
            .sort((a, b) => b.memberCount - a.memberCount)
            .slice(0, 20)
            .map(
              (g, i) =>
                `${String(i + 1).padStart(2, "0")}. ${g.name} · ${g.memberCount} · \`${g.id}\``,
            );
          return finish(true, [
            `${botClient.guilds.cache.size} servidores (top 20):`,
            ...list,
          ]);
        }

        case "restart": {
          consoleBusy = true;
          try {
            const out = await doDiscordRestart();
            return finish(
              out.some((l) => l.startsWith("✓")),
              out,
            );
          } finally {
            consoleBusy = false;
          }
        }

        case "rebuild": {
          consoleBusy = true;
          try {
            const out = await doRebuild();
            return finish(out.some((l) => l.includes("Build OK")), out);
          } finally {
            consoleBusy = false;
          }
        }

        case "update": {
          consoleBusy = true;
          try {
            const pull = await doGitPull();
            const build = await doRebuild();
            const out = [...pull, ...build];
            out.push(
              "ℹ Código en disco actualizado. Usa `respawn` para cargar el proceso Node nuevo, o `restart` solo para gateway.",
            );
            return finish(
              out.some((l) => l.includes("Build OK")),
              out,
            );
          } finally {
            consoleBusy = false;
          }
        }

        case "reload":
        case "deploy": {
          consoleBusy = true;
          try {
            const out: string[] = [];
            if (cmd === "deploy") {
              out.push(...(await doGitPull()));
            }
            out.push(...(await doRebuild()));
            out.push(...(await doDiscordRestart()));
            out.push(
              "ℹ Rutas Express/código en memoria: si cambió el dist, usa `respawn`.",
            );
            return finish(
              out.some((l) => l.startsWith("✓")),
              out,
            );
          } finally {
            consoleBusy = false;
          }
        }

        case "respawn": {
          consoleBusy = true;
          try {
            const out = await doRebuild();
            if (!out.some((l) => l.includes("Build OK"))) {
              return finish(false, out);
            }
            scheduleRespawn(out);
            // Respond before process dies
            return finish(true, out);
          } finally {
            // keep busy until exit
          }
        }

        case "maintenance": {
          const mode = (args[0] ?? "").toLowerCase();
          if (mode !== "on" && mode !== "off") {
            return finish(false, [
              "Uso: maintenance on [mensaje…] | maintenance off",
            ]);
          }
          const enabled = mode === "on";
          const message = args.slice(1).join(" ").trim() || undefined;
          devState.setMaintenance(enabled, message);
          await persistConfig("maintenance_mode", enabled ? "true" : "false");
          if (message) await persistConfig("maintenance_message", message);
          return finish(true, [
            `✓ maintenance ${enabled ? "ON" : "OFF"}`,
            message ? `msg: ${message}` : "",
          ].filter(Boolean));
        }

        default:
          return finish(false, [
            `✗ Comando desconocido: \`${cmd}\``,
            "Usa `help` para la lista permitida.",
          ]);
      }
    } catch (err) {
      consoleBusy = false;
      req.log?.error({ err }, "Dev console error");
      res.status(500).json({
        ok: false,
        lines: [
          `✗ Error: ${err instanceof Error ? err.message : String(err)}`,
        ],
      });
    }
  },
);

export default router;
