/**
 * Beta Testers access control system
 *
 * Manages which users have access to beta features and dev-only content.
 * Uses BETATESTERS_IDS environment variable (comma-separated user IDs).
 */

const CACHE_TTL_MS = 60 * 1000; // 1 minute

let cachedIds: Set<string> | null = null;
let cacheTime = 0;

/**
 * Get all betatester user IDs from environment
 */
function getBetatestersIds(): Set<string> {
  const now = Date.now();

  // Return cached result if still fresh
  if (cachedIds && now - cacheTime < CACHE_TTL_MS) {
    return cachedIds;
  }

  const env = process.env.BETATESTERS_IDS ?? "";
  const ids = env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  cachedIds = new Set(ids);
  cacheTime = now;

  return cachedIds;
}

/**
 * Check if a user is a beta tester
 */
export function isBetaTester(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return getBetatestersIds().has(userId);
}

/**
 * Add a user to beta testers (in-memory only, use env for persistence)
 */
export function addBetaTester(userId: string): void {
  const ids = getBetatestersIds();
  ids.add(userId);
}

/**
 * Remove a user from beta testers (in-memory only)
 */
export function removeBetaTester(userId: string): void {
  const ids = getBetatestersIds();
  ids.delete(userId);
}

/**
 * Get all beta tester IDs
 */
export function getAllBetatesters(): string[] {
  return Array.from(getBetatestersIds());
}

/**
 * Invalidate cache (call after .env changes)
 */
export function invalidateCache(): void {
  cachedIds = null;
  cacheTime = 0;
}

/**
 * Betatester permissions/features
 */
export interface BetaTesterFeatures {
  canAccessBetaPanel: boolean;
  canAccessBetaFeatures: boolean;
  canUseBetaCommands: boolean;
  betaFeaturesEnabled: string[];
}

/**
 * Get features available to a beta tester
 */
export function getBetaTesterFeatures(userId: string): BetaTesterFeatures {
  const isBeta = isBetaTester(userId);

  return {
    canAccessBetaPanel: isBeta,
    canAccessBetaFeatures: isBeta,
    canUseBetaCommands: isBeta,
    betaFeaturesEnabled: isBeta ? ["dashboard", "commands", "api"] : [],
  };
}
