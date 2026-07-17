/**
 * Per-user guild access for the dashboard.
 *
 * Owners (OWNER_IDS): all bot guilds.
 * Everyone else: only guilds returned by Discord OAuth (/users/@me/guilds)
 * that the bot is also in. Manage Guild / Admin / Owner → canManage.
 */
import type { Request } from "express";
import { PermissionFlagsBits, type Client } from "discord.js";
import { logger } from "./logger.js";

export interface DiscordUserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface GuildAccess {
  isOwner: boolean;
  /** Guilds the bot is in */
  botGuildIds: Set<string>;
  /** User is a member AND bot is present */
  memberGuildIds: Set<string>;
  /** User can manage (admin / manage guild / owner) AND bot is present */
  manageGuildIds: Set<string>;
}

const MANAGE_GUILD = BigInt(PermissionFlagsBits.ManageGuild);
const ADMINISTRATOR = BigInt(PermissionFlagsBits.Administrator);

const USER_GUILDS_TTL_MS = 5 * 60 * 1000;
const USER_GUILDS_STALE_MS = 30 * 60 * 1000;
const userGuildsCache = new Map<
  string,
  {
    guilds: DiscordUserGuild[];
    fetchedAt: number;
    inflight?: Promise<DiscordUserGuild[]>;
  }
>();

export function ownerIds(): string[] {
  return (process.env.OWNER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isBotOwner(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return ownerIds().includes(userId);
}

export function canManageUserGuild(g: DiscordUserGuild): boolean {
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchUserGuildsFromDiscord(
  accessToken: string,
): Promise<DiscordUserGuild[]> {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(6_000),
  });

  if (res.status === 429) {
    const text = await res.text();
    let retryAfter = 0.5;
    try {
      const body = JSON.parse(text) as { retry_after?: number };
      if (typeof body.retry_after === "number") {
        retryAfter = Math.min(1.5, Math.max(0.2, body.retry_after));
      }
    } catch {
      /* ignore */
    }
    logger.warn({ retryAfter }, "Discord guilds rate-limited — short retry");
    await sleep(Math.ceil(retryAfter * 1000) + 50);
    const retry = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!retry.ok) {
      throw new Error(`discord_guilds_${retry.status}`);
    }
    return (await retry.json()) as DiscordUserGuild[];
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn({ status: res.status, text }, "Failed to fetch user guilds");
    throw new Error(`discord_guilds_${res.status}`);
  }
  return (await res.json()) as DiscordUserGuild[];
}

/** Cached Discord OAuth guild list for the access token. */
export async function fetchUserGuilds(
  accessToken: string,
): Promise<DiscordUserGuild[]> {
  const key = accessToken.slice(0, 24);
  const now = Date.now();
  const hit = userGuildsCache.get(key);

  if (hit && now - hit.fetchedAt < USER_GUILDS_TTL_MS) {
    return hit.guilds;
  }
  if (hit?.inflight) {
    return hit.inflight;
  }

  const inflight = (async () => {
    try {
      const guilds = await fetchUserGuildsFromDiscord(accessToken);
      userGuildsCache.set(key, { guilds, fetchedAt: Date.now() });
      return guilds;
    } catch (err) {
      if (hit && now - hit.fetchedAt < USER_GUILDS_STALE_MS) {
        logger.warn(
          { err, ageMs: now - hit.fetchedAt },
          "Using stale user guilds cache after Discord error",
        );
        return hit.guilds;
      }
      return [];
    } finally {
      const cur = userGuildsCache.get(key);
      if (cur) delete cur.inflight;
    }
  })();

  userGuildsCache.set(key, {
    guilds: hit?.guilds ?? [],
    fetchedAt: hit?.fetchedAt ?? 0,
    inflight,
  });

  return inflight;
}

/**
 * Resolve which bot guilds the current session may see / manage.
 * Non-owners NEVER receive the full bot guild list.
 */
export async function resolveGuildAccess(
  req: Request,
  botClient: Client | null,
): Promise<GuildAccess> {
  const botGuildIds = new Set(
    botClient ? [...botClient.guilds.cache.keys()] : [],
  );
  const uid = req.sessionUser?.id;

  if (isBotOwner(uid)) {
    return {
      isOwner: true,
      botGuildIds,
      memberGuildIds: new Set(botGuildIds),
      manageGuildIds: new Set(botGuildIds),
    };
  }

  if (!req.accessToken) {
    logger.warn(
      { userId: uid },
      "Session without accessToken — no guild access",
    );
    return {
      isOwner: false,
      botGuildIds,
      memberGuildIds: new Set(),
      manageGuildIds: new Set(),
    };
  }

  try {
    const userGuilds = await Promise.race([
      fetchUserGuilds(req.accessToken),
      sleep(7_000).then(() => {
        throw new Error("guilds_timeout");
      }),
    ]);

    const memberGuildIds = new Set<string>();
    const manageGuildIds = new Set<string>();
    for (const g of userGuilds) {
      if (!botGuildIds.has(g.id)) continue;
      memberGuildIds.add(g.id);
      if (canManageUserGuild(g)) manageGuildIds.add(g.id);
    }

    return {
      isOwner: false,
      botGuildIds,
      memberGuildIds,
      manageGuildIds,
    };
  } catch (err) {
    logger.warn({ err, userId: uid }, "resolveGuildAccess failed");
    return {
      isOwner: false,
      botGuildIds,
      memberGuildIds: new Set(),
      manageGuildIds: new Set(),
    };
  }
}

/** Guilds whose data (tickets, warns, logs) the user may read. */
export function dataScopeGuildIds(access: GuildAccess): Set<string> {
  // Owners: all. Others: only servers they can manage (staff).
  return access.isOwner ? access.botGuildIds : access.manageGuildIds;
}

export function assertGuildManage(
  access: GuildAccess,
  guildId: string,
): { ok: true } | { ok: false; status: number; error: string } {
  if (access.manageGuildIds.has(guildId)) return { ok: true };
  if (access.memberGuildIds.has(guildId)) {
    return {
      ok: false,
      status: 403,
      error: "Necesitas permiso de Administrador o Gestionar servidor.",
    };
  }
  return {
    ok: false,
    status: 403,
    error: "No tienes acceso a este servidor en el dashboard.",
  };
}
