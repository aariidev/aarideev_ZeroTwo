/**
 * Ensure guild_music_settings exists.
 * SNAPSHOT: antes del pack de alta prioridad (sin dj_role_id).
 */
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = path.join(rootDir, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const url = process.env.DATABASE_URL || "mysql://root@127.0.0.1:3306/zerotwo";
const conn = await mysql.createConnection(url);
await conn.query(`
CREATE TABLE IF NOT EXISTS guild_music_settings (
  guild_id VARCHAR(32) PRIMARY KEY,
  channel_id VARCHAR(32) NULL,
  message_id VARCHAR(32) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✓ guild_music_settings OK");
await conn.end();