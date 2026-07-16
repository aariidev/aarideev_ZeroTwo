import { Router, type Request, type Response } from "express";
import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Guild as DjsGuild,
  type TextChannel,
} from "discord.js";
import {
  defaultGuildLogSettings,
  getGuildLogSettings,
  getLogChannelId,
  getLogEvents,
  LOG_CATEGORIES,
  LOG_EVENT_KEYS,
  LOG_EVENT_META,
  setGuildLogSettings,
  type GuildLogSettings,
  type LogEventKey,
} from "../bot/lib/modlog.js";
import { logger } from "../lib/logger.js";

const router = Router();
let botClient: Client | null = null;

export function setBotClient(client: Client) {
  botClient = client;
}

interface DiscordUserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

const MANAGE_GUILD = BigInt(PermissionFlagsBits.ManageGuild);
const ADMINISTRATOR = BigInt(PermissionFlagsBits.Administrator);

function canManageUserGuild(g: DiscordUserGuild): boolean {
  if (g.owner) return true;
  try {
    const perms = BigInt(g.permissions);
    return (
      (perms & ADMINISTRATOR) === ADMINISTRATOR ||
      (perms & MANAGE_GUILD) === MANAGE_GUILD
    );
  } catch {
    return false;
  }
}

function isBotDeveloper(userId: string | undefined): boolean {
  if (!userId) return false;
  return (process.env.OWNER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

async function fetchUserGuilds(
  accessToken: string,
): Promise<DiscordUserGuild[]> {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    logger.warn({ status: res.status, text }, "Failed to fetch user guilds");
    return [];
  }
  return (await res.json()) as DiscordUserGuild[];
}

async function assertCanConfigure(
  req: Request,
  guildId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (isBotDeveloper(req.sessionUser?.id)) return { ok: true };

  if (!req.accessToken) {
    return {
      ok: false,
      status: 401,
      error: "Reconecta Discord (scope guilds) para gestionar servidores.",
    };
  }

  const userGuilds = await fetchUserGuilds(req.accessToken);
  const ug = userGuilds.find((g) => g.id === guildId);
  if (!ug || !canManageUserGuild(ug)) {
    return {
      ok: false,
      status: 403,
      error: "Solo el dueño o un admin del servidor puede editar esta config.",
    };
  }
  return { ok: true };
}

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
    .sort((a, b) => a.name.localeCompare(b.name));
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
    .sort((a, b) => b.position - a.position);
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
  const next: GuildLogSettings = { ...current };

  // Support both flat legacy fields and nested `settings` object
  const src =
    body.settings && typeof body.settings === "object"
      ? (body.settings as Record<string, unknown>)
      : body;

  if ("logChannelId" in src || "channelId" in src) {
    const chId = (src.logChannelId ?? src.channelId) as string | null;
    if (chId === null || chId === "" || chId === "none") {
      next.channelId = null;
    } else if (typeof chId === "string") {
      const ch = guild.channels.cache.get(chId);
      if (
        !ch ||
        (ch.type !== ChannelType.GuildText &&
          ch.type !== ChannelType.GuildAnnouncement)
      ) {
        return { ok: false, error: "Canal de logs inválido" };
      }
      const me = guild.members.me;
      if (me && ch.isTextBased()) {
        const perms = (ch as TextChannel).permissionsFor(me);
        if (perms && !perms.has(["SendMessages", "EmbedLinks"])) {
          logger.warn(
            { guildId: guild.id, chId },
            "Bot may lack SendMessages/EmbedLinks in log channel",
          );
        }
      }
      next.channelId = chId;
    }
  }

  if ("logEvents" in src || "events" in src) {
    const raw = (src.logEvents ?? src.events) as unknown;
    if (Array.isArray(raw)) {
      const allowed = new Set<string>(LOG_EVENT_KEYS);
      const events = raw.filter(
        (k): k is LogEventKey => typeof k === "string" && allowed.has(k),
      );
      next.events = events.length
        ? events
        : defaultGuildLogSettings().events;
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

router.get("/", async (req: Request, res: Response) => {
  try {
    if (!botClient) {
      return res.status(200).json([]);
    }

    let manageable = new Set<string>();
    if (req.accessToken) {
      try {
        const userGuilds = await fetchUserGuilds(req.accessToken);
        manageable = new Set(
          userGuilds.filter(canManageUserGuild).map((g) => g.id),
        );
      } catch (err) {
        logger.warn({ err }, "Could not resolve user guild permissions");
      }
    }

    if (isBotDeveloper(req.sessionUser?.id)) {
      manageable = new Set(botClient.guilds.cache.map((g) => g.id));
    }

    const guilds = await Promise.all(
      botClient.guilds.cache.map(async (guild) => {
        const canManage = manageable.has(guild.id);
        const logChannelId = await getLogChannelId(guild.id);
        const logEvents = await getLogEvents(guild.id);
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
      }),
    );

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
  try {
    const guildId = req.params.id;
    if (!botClient) {
      return res.status(503).json({ error: "Bot offline" });
    }
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Bot no está en ese servidor" });
    }

    const gate = await assertCanConfigure(req, guildId);
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
      // Full settings object
      settings,
      // Legacy flat fields (dashboard / older clients)
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
    });
  } catch (err) {
    req.log?.error({ err }, "GET guild settings failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /guilds/:id/settings ───────────────────────────────────────────────

router.patch("/:id/settings", async (req: Request, res: Response) => {
  try {
    const guildId = req.params.id;
    if (!botClient) {
      return res.status(503).json({ error: "Bot offline" });
    }
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Bot no está en ese servidor" });
    }

    const gate = await assertCanConfigure(req, guildId);
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
