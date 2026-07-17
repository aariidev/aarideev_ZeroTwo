/**
 * Ensure tickets table exists on MySQL zerotwo.
 * Run: node lib/db/ensure-tickets.mjs
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
`);
console.log("✓ tickets OK on", url.replace(/:([^:@/]+)@/, ":***@"));
await conn.end();
