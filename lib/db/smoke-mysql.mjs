import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const url = process.env.DATABASE_URL;
console.log("URL", url);
const pool = mysql.createPool(url);
const db = drizzle(pool, { mode: "default" });

const [r1] = await db.execute(sql`SELECT status, CAST(COUNT(*) AS UNSIGNED) AS c FROM tickets GROUP BY status`);
console.log("stats", r1);

const [r2] = await db.execute(
  sql`SELECT COUNT(*) AS c FROM tickets WHERE guild_id = ${"734665984476184629"} AND status IN (${"open"}, ${"claimed"})`,
);
console.log("active", r2);

const [r3] = await db.execute(sql`SELECT \`key\`, LEFT(value, 30) v FROM bot_config LIMIT 3`);
console.log("bot_config", r3);

await pool.end();
console.log("OK");
