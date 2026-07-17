/**
 * Ensure guild_log_settings / guild_ticket_settings / app_settings exist on MySQL zerotwo.
 * Run: node lib/db/ensure-guild-settings.mjs  (from repo root with DATABASE_URL)
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
  console.error("DATABASE_URL must be mysql://... for HeidiSQL/MariaDB");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
await conn.query(`
CREATE TABLE IF NOT EXISTS guild_log_settings (
  guild_id VARCHAR(32) PRIMARY KEY,
  channel_id VARCHAR(32) NULL,
  events TEXT NOT NULL,
  ignore_bots TINYINT(1) NOT NULL DEFAULT 1,
  ignore_webhooks TINYINT(1) NOT NULL DEFAULT 1,
  ignore_channels TEXT NOT NULL,
  join_alert_days INT NOT NULL DEFAULT 7,
  include_attachments TINYINT(1) NOT NULL DEFAULT 1,
  ping_role_id VARCHAR(32) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
await conn.query(`
CREATE TABLE IF NOT EXISTS guild_ticket_settings (
  guild_id VARCHAR(32) PRIMARY KEY,
  category_id VARCHAR(32) NULL,
  staff_role_id VARCHAR(32) NULL,
  log_channel_id VARCHAR(32) NULL,
  max_open INT NOT NULL DEFAULT 1,
  delete_after_close_sec INT NOT NULL DEFAULT 10,
  panel_title VARCHAR(150) NOT NULL DEFAULT '🎫 Centro de Tickets',
  panel_description TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
await conn.query(`
CREATE TABLE IF NOT EXISTS app_settings (
  \`key\` VARCHAR(191) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✓ guild_log_settings, guild_ticket_settings, app_settings OK on", url.replace(/:([^:@/]+)@/, ":***@"));
await conn.end();
