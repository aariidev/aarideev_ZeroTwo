/**
 * Create all Zero Two tables on local MariaDB/MySQL (HeidiSQL database: zerotwo)
 * and optionally copy data from Neon Postgres (SOURCE_DATABASE_URL).
 *
 * Usage:
 *   set DATABASE_URL=mysql://root@127.0.0.1:3306/zerotwo
 *   node lib/db/migrate-to-zerotwo.mjs
 */
import mysql from "mysql2/promise";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = path.join(root, ".env");
const envMap = {};
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
    envMap[m[1]] = v;
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const TARGET =
  process.env.DATABASE_URL?.startsWith("mysql")
    ? process.env.DATABASE_URL
    : "mysql://root@127.0.0.1:3306/zerotwo";

// Previous Neon URL (backup) — never use mysql DATABASE_URL as source
const SOURCE =
  process.env.SOURCE_DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL_NEON ||
  envMap.SOURCE_DATABASE_URL ||
  envMap.NEON_DATABASE_URL ||
  envMap.DATABASE_URL_NEON ||
  (envMap.DATABASE_URL?.startsWith("postgres") ? envMap.DATABASE_URL : null) ||
  null;

const DDL = `
CREATE DATABASE IF NOT EXISTS zerotwo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE zerotwo;

CREATE TABLE IF NOT EXISTS warns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  username VARCHAR(100) NOT NULL,
  moderator_id VARCHAR(32) NOT NULL,
  moderator_name VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (guild_id),
  INDEX (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  command VARCHAR(64) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  username VARCHAR(100) NOT NULL,
  guild_id VARCHAR(32) NOT NULL,
  guild_name VARCHAR(150) NOT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  success TINYINT(1) NOT NULL DEFAULT 1,
  INDEX (guild_id),
  INDEX (command)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS command_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  command VARCHAR(64) NOT NULL UNIQUE,
  count INT NOT NULL DEFAULT 0,
  last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bot_config (
  \`key\` VARCHAR(191) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bot_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level VARCHAR(16) NOT NULL DEFAULT 'info',
  event VARCHAR(64) NOT NULL,
  details TEXT NOT NULL,
  guild_id VARCHAR(32) NULL,
  guild_name VARCHAR(150) NULL,
  user_id VARCHAR(32) NULL,
  username VARCHAR(100) NULL,
  moderator_id VARCHAR(32) NULL,
  moderator_name VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (event),
  INDEX (guild_id),
  INDEX (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS changelogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(32) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'feature',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS economy (
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  balance INT NOT NULL DEFAULT 500,
  total_earned INT NOT NULL DEFAULT 0,
  total_lost INT NOT NULL DEFAULT 0,
  games_played INT NOT NULL DEFAULT 0,
  games_won INT NOT NULL DEFAULT 0,
  streak INT NOT NULL DEFAULT 0,
  last_daily TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory (
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  item_id VARCHAR(64) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  acquired_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  channel_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  username VARCHAR(100) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'soporte',
  subject TEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  claimed_by VARCHAR(32) NULL,
  claimed_by_name VARCHAR(100) NULL,
  closed_by VARCHAR(32) NULL,
  closed_by_name VARCHAR(100) NULL,
  close_reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  INDEX (guild_id, user_id),
  INDEX (channel_id),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS app_settings (
  \`key\` VARCHAR(191) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
`;

console.log("Target:", TARGET.replace(/:([^:@/]+)@/, ":***@"));
const conn = await mysql.createConnection(TARGET.includes("zerotwo") ? TARGET.replace(/\/zerotwo.*/, "/") : TARGET);
await conn.query("CREATE DATABASE IF NOT EXISTS zerotwo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
await conn.changeUser({ database: "zerotwo" });

for (const stmt of DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
  if (stmt.startsWith("CREATE DATABASE") || stmt.startsWith("USE ")) continue;
  await conn.query(stmt);
}
console.log("✓ Schema created on zerotwo");

// ── Copy from Neon if available ────────────────────────────────────────────
if (SOURCE && SOURCE.startsWith("postgres")) {
  console.log("Source Neon detected — copying data…");
  const pgPool = new pg.Pool({ connectionString: SOURCE });

  async function copyTable(name, columns, transform = (r) => r) {
    try {
      const { rows } = await pgPool.query(`SELECT * FROM ${name}`);
      if (!rows.length) {
        console.log(`  · ${name}: 0 rows`);
        return;
      }
      let n = 0;
      for (const row of rows) {
        const r = transform(row);
        const cols = columns;
        const vals = cols.map((c) => r[c] ?? null);
        const ph = cols.map(() => "?").join(",");
        // backtick reserved names (e.g. key)
        const colList = cols.map((c) => `\`${c}\``).join(",");
        const sql = `INSERT IGNORE INTO \`${name}\` (${colList}) VALUES (${ph})`;
        await conn.query(sql, vals);
        n++;
      }
      console.log(`  · ${name}: ${n} rows`);
    } catch (e) {
      console.log(`  · ${name}: skip (${e.message.split("\n")[0]})`);
    }
  }

  // pg returns snake_case column names
  await copyTable("warns", [
    "id",
    "guild_id",
    "user_id",
    "username",
    "moderator_id",
    "moderator_name",
    "reason",
    "created_at",
  ]);
  await copyTable("activity", [
    "id",
    "command",
    "user_id",
    "username",
    "guild_id",
    "guild_name",
    "executed_at",
    "success",
  ], (r) => ({ ...r, success: r.success ? 1 : 0 }));
  await copyTable("command_stats", ["id", "command", "count", "last_used"]);
  await copyTable("bot_config", ["key", "value", "updated_at"]);
  await copyTable("bot_logs", [
    "id",
    "level",
    "event",
    "details",
    "guild_id",
    "guild_name",
    "user_id",
    "username",
    "moderator_id",
    "moderator_name",
    "created_at",
  ]);
  await copyTable("changelogs", [
    "id",
    "version",
    "title",
    "description",
    "type",
    "created_at",
  ]);
  await copyTable("economy", [
    "guild_id",
    "user_id",
    "balance",
    "total_earned",
    "total_lost",
    "games_played",
    "games_won",
    "streak",
    "last_daily",
    "created_at",
  ]);
  await copyTable("inventory", [
    "guild_id",
    "user_id",
    "item_id",
    "quantity",
    "acquired_at",
  ]);
  await copyTable("tickets", [
    "id",
    "guild_id",
    "channel_id",
    "user_id",
    "username",
    "category",
    "subject",
    "status",
    "claimed_by",
    "claimed_by_name",
    "closed_by",
    "closed_by_name",
    "close_reason",
    "created_at",
    "closed_at",
  ]);
  await copyTable("guild_log_settings", [
    "guild_id",
    "channel_id",
    "events",
    "ignore_bots",
    "ignore_webhooks",
    "ignore_channels",
    "join_alert_days",
    "include_attachments",
    "ping_role_id",
    "updated_at",
  ], (r) => ({
    ...r,
    ignore_bots: r.ignore_bots ? 1 : 0,
    ignore_webhooks: r.ignore_webhooks ? 1 : 0,
    include_attachments: r.include_attachments ? 1 : 0,
  }));
  await copyTable("guild_ticket_settings", [
    "guild_id",
    "category_id",
    "staff_role_id",
    "log_channel_id",
    "max_open",
    "delete_after_close_sec",
    "panel_title",
    "panel_description",
    "updated_at",
  ]);
  await copyTable("app_settings", ["key", "value", "updated_at"]);

  await pgPool.end();
  console.log("✓ Data copy finished");
} else {
  console.log("No Postgres source — schema only (empty tables).");
}

const [tables] = await conn.query("SHOW TABLES");
console.log(
  "Tables in zerotwo:",
  tables.map((t) => Object.values(t)[0]).join(", "),
);
await conn.end();
console.log("\nDone. Point DATABASE_URL to:");
console.log("  mysql://root@127.0.0.1:3306/zerotwo");
console.log("HeidiSQL: 127.0.0.1 · root · (sin password) · DB zerotwo · puerto 3306");
