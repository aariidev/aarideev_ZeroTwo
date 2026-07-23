import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, ".env");
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
const c = await mysql.createConnection(url);
try {
  await c.query(
    "ALTER TABLE guild_music_settings ADD COLUMN cap_other_bots TINYINT(1) NOT NULL DEFAULT 0 AFTER dj_role_id",
  );
  console.log("OK: cap_other_bots added");
} catch (e) {
  console.log(String(e.message || e).includes("Duplicate") ? "OK: already exists" : e.message);
}
await c.end();
