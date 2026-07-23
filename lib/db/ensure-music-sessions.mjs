/**
 * Ensure music_sessions table exists (resume after restart).
 * Run: node lib/db/ensure-music-sessions.mjs
 */
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const url = process.env.DATABASE_URL || "mysql://root@127.0.0.1:3306/zerotwo";
const conn = await mysql.createConnection(url);
await conn.query(`
CREATE TABLE IF NOT EXISTS music_sessions (
  guild_id VARCHAR(32) PRIMARY KEY,
  voice_channel_id VARCHAR(32) NULL,
  text_channel_id VARCHAR(32) NULL,
  payload MEDIUMTEXT NOT NULL,
  playback_sec INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✓ music_sessions OK");
await conn.end();
