/**
 * ensure-tickets-v2.mjs
 * Migra guild_ticket_settings añadiendo las columnas nuevas del sistema de
 * tickets configurable (v2). Seguro de ejecutar varias veces (idempotente).
 *
 * Uso:
 *   node lib/db/ensure-tickets-v2.mjs
 */
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Cargar .env ───────────────────────────────────────────────────────────────
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

// ── Helper: añadir columna solo si no existe ──────────────────────────────────
async function addColumnIfMissing(table, column, definition) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (rows.length > 0) {
    console.log(`  · ${column} — ya existe, omitido`);
    return;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  console.log(`  · ${column} — añadida ✓`);
}

// ── Asegurarse de que la tabla base existe ────────────────────────────────────
await conn.query(`
  CREATE TABLE IF NOT EXISTS guild_ticket_settings (
    guild_id        VARCHAR(32)  NOT NULL PRIMARY KEY,
    category_id     VARCHAR(32)  NULL,
    staff_role_id   VARCHAR(32)  NULL,
    log_channel_id  VARCHAR(32)  NULL,
    max_open        INT          NOT NULL DEFAULT 1,
    delete_after_close_sec INT   NOT NULL DEFAULT 10,
    panel_title     VARCHAR(150) NOT NULL DEFAULT '🎫 Centro de Tickets',
    panel_description TEXT       NOT NULL DEFAULT '',
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✓ guild_ticket_settings — tabla base OK");

// ── Nuevas columnas v2 ────────────────────────────────────────────────────────
console.log("\nMigrando columnas nuevas en guild_ticket_settings:");

await addColumnIfMissing(
  "guild_ticket_settings",
  "staff_role_ids",
  `staff_role_ids TEXT NOT NULL DEFAULT '[]' AFTER staff_role_id`,
);

await addColumnIfMissing(
  "guild_ticket_settings",
  "close_policy",
  `close_policy VARCHAR(32) NOT NULL DEFAULT 'both' AFTER log_channel_id`,
);

await addColumnIfMissing(
  "guild_ticket_settings",
  "claim_policy",
  `claim_policy VARCHAR(32) NOT NULL DEFAULT 'staff_only' AFTER close_policy`,
);

await addColumnIfMissing(
  "guild_ticket_settings",
  "channel_name_format",
  `channel_name_format VARCHAR(80) NOT NULL DEFAULT 'ticket-{username}-{userid4}' AFTER claim_policy`,
);

await addColumnIfMissing(
  "guild_ticket_settings",
  "welcome_message",
  `welcome_message TEXT NOT NULL DEFAULT '' AFTER channel_name_format`,
);

await addColumnIfMissing(
  "guild_ticket_settings",
  "custom_categories",
  `custom_categories TEXT NOT NULL DEFAULT '[]' AFTER welcome_message`,
);

// ── Asegurarse de que la tabla tickets base también existe ────────────────────
await conn.query(`
  CREATE TABLE IF NOT EXISTS tickets (
    id              INT          AUTO_INCREMENT PRIMARY KEY,
    guild_id        VARCHAR(32)  NOT NULL,
    channel_id      VARCHAR(32)  NOT NULL,
    user_id         VARCHAR(32)  NOT NULL,
    username        VARCHAR(100) NOT NULL,
    category        VARCHAR(32)  NOT NULL DEFAULT 'soporte',
    subject         TEXT         NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'open',
    claimed_by      VARCHAR(32)  NULL,
    claimed_by_name VARCHAR(100) NULL,
    closed_by       VARCHAR(32)  NULL,
    closed_by_name  VARCHAR(100) NULL,
    close_reason    TEXT         NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at       TIMESTAMP    NULL,
    INDEX (guild_id, user_id),
    INDEX (channel_id),
    INDEX (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("\n✓ tickets — tabla OK");

await conn.end();
console.log("\n✅ Migración v2 completada.");
