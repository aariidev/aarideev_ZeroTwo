import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * MySQL/MariaDB pool — tuned for Discord bot + dashboard concurrent load.
 *
 * - keepAlive avoids idle disconnects on XAMPP/MariaDB
 * - charset utf8mb4 for emojis / Japanese names
 * - timezone Z so TIMESTAMP round-trips consistently
 */
export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: Number(process.env.DB_POOL_SIZE ?? 20),
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  connectTimeout: 10_000,
  idleTimeout: 60_000,
  maxIdle: 8,
  charset: "utf8mb4",
  timezone: "Z",
  dateStrings: false,
  supportBigNumbers: true,
  // Named placeholders off — drizzle uses positional
  namedPlaceholders: false,
});

export const db = drizzle(pool, { schema, mode: "default" });

/** Lightweight ping for health endpoints */
export async function pingDb(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const conn = await pool.getConnection();
    try {
      await conn.ping();
      return { ok: true, ms: Date.now() - t0 };
    } finally {
      conn.release();
    }
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Pool snapshot for diagnostics (no secrets) */
export function poolStats(): {
  threadId?: number;
  connectionLimit: number;
} {
  return {
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 20),
  };
}

export * from "./schema";
