import { Router, type Request, type Response } from "express";
import {
  ChannelType,
  type Client,
  type Guild as DjsGuild,
} from "discord.js";
import { db, guildLogSettingsTable } from "@workspace/db";
import {
  getGuildLogSettings,
  LOG_CATEGORIES,
  LOG_EVENT_KEYS,
  LOG_EVENT_META,
  setGuildLogSettings,
  type GuildLogSettings,
  type LogEventKey,
} from "../bot/lib/modlog.js";
import {
  assertGuildManage,
  resolveGuildAccess,
} from "../lib/guildAccess.js";
import { logger } from "../lib/logger.js";
import { validateBody, PatchGuildSettingsBody } from "../middleware/validate.js";

const router = Router();
let botClient: Client | null = null;

export function setBotClient(client: Client) {
  botClient = client;
}

const MAX_CHANNELS = 250;
const MAX_ROLES = 200;

function listTextChannels(guild: DjsGuild) {
  return guild.channels.cache
    .filter(
      (ch) =>
        ch.type === ChannelType.GuildText ||
        ch.type === ChannelType.GuildAnnouncement,
    )
    .map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type === ChannelType.GuildAnnouncement ? "announcement" : "text",
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_CHANNELS);
}

function listRoles(guild: DjsGuild) {
  return guild.roles.cache
    .filter((r) => r.id !== guild.id && !r.managed)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      position: r.position,
    }))
    .sort((a, b) => b.position - a.position)
    .slice(0, MAX_ROLES);
}

function eventCatalog() {
  return LOG_EVENT_KEYS.map((key) => ({
    key,
    label: LOG_EVENT_META[key].label,
    category: LOG_EVENT_META[key].category,
    description: LOG_EVENT_META[key].description,
  }));
}

function categoryCatalog() {
  return LOG_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    events: c.events.map((key) => ({
      key,
      label: LOG_EVENT_META[key].label,
      description: LOG_EVENT_META[key].description,
    })),
  }));
}

function mergeSettingsPatch(
  current: GuildLogSettings,
  body: Record<string, unknown>,
  guild: DjsGuild,
): { ok: true; settings: GuildLogSettings } | { ok: false; error: string } {
  const src = body.settings
    ? (body.settings as Record<string, unknown>)
    : body;
  const next: GuildLogSettings = { ...current };

  if ("logChannelId" in src || "channelId" in src) {
    const id = (src.logChannelId ?? src.channelId) as string | null;
    if (id === null || id === "" || id === "none") {
      next.channelId = null;
    } else if (typeof id === "string") {
      const ch = guild.channels.cache.get(id);
      if (
        !ch ||
        (ch.type !== ChannelType.GuildText &&
          ch.type !== ChannelType.GuildAnnouncement)
      ) {
        return { ok: false, error: "Canal de logs inválido" };
      }
      next.channelId = id;
    }
  }

  if ("logEvents" in src || "events" in src) {
    const ev = (src.logEvents ?? src.events) as unknown;
    if (Array.isArray(ev)) {
      const allowed = new Set<string>(LOG_EVENT_KEYS);
      next.events = ev.filter(
        (k): k is LogEventKey => typeof k === "string" && allowed.has(k),
      );
    }
  }

  if ("ignoreBots" in src && typeof src.ignoreBots === "boolean") {
    next.ignoreBots = src.ignoreBots;
  }
  if ("ignoreWebhooks" in src && typeof src.ignoreWebhooks === "boolean") {
    next.ignoreWebhooks = src.ignoreWebhooks;
  }
  if ("includeAttachments" in src && typeof src.includeAttachments === "boolean") {
    next.includeAttachments = src.includeAttachments;
  }

  if ("joinAlertDays" in src) {
    const n = Number(src.joinAlertDays);
    if (Number.isFinite(n) && n >= 0) {
      next.joinAlertDays = Math.min(365, Math.floor(n));
    }
  }

  if ("ignoreChannels" in src && Array.isArray(src.ignoreChannels)) {
    next.ignoreChannels = (src.ignoreChannels as unknown[])
      .filter((x): x is string => typeof x === "string")
      .filter((id) => guild.channels.cache.has(id));
  }

  if ("pingRoleId" in src) {
    const roleId = src.pingRoleId as string | null;
    if (roleId === null || roleId === "" || roleId === "none") {
      next.pingRoleId = null;
    } else if (typeof roleId === "string") {
      if (!guild.roles.cache.has(roleId)) {
        return { ok: false, error: "Rol de mención inválido" };
      }
      next.pingRoleId = roleId;
    }
  }

  return { ok: true, settings: next };
}

// ── GET /guilds ──────────────────────────────────────────────────────────────
// Per-user: only servers where bot is present AND user is a member.
// Owners see every bot guild.

router.get("/", async (req: Request, res: Response) => {
  try {
    if (!botClient) {
      return res.status(200).json([]);
    }

    const access = await resolveGuildAccess(req, botClient);

    // Non-owners: only their memberships. Never leak the full bot list.
    const visibleIds = access.isOwner
      ? access.botGuildIds
      : access.memberGuildIds;

    let settingsMap = new Map<
      string,
      { channelId: string | null; events: string }
    >();
    try {
      const rows = await db.select().from(guildLogSettingsTable);
      settingsMap = new Map(
        rows
          .filter((r) => visibleIds.has(r.guildId))
          .map((r) => [
            r.guildId,
            { channelId: r.channelId, events: r.events },
          ]),
      );
    } catch (err) {
      logger.warn({ err }, "Could not batch-load guild_log_settings");
    }

    const guilds = [...visibleIds]
      .map((id) => botClient!.guilds.cache.get(id))
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .map((guild) => {
        const canManage = access.manageGuildIds.has(guild.id);
        const row = settingsMap.get(guild.id);
        let logChannelId: string | null = row?.channelId ?? null;
        let logEvents: string[] = [];
        if (row?.events) {
          try {
            const parsed = JSON.parse(row.events);
            if (Array.isArray(parsed)) logEvents = parsed.map(String);
          } catch {
            logEvents = [];
          }
        }
        return {
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
          iconUrl: guild.iconURL({ size: 128 }) ?? null,
          joinedAt: guild.joinedAt?.toISOString() ?? new Date().toISOString(),
          canManage,
          logChannelId,
          logEvents,
        };
      });

    // Sort: manageable first, then by name
    guilds.sort((a, b) => {
      if (a.canManage !== b.canManage) return a.canManage ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.status(200).json(guilds);
  } catch (err) {
    req.log?.error({ err }, "❌ Error al listar los servidores activos");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /guilds/log-event-types ──────────────────────────────────────────────

router.get("/log-event-types", (_req: Request, res: Response) => {
  res.status(200).json({
    events: eventCatalog(),
    categories: categoryCatalog(),
  });
});

// ── GET /guilds/:id/settings ─────────────────────────────────────────────────

router.get("/:id/settings", async (req: Request, res: Response) => {
  const started = Date.now();
  try {
    const guildId = req.params.id;
    if (!botClient) {
      return res.status(503).json({ error: "Bot offline" });
    }
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Bot no está en ese servidor" });
    }

    const access = await resolveGuildAccess(req, botClient);
    const gate = assertGuildManage(access, guildId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const settings = await getGuildLogSettings(guildId);
    const channels = listTextChannels(guild);
    const roles = listRoles(guild);

    res.status(200).json({
      guildId,
      name: guild.name,
      iconUrl: guild.iconURL({ size: 128 }) ?? null,
      settings,
      logChannelId: settings.channelId,
      logEvents: settings.events,
      ignoreBots: settings.ignoreBots,
      ignoreWebhooks: settings.ignoreWebhooks,
      ignoreChannels: settings.ignoreChannels,
      joinAlertDays: settings.joinAlertDays,
      includeAttachments: settings.includeAttachments,
      pingRoleId: settings.pingRoleId,
      channels,
      roles,
      availableEvents: eventCatalog(),
      categories: categoryCatalog(),
      _ms: Date.now() - started,
    });
  } catch (err) {
    req.log?.error({ err }, "GET guild settings failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /guilds/:id/settings ───────────────────────────────────────────────

router.patch("/:id/settings", validateBody(PatchGuildSettingsBody), async (req: Request, res: Response) => {
  try {
    const guildId = req.params.id;
    if (!botClient) {
      return res.status(503).json({ error: "Bot offline" });
    }
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Bot no está en ese servidor" });
    }

    const access = await resolveGuildAccess(req, botClient);
    const gate = assertGuildManage(access, guildId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const current = await getGuildLogSettings(guildId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const merged = mergeSettingsPatch(current, body, guild);
    if (!merged.ok) {
      return res.status(400).json({ error: merged.error });
    }

    const settings = await setGuildLogSettings(guildId, merged.settings);

    res.status(200).json({
      ok: true,
      guildId,
      settings,
      logChannelId: settings.channelId,
      logEvents: settings.events,
    });
  } catch (err) {
    req.log?.error({ err }, "PATCH guild settings failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
