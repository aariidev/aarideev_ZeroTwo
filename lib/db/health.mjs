/**
 * DB health + table stats.
 *   node lib/db/health.mjs
 */
import mysql from "mysql2/promise";
import { databaseUrl, maskUrl } from "./load-env.mjs";

const url = databaseUrl();
const t0 = Date.now();
const conn = await mysql.createConnection({ uri: url, charset: "utf8mb4" });

try {
  await conn.ping();
  const ms = Date.now() - t0;
  const [[db]] = await conn.query("SELECT DATABASE() AS name, VERSION() AS version");
  const [tables] = await conn.query(
    `SELECT TABLE_NAME AS name, TABLE_ROWS AS approx_rows,
            ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS size_mb
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME`,
  );

  console.log("Zero Two DB health");
  console.log("  url:     ", maskUrl(url));
  console.log("  database:", db.name);
  console.log("  version: ", db.version);
  console.log("  ping:    ", `${ms}ms`);
  console.log("");
  console.log("TABLE                      ~ROWS    SIZE_MB");
  console.log("───────────────────────────────────────────");
  let totalMb = 0;
  for (const t of tables) {
    totalMb += Number(t.size_mb) || 0;
    console.log(
      `${String(t.name).padEnd(26)} ${String(t.approx_rows ?? 0).padStart(7)}  ${String(t.size_mb ?? 0).padStart(8)}`,
    );
  }
  console.log("───────────────────────────────────────────");
  console.log(`Total ~${totalMb.toFixed(2)} MB · ${tables.length} tables`);
  console.log("OK");
} finally {
  await conn.end();
}
