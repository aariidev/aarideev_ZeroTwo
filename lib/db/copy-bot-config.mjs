/**
 * One-shot: copy bot_config from Neon → MySQL zerotwo (key is reserved word).
 */
import mysql from "mysql2/promise";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = path.join(root, ".env");
const envMap = {};
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
}

const SOURCE = envMap.DATABASE_URL_NEON || envMap.NEON_DATABASE_URL;
const TARGET = "mysql://root@127.0.0.1:3306/zerotwo";

if (!SOURCE) {
  console.error("No DATABASE_URL_NEON in .env");
  process.exit(1);
}

const pgPool = new pg.Pool({ connectionString: SOURCE });
const conn = await mysql.createConnection(TARGET);

const { rows } = await pgPool.query("SELECT * FROM bot_config");
console.log("Neon bot_config rows:", rows.length);
let n = 0;
for (const r of rows) {
  await conn.query(
    "INSERT IGNORE INTO `bot_config` (`key`, `value`, `updated_at`) VALUES (?, ?, ?)",
    [r.key, r.value, r.updated_at],
  );
  n++;
}
console.log("Copied:", n);

const tables = [
  "activity",
  "command_stats",
  "changelogs",
  "economy",
  "tickets",
  "warns",
  "bot_logs",
  "bot_config",
  "guild_log_settings",
  "guild_ticket_settings",
  "app_settings",
  "inventory",
];
for (const t of tables) {
  const [c] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t}\``);
  console.log(`  ${t}: ${c[0].c}`);
}

await pgPool.end();
await conn.end();
console.log("OK");
