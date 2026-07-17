import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(`
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'soporte',
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  claimed_by TEXT,
  claimed_by_name TEXT,
  closed_by TEXT,
  closed_by_name TEXT,
  close_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  closed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tickets_guild_user_idx ON tickets (guild_id, user_id);
CREATE INDEX IF NOT EXISTS tickets_channel_idx ON tickets (channel_id);
`);
console.log("tickets table OK");
await pool.end();
