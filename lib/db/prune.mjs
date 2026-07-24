/**
 * Prune large growth tables (activity, message_snapshots, bot_logs).
 *
 *   node lib/db/prune.mjs              # dry-run defaults
 *   node lib/db/prune.mjs --apply      # actually delete
 *   node lib/db/prune.mjs --apply --activity-days=14 --snapshots-days=7 --logs-days=30
 */
import mysql from "mysql2/promise";
import { databaseUrl, maskUrl } from "./load-env.mjs";

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.split("=")[1] ?? fallback;
}

const apply = process.argv.includes("--apply");
const activityDays = Number(arg("activity-days", "30"));
const snapshotsDays = Number(arg("snapshots-days", "14"));
const logsDays = Number(arg("logs-days", "45"));

const url = databaseUrl();
const conn = await mysql.createConnection({ uri: url, charset: "utf8mb4" });

console.log("Zero Two DB prune", apply ? "(APPLY)" : "(dry-run)");
console.log("  url:", maskUrl(url));
console.log(
  `  activity > ${activityDays}d · snapshots > ${snapshotsDays}d · logs > ${logsDays}d`,
);
console.log("");

async function countOld(sql, params) {
  const [rows] = await conn.query(sql, params);
  return Number(rows[0]?.c ?? 0);
}

const activityN = await countOld(
  `SELECT COUNT(*) AS c FROM activity WHERE executed_at < (NOW() - INTERVAL ? DAY)`,
  [activityDays],
);
const snapN = await countOld(
  `SELECT COUNT(*) AS c FROM message_snapshots WHERE indexed_at < (NOW() - INTERVAL ? DAY)`,
  [snapshotsDays],
);
const logsN = await countOld(
  `SELECT COUNT(*) AS c FROM bot_logs WHERE created_at < (NOW() - INTERVAL ? DAY)`,
  [logsDays],
);

console.log(`activity would delete:          ${activityN}`);
console.log(`message_snapshots would delete: ${snapN}`);
console.log(`bot_logs would delete:          ${logsN}`);

if (!apply) {
  console.log("\nDry-run only. Re-run with --apply to delete.");
  await conn.end();
  process.exit(0);
}

const [a] = await conn.query(
  `DELETE FROM activity WHERE executed_at < (NOW() - INTERVAL ? DAY)`,
  [activityDays],
);
const [s] = await conn.query(
  `DELETE FROM message_snapshots WHERE indexed_at < (NOW() - INTERVAL ? DAY)`,
  [snapshotsDays],
);
const [l] = await conn.query(
  `DELETE FROM bot_logs WHERE created_at < (NOW() - INTERVAL ? DAY)`,
  [logsDays],
);

console.log("\nDeleted:");
console.log("  activity:         ", a.affectedRows);
console.log("  message_snapshots:", s.affectedRows);
console.log("  bot_logs:         ", l.affectedRows);

try {
  await conn.query("OPTIMIZE TABLE activity, message_snapshots, bot_logs");
  console.log("  OPTIMIZE TABLE done");
} catch (err) {
  console.warn("  OPTIMIZE skipped:", err.message);
}

console.log("OK");
await conn.end();
