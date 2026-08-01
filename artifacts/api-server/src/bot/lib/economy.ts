import { db, economyTable, inventoryTable, Economy, InventoryRow } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { PermissionFlagsBits, type GuildMember } from "discord.js";
import { logger } from "../../lib/logger.js";

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DAILY_BASE = 200;
const DAILY_STREAK_BONUS = 50;
const DAILY_STREAK_MAX_BONUS = 350;
const STARTING_BALANCE = 500;

// ── Inventory privacy cache ───────────────────────────────────────────────────

const PRIVACY_TTL_MS = 90_000;
const privacyCache = new Map<string, { v: boolean; exp: number }>();

function privacyKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function invalidatePrivacyCache(guildId: string, userId: string): void {
  privacyCache.delete(privacyKey(guildId, userId));
}

export function setPrivacyCache(
  guildId: string,
  userId: string,
  inventoryPrivate: boolean,
): void {
  privacyCache.set(privacyKey(guildId, userId), {
    v: inventoryPrivate,
    exp: Date.now() + PRIVACY_TTL_MS,
  });
}

function readPrivacyCache(guildId: string, userId: string): boolean | null {
  const hit = privacyCache.get(privacyKey(guildId, userId));
  if (!hit) return null;
  if (hit.exp <= Date.now()) {
    privacyCache.delete(privacyKey(guildId, userId));
    return null;
  }
  return hit.v;
}

export function isBotOwnerId(userId: string): boolean {
  return (process.env.OWNER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

export type InventoryViewReason =
  | "self"
  | "owner"
  | "staff"
  | "public"
  | "private";

export type InventoryViewAccess = {
  allowed: boolean;
  reason: InventoryViewReason;
  inventoryPrivate: boolean;
};

/** Staff del guild: Administrator o ManageGuild. */
export function isGuildEconomyStaff(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  const perms = member.permissions;
  return (
    perms.has(PermissionFlagsBits.Administrator) ||
    perms.has(PermissionFlagsBits.ManageGuild)
  );
}

// ── Core economy ──────────────────────────────────────────────────────────────

export async function getEconomy(guildId: string, userId: string): Promise<Economy> {
  const rows = await db
    .select()
    .from(economyTable)
    .where(and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId)))
    .limit(1);

  if (rows[0]) return rows[0];

  // Create starting account (MySQL upsert no-op on conflict)
  await db
    .insert(economyTable)
    .values({ guildId, userId, balance: STARTING_BALANCE })
    .onDuplicateKeyUpdate({
      set: { guildId: sql`${economyTable.guildId}` },
    });

  const created = await db
    .select()
    .from(economyTable)
    .where(and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId)))
    .limit(1);

  return (
    created[0] ?? {
      guildId,
      userId,
      balance: STARTING_BALANCE,
      totalEarned: 0,
      totalLost: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      streak: 0,
      lastDaily: null,
      inventoryPrivate: false,
      createdAt: new Date(),
    }
  );
}

/** Preferencia de privacidad del inventario (por guild). Cache TTL ~90s. */
export async function isInventoryPrivate(
  guildId: string,
  userId: string,
): Promise<boolean> {
  const cached = readPrivacyCache(guildId, userId);
  if (cached !== null) return cached;

  const eco = await getEconomy(guildId, userId);
  const v = Boolean(eco.inventoryPrivate);
  setPrivacyCache(guildId, userId, v);
  return v;
}

/**
 * Actualiza la privacidad del inventario.
 * No bloquea trade / uso de ítems — solo la vista pública.
 */
export async function setInventoryPrivate(
  guildId: string,
  userId: string,
  inventoryPrivate: boolean,
): Promise<boolean> {
  await ensureAccount(guildId, userId);
  await db
    .update(economyTable)
    .set({ inventoryPrivate })
    .where(
      and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId)),
    );
  setPrivacyCache(guildId, userId, inventoryPrivate);
  return inventoryPrivate;
}

/**
 * ¿Puede `viewerId` ver el inventario de `targetUserId`?
 * Dueño del inv, OWNER_IDS y staff del guild siempre pueden.
 */
export async function resolveInventoryView(
  guildId: string,
  targetUserId: string,
  viewerId: string,
  viewerMember?: GuildMember | null,
): Promise<InventoryViewAccess> {
  const inventoryPrivate = await isInventoryPrivate(guildId, targetUserId);

  if (viewerId === targetUserId) {
    return { allowed: true, reason: "self", inventoryPrivate };
  }
  if (isBotOwnerId(viewerId)) {
    return { allowed: true, reason: "owner", inventoryPrivate };
  }
  if (isGuildEconomyStaff(viewerMember)) {
    return { allowed: true, reason: "staff", inventoryPrivate };
  }
  if (!inventoryPrivate) {
    return { allowed: true, reason: "public", inventoryPrivate };
  }
  return { allowed: false, reason: "private", inventoryPrivate };
}

export async function getBalance(guildId: string, userId: string): Promise<number> {
  const eco = await getEconomy(guildId, userId);
  return eco.balance;
}

export async function addBalance(guildId: string, userId: string, amount: number): Promise<number> {
  await ensureAccount(guildId, userId);
  await db
    .update(economyTable)
    .set({
      balance: sql`${economyTable.balance} + ${amount}`,
      totalEarned: sql`${economyTable.totalEarned} + ${amount}`,
    })
    .where(and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId)));

  const rows = await db
    .select({ balance: economyTable.balance })
    .from(economyTable)
    .where(and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId)))
    .limit(1);
  return rows[0]?.balance ?? 0;
}

export async function deductBalance(
  guildId: string,
  userId: string,
  amount: number,
): Promise<{ success: boolean; balance: number }> {
  const eco = await getEconomy(guildId, userId);
  if (eco.balance < amount) return { success: false, balance: eco.balance };

  await db
    .update(economyTable)
    .set({
      balance: sql`${economyTable.balance} - ${amount}`,
      totalLost: sql`${economyTable.totalLost} + ${amount}`,
    })
    .where(and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId)));

  const rows = await db
    .select({ balance: economyTable.balance })
    .from(economyTable)
    .where(and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId)))
    .limit(1);

  return { success: true, balance: rows[0]?.balance ?? 0 };
}

export async function recordGame(
  guildId: string,
  userId: string,
  won: boolean,
  netGain: number,
): Promise<void> {
  await db
    .update(economyTable)
    .set({
      gamesPlayed: sql`${economyTable.gamesPlayed} + 1`,
      gamesWon: won ? sql`${economyTable.gamesWon} + 1` : economyTable.gamesWon,
      streak: won ? sql`${economyTable.streak} + 1` : sql`0`,
    })
    .where(and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId)));
}

// ── Daily reward ──────────────────────────────────────────────────────────────

export async function claimDaily(
  guildId: string,
  userId: string,
): Promise<{ success: true; coins: number; streak: number } | { success: false; msLeft: number }> {
  const eco = await getEconomy(guildId, userId);
  const now = Date.now();

  if (eco.lastDaily) {
    const elapsed = now - eco.lastDaily.getTime();
    if (elapsed < DAILY_COOLDOWN_MS) {
      return { success: false, msLeft: DAILY_COOLDOWN_MS - elapsed };
    }
  }

  const isConsecutive = eco.lastDaily && Date.now() - eco.lastDaily.getTime() < DAILY_COOLDOWN_MS * 2;
  const newStreak = isConsecutive ? (eco.streak ?? 0) + 1 : 1;
  const bonus = Math.min(newStreak * DAILY_STREAK_BONUS, DAILY_STREAK_MAX_BONUS);
  const coins = DAILY_BASE + bonus;

  await db
    .update(economyTable)
    .set({
      balance: sql`${economyTable.balance} + ${coins}`,
      totalEarned: sql`${economyTable.totalEarned} + ${coins}`,
      streak: newStreak,
      lastDaily: new Date(),
    })
    .where(and(eq(economyTable.guildId, guildId), eq(economyTable.userId, userId)));

  return { success: true, coins, streak: newStreak };
}

export async function getInventory(guildId: string, userId: string): Promise<InventoryRow[]> {
  return db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.guildId, guildId), eq(inventoryTable.userId, userId)));
}

export async function addItem(
  guildId: string,
  userId: string,
  itemId: string,
  qty = 1,
): Promise<void> {
  await db
    .insert(inventoryTable)
    .values({ guildId, userId, itemId, quantity: qty })
    .onDuplicateKeyUpdate({
      set: { quantity: sql`${inventoryTable.quantity} + ${qty}` },
    });
}

export async function hasItem(guildId: string, userId: string, itemId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(inventoryTable)
    .where(
      and(
        eq(inventoryTable.guildId, guildId),
        eq(inventoryTable.userId, userId),
        eq(inventoryTable.itemId, itemId),
      ),
    )
    .limit(1);
  return (rows[0]?.quantity ?? 0) > 0;
}

export async function useItem(
  guildId: string,
  userId: string,
  itemId: string,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(inventoryTable)
    .where(
      and(
        eq(inventoryTable.guildId, guildId),
        eq(inventoryTable.userId, userId),
        eq(inventoryTable.itemId, itemId),
      ),
    )
    .limit(1);

  if (!rows[0] || rows[0].quantity <= 0) return false;

  if (rows[0].quantity === 1) {
    await db
      .delete(inventoryTable)
      .where(
        and(
          eq(inventoryTable.guildId, guildId),
          eq(inventoryTable.userId, userId),
          eq(inventoryTable.itemId, itemId),
        ),
      );
  } else {
    await db
      .update(inventoryTable)
      .set({ quantity: sql`${inventoryTable.quantity} - 1` })
      .where(
        and(
          eq(inventoryTable.guildId, guildId),
          eq(inventoryTable.userId, userId),
          eq(inventoryTable.itemId, itemId),
        ),
      );
  }
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureAccount(guildId: string, userId: string): Promise<void> {
  await db
    .insert(economyTable)
    .values({ guildId, userId, balance: STARTING_BALANCE })
    .onDuplicateKeyUpdate({
      set: { guildId: sql`${economyTable.guildId}` },
    });
}

export function calculateBlackjackPayout(
  status: string,
  bet: number,
  multiplierActive: boolean,
  insuranceActive: boolean,
  /** Seguro beta/dev: devuelve el 100% de la apuesta en derrota */
  fullInsuranceActive = false,
): number {
  if (status === "blackjack") {
    const net = Math.floor(bet * 1.5);
    return bet + (multiplierActive ? net * 2 : net);
  }
  if (status === "push") return bet;
  if (status === "win" || status === "dealer_bust") {
    return multiplierActive ? bet * 3 : bet * 2;
  }
  if (status === "bust" || status === "lose") {
    if (fullInsuranceActive) return bet;
    if (insuranceActive) return Math.floor(bet * 0.5);
    return 0;
  }
  return 0;
}

/** Consume 1 multi + 1 seguro del inventario (prioriza exclusivos). */
export async function consumeBlackjackPassives(
  guildId: string,
  userId: string,
): Promise<{
  multiplierActive: boolean;
  insuranceActive: boolean;
  fullInsuranceActive: boolean;
}> {
  const {
    MULTIPLIER_ITEM_IDS,
    INSURANCE_ITEM_IDS,
    FULL_INSURANCE_ITEM_IDS,
  } = await import("./shop.js");

  let multiplierActive = false;
  for (const id of MULTIPLIER_ITEM_IDS) {
    if (await hasItem(guildId, userId, id)) {
      await useItem(guildId, userId, id);
      multiplierActive = true;
      break;
    }
  }

  let fullInsuranceActive = false;
  for (const id of FULL_INSURANCE_ITEM_IDS) {
    if (await hasItem(guildId, userId, id)) {
      await useItem(guildId, userId, id);
      fullInsuranceActive = true;
      break;
    }
  }

  let insuranceActive = fullInsuranceActive;
  if (!fullInsuranceActive) {
    for (const id of INSURANCE_ITEM_IDS) {
      if (await hasItem(guildId, userId, id)) {
        await useItem(guildId, userId, id);
        insuranceActive = true;
        break;
      }
    }
  }

  return { multiplierActive, insuranceActive, fullInsuranceActive };
}
