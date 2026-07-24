/**
 * Shared .env loader for db scripts (root monorepo .env).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function loadEnv(file = path.join(root, ".env")) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

export function databaseUrl() {
  loadEnv();
  const url = process.env.DATABASE_URL || "mysql://root@127.0.0.1:3306/zerotwo";
  if (!url.startsWith("mysql")) {
    throw new Error("DATABASE_URL must be mysql://... for MariaDB/MySQL");
  }
  return url;
}

export function maskUrl(url) {
  return url.replace(/:([^:@/]+)@/, ":***@");
}

export { root };
