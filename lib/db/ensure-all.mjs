/**
 * Zero Two DB — ensure ALL tables, columns and useful indexes (idempotent).
 *
 *   node lib/db/ensure-all.mjs
 *
 * Safe to re-run. Prefer this over scattered ensure-*.mjs scripts.
 */
import mysql from "mysql2/promise";
import { databaseUrl, maskUrl } from "./load-env.mjs";

const url = databaseUrl();
const conn = await mysql.createConnection({
  uri: url,
  multipleStatements: true,
  charset: "utf8mb4",
});

console.log("Zero Two DB ensure →", maskUrl(url));
console.log("");

async function tableExists(table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [table],
  );
  return rows.length > 0;
}

async function columnExists(table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, indexName],
  );
  return rows.length > 0;
}

async function ensureTable(name, ddl) {
  await conn.query(ddl);
  console.log(`✓ table ${name}`);
}

async function ensureColumn(table, column, definition) {
  if (await columnExists(table, column)) {
    console.log(`  · ${table}.${column} (ok)`);
    return;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  console.log(`  + ${table}.${column}`);
}

async function ensureIndex(table, indexName, columnsSql) {
  if (await indexExists(table, indexName)) {
    console.log(`  · idx ${table}.${indexName} (ok)`);
    return;
  }
  try {
    await conn.query(
      `CREATE INDEX \`${indexName}\` ON \`${table}\` (${columnsSql})`,
    );
    console.log(`  + idx ${table}.${indexName}`);
  } catch (err) {
    console.warn(`  ! idx ${table}.${indexName}:`, err.message);
  }
}

// ── Core tables ───────────────────────────────────────────────────────────────

await ensureTable(
  "warns",
  `CREATE TABLE IF NOT EXISTS warns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    username VARCHAR(100) NOT NULL,
    moderator_id VARCHAR(32) NOT NULL,
    moderator_name VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX warns_guild_user (guild_id, user_id),
    INDEX warns_guild_created (guild_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "activity",
  `CREATE TABLE IF NOT EXISTS activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    command VARCHAR(64) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    username VARCHAR(100) NOT NULL,
    guild_id VARCHAR(32) NOT NULL,
    guild_name VARCHAR(150) NOT NULL,
    executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success TINYINT(1) NOT NULL DEFAULT 1,
    INDEX activity_executed (executed_at),
    INDEX activity_guild_executed (guild_id, executed_at),
    INDEX activity_command (command)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "command_stats",
  `CREATE TABLE IF NOT EXISTS command_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    command VARCHAR(64) NOT NULL,
    count INT NOT NULL DEFAULT 0,
    last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY command_stats_command (command)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "bot_config",
  `CREATE TABLE IF NOT EXISTS bot_config (
    \`key\` VARCHAR(191) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "bot_logs",
  `CREATE TABLE IF NOT EXISTS bot_logs (
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
    INDEX bot_logs_created (created_at),
    INDEX bot_logs_guild_created (guild_id, created_at),
    INDEX bot_logs_event (event)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "changelogs",
  `CREATE TABLE IF NOT EXISTS changelogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version VARCHAR(32) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'feature',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX changelogs_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "economy",
  `CREATE TABLE IF NOT EXISTS economy (
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    balance INT NOT NULL DEFAULT 500,
    total_earned INT NOT NULL DEFAULT 0,
    total_lost INT NOT NULL DEFAULT 0,
    games_played INT NOT NULL DEFAULT 0,
    games_won INT NOT NULL DEFAULT 0,
    streak INT NOT NULL DEFAULT 0,
    last_daily TIMESTAMP NULL,
    inventory_private TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id),
    INDEX economy_guild_balance (guild_id, balance)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureColumn(
  "economy",
  "inventory_private",
  "`inventory_private` TINYINT(1) NOT NULL DEFAULT 0",
);

await ensureTable(
  "inventory",
  `CREATE TABLE IF NOT EXISTS inventory (
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    acquired_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id, item_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "tickets",
  `CREATE TABLE IF NOT EXISTS tickets (
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
    INDEX tickets_guild_user (guild_id, user_id),
    INDEX tickets_channel (channel_id),
    INDEX tickets_status (status),
    INDEX tickets_guild_status (guild_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "guild_log_settings",
  `CREATE TABLE IF NOT EXISTS guild_log_settings (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "guild_ticket_settings",
  `CREATE TABLE IF NOT EXISTS guild_ticket_settings (
    guild_id VARCHAR(32) PRIMARY KEY,
    category_id VARCHAR(32) NULL,
    staff_role_id VARCHAR(32) NULL,
    staff_role_ids TEXT NOT NULL DEFAULT '[]',
    log_channel_id VARCHAR(32) NULL,
    max_open INT NOT NULL DEFAULT 1,
    delete_after_close_sec INT NOT NULL DEFAULT 10,
    panel_title VARCHAR(150) NOT NULL DEFAULT '🎫 Centro de Tickets',
    panel_description TEXT NOT NULL,
    close_policy VARCHAR(32) NOT NULL DEFAULT 'both',
    claim_policy VARCHAR(32) NOT NULL DEFAULT 'staff_only',
    channel_name_format VARCHAR(80) NOT NULL DEFAULT 'ticket-{username}-{userid4}',
    welcome_message TEXT NOT NULL,
    custom_categories TEXT NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

// Ticket settings column migrations (older DBs)
console.log("\n→ guild_ticket_settings columns");
await ensureColumn(
  "guild_ticket_settings",
  "staff_role_ids",
  `staff_role_ids TEXT NOT NULL DEFAULT '[]'`,
);
await ensureColumn(
  "guild_ticket_settings",
  "close_policy",
  `close_policy VARCHAR(32) NOT NULL DEFAULT 'both'`,
);
await ensureColumn(
  "guild_ticket_settings",
  "claim_policy",
  `claim_policy VARCHAR(32) NOT NULL DEFAULT 'staff_only'`,
);
await ensureColumn(
  "guild_ticket_settings",
  "channel_name_format",
  `channel_name_format VARCHAR(80) NOT NULL DEFAULT 'ticket-{username}-{userid4}'`,
);
await ensureColumn(
  "guild_ticket_settings",
  "welcome_message",
  `welcome_message TEXT NULL`,
);
await ensureColumn(
  "guild_ticket_settings",
  "custom_categories",
  `custom_categories TEXT NOT NULL DEFAULT '[]'`,
);

await ensureTable(
  "app_settings",
  `CREATE TABLE IF NOT EXISTS app_settings (
    \`key\` VARCHAR(191) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "guild_music_settings",
  `CREATE TABLE IF NOT EXISTS guild_music_settings (
    guild_id VARCHAR(32) PRIMARY KEY,
    channel_id VARCHAR(32) NULL,
    message_id VARCHAR(32) NULL,
    dj_role_id VARCHAR(32) NULL,
    cap_other_bots TINYINT(1) NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureColumn(
  "guild_music_settings",
  "cap_other_bots",
  `cap_other_bots TINYINT(1) NOT NULL DEFAULT 0`,
);

await ensureTable(
  "music_sessions",
  `CREATE TABLE IF NOT EXISTS music_sessions (
    guild_id VARCHAR(32) PRIMARY KEY,
    voice_channel_id VARCHAR(32) NULL,
    text_channel_id VARCHAR(32) NULL,
    payload TEXT NOT NULL,
    playback_sec INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "message_snapshots",
  `CREATE TABLE IF NOT EXISTS message_snapshots (
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
    message_created_at TIMESTAMP NOT NULL,
    message_updated_at TIMESTAMP NOT NULL,
    indexed_at TIMESTAMP NOT NULL,
    INDEX msg_snap_guild_ch (guild_id, channel_id),
    INDEX msg_snap_author (author_id),
    INDEX msg_snap_indexed (indexed_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

// ── Community (suggestions, antiraid, levels) ─────────────────────────────────

await ensureTable(
  "guild_suggestion_settings",
  `CREATE TABLE IF NOT EXISTS guild_suggestion_settings (
    guild_id VARCHAR(32) PRIMARY KEY,
    channel_id VARCHAR(32) NULL,
    log_channel_id VARCHAR(32) NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "suggestions",
  `CREATE TABLE IF NOT EXISTS suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    username VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    message_id VARCHAR(32) NULL,
    channel_id VARCHAR(32) NULL,
    reviewed_by VARCHAR(32) NULL,
    review_note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    INDEX suggestions_guild_status (guild_id, status),
    INDEX suggestions_message (message_id),
    INDEX suggestions_user (guild_id, user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

// ── League of Legends tracker table ──────────────────────────────────────────
await ensureTable(
  "lol_tracked",
  `CREATE TABLE IF NOT EXISTS lol_tracked (
    id INT AUTO_INCREMENT PRIMARY KEY,
    summoner_id VARCHAR(64) NOT NULL,
    name VARCHAR(64) NOT NULL,
    region VARCHAR(8) NOT NULL,
    discord_user_id VARCHAR(32) NOT NULL,
    note TEXT NULL,
    last_data TEXT NULL,
    last_fetched_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX lol_tracked_user_idx (discord_user_id),
    INDEX lol_tracked_summoner_idx (summoner_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "guild_antiraid_settings",
  `CREATE TABLE IF NOT EXISTS guild_antiraid_settings (
    guild_id VARCHAR(32) PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    threshold INT NOT NULL DEFAULT 5,
    time_window INT NOT NULL DEFAULT 60,
    action VARCHAR(16) NOT NULL DEFAULT 'kick',
    log_channel_id VARCHAR(32) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "guild_level_settings",
  `CREATE TABLE IF NOT EXISTS guild_level_settings (
    guild_id VARCHAR(32) PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    xp_min INT NOT NULL DEFAULT 15,
    xp_max INT NOT NULL DEFAULT 25,
    cooldown_sec INT NOT NULL DEFAULT 60,
    voice_xp_per_min INT NOT NULL DEFAULT 5,
    announce_channel_id VARCHAR(32) NULL,
    announce_in_place TINYINT(1) NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureTable(
  "user_levels",
  `CREATE TABLE IF NOT EXISTS user_levels (
    guild_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    xp INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 0,
    total_messages INT NOT NULL DEFAULT 0,
    voice_minutes INT NOT NULL DEFAULT 0,
    achievements TEXT NOT NULL DEFAULT '[]',
    last_xp_at TIMESTAMP NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id),
    INDEX user_levels_guild_xp (guild_id, xp),
    INDEX user_levels_guild_level (guild_id, level)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

await ensureColumn(
  "user_levels",
  "achievements",
  `achievements TEXT NOT NULL DEFAULT '[]'`,
);

await ensureTable(
  "guild_welcome_settings",
  `CREATE TABLE IF NOT EXISTS guild_welcome_settings (
    guild_id VARCHAR(32) PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    channel_id VARCHAR(32) NULL,
    leave_channel_id VARCHAR(32) NULL,
    welcome_message TEXT NOT NULL,
    leave_message TEXT NOT NULL,
    welcome_embed TINYINT(1) NOT NULL DEFAULT 1,
    leave_embed TINYINT(1) NOT NULL DEFAULT 1,
    autorole_ids TEXT NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

// Fix empty welcome/leave messages from inserts without defaults
try {
  await conn.query(
    `UPDATE guild_welcome_settings
     SET welcome_message = ?
     WHERE welcome_message IS NULL OR TRIM(welcome_message) = ''`,
    [
      "Bienvenido/a {user} a **{server}** 🌸\nEres el miembro **#{memberCount}**. Cuenta creada {accountAge}.",
    ],
  );
  await conn.query(
    `UPDATE guild_welcome_settings
     SET leave_message = ?
     WHERE leave_message IS NULL OR TRIM(leave_message) = ''`,
    [
      "**{username}** abandonó **{server}**. Ahora somos **{memberCount}**.",
    ],
  );
  console.log("  · guild_welcome_settings empty messages patched");
} catch (err) {
  console.warn("  ! welcome message patch:", err.message);
}

// ── Extra indexes on existing DBs ─────────────────────────────────────────────
console.log("\n→ indexes");
await ensureIndex("warns", "warns_guild_user", "guild_id, user_id");
await ensureIndex("warns", "warns_guild_created", "guild_id, created_at");
await ensureIndex("activity", "activity_executed", "executed_at");
await ensureIndex("activity", "activity_guild_executed", "guild_id, executed_at");
await ensureIndex("activity", "activity_command", "command");
await ensureIndex("bot_logs", "bot_logs_created", "created_at");
await ensureIndex("bot_logs", "bot_logs_guild_created", "guild_id, created_at");
await ensureIndex("bot_logs", "bot_logs_event", "event");
await ensureIndex("tickets", "tickets_guild_status", "guild_id, status");
await ensureIndex("tickets", "tickets_channel", "channel_id");
await ensureIndex("economy", "economy_guild_balance", "guild_id, balance");
await ensureIndex("suggestions", "suggestions_user", "guild_id, user_id");
await ensureIndex("user_levels", "user_levels_guild_level", "guild_id, level");
await ensureIndex("message_snapshots", "msg_snap_indexed", "indexed_at");

// ── Session / engine tweaks (best-effort) ─────────────────────────────────────
console.log("\n→ session");
try {
  await conn.query(`SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log("✓ utf8mb4");
} catch {
  /* */
}

// ── Summary ───────────────────────────────────────────────────────────────────
const [tables] = await conn.query("SHOW TABLES");
const names = tables.map((r) => Object.values(r)[0]);
const [idxCount] = await conn.query(
  `SELECT COUNT(DISTINCT INDEX_NAME) AS c
   FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()`,
);

console.log("\n────────────────────────────");
console.log(`Tablas:  ${names.length}`);
console.log(`Índices: ${idxCount[0]?.c ?? "?"}`);
console.log(names.join(", "));
console.log("────────────────────────────");
console.log("OK — DB lista para Zero Two");

await conn.end();
