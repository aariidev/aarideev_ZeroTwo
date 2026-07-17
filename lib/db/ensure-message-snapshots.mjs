/**
 * Ensure message_snapshots exists on MySQL zerotwo.
 * Run: node lib/db/ensure-message-snapshots.mjs
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
CREATE TABLE IF NOT EXISTS message_snapshots (
  message_id VARCHAR(32) PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  channel_id VARCHAR(32) NOT NULL,
  author_id VARCHAR(32) NOT NULL,
  author_tag VARCHAR(120) NOT NULL,
  author_bot TINYINT(1) NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  attachments TEXT NOT NULL,
  stickers TEXT NOT NULL,
  embed_count INT NOT NULL DEFAULT 0,
  webhook_id VARCHAR(32) NULL,
  message_created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  message_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  indexed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX msg_snap_guild_ch (guild_id, channel_id),
  INDEX msg_snap_author (author_id),
  INDEX msg_snap_indexed (indexed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✓ message_snapshots OK");
await conn.end();
