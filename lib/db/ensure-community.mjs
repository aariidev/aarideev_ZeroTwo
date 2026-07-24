/**
 * Ensure community tables (suggestions, antiraid, levels).
 * Run: node lib/db/ensure-community.mjs
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
if (!url.startsWith("mysql")) {
  console.error("DATABASE_URL must be mysql://...");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

await conn.query(`
CREATE TABLE IF NOT EXISTS guild_suggestion_settings (
  guild_id VARCHAR(32) PRIMARY KEY,
  channel_id VARCHAR(32) NULL,
  log_channel_id VARCHAR(32) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);

await conn.query(`
CREATE TABLE IF NOT EXISTS suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  username VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  message_id VARCHAR(32) NULL,
  channel_id VARCHAR(32) NULL,
  reviewed_by VARCHAR(32) NULL,
  review_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  INDEX suggestions_guild_status (guild_id, status),
  INDEX suggestions_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);

await conn.query(`
CREATE TABLE IF NOT EXISTS guild_antiraid_settings (
  guild_id VARCHAR(32) PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  threshold INT NOT NULL DEFAULT 5,
  time_window INT NOT NULL DEFAULT 60,
  action VARCHAR(16) NOT NULL DEFAULT 'kick',
  log_channel_id VARCHAR(32) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);

await conn.query(`
CREATE TABLE IF NOT EXISTS guild_level_settings (
  guild_id VARCHAR(32) PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  xp_min INT NOT NULL DEFAULT 15,
  xp_max INT NOT NULL DEFAULT 25,
  cooldown_sec INT NOT NULL DEFAULT 60,
  voice_xp_per_min INT NOT NULL DEFAULT 5,
  announce_channel_id VARCHAR(32) NULL,
  announce_in_place TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);

await conn.query(`
CREATE TABLE IF NOT EXISTS user_levels (
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 0,
  total_messages INT NOT NULL DEFAULT 0,
  voice_minutes INT NOT NULL DEFAULT 0,
  last_xp_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id),
  INDEX user_levels_guild_xp (guild_id, xp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);

console.log("✓ community tables OK on", url.replace(/:([^:@/]+)@/, ":***@"));
await conn.end();
