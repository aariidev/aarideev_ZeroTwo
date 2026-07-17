import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/mysql-core";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
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

const url = process.env.DATABASE_URL;
console.log("URL", url);

const warnsTable = mysqlTable("warns", {
  id: int("id").autoincrement().primaryKey(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  userId: varchar("user_id", { length: 32 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  moderatorId: varchar("moderator_id", { length: 32 }).notNull(),
  moderatorName: varchar("moderator_name", { length: 100 }).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const pool = mysql.createPool({ uri: url, connectionLimit: 5 });
const db = drizzle(pool, { mode: "default" });

try {
  const ids = await db
    .insert(warnsTable)
    .values({
      guildId: "smoke_guild",
      userId: "smoke_user",
      username: "tester",
      moderatorId: "mod1",
      moderatorName: "mod",
      reason: "smoke test",
    })
    .$returningId();
  console.log("returningId", ids);

  // Without returningId
  await db.insert(warnsTable).values({
    guildId: "smoke_guild",
    userId: "smoke_user2",
    username: "tester2",
    moderatorId: "mod1",
    moderatorName: "mod",
    reason: "smoke test 2",
    createdAt: new Date(),
  });
  console.log("plain insert ok");

  const rows = await db
    .select()
    .from(warnsTable)
    .where(eq(warnsTable.guildId, "smoke_guild"));
  console.log(
    "rows",
    rows.map((r) => ({ id: r.id, user: r.userId, reason: r.reason, at: r.createdAt })),
  );

  await db.delete(warnsTable).where(eq(warnsTable.guildId, "smoke_guild"));
  console.log("cleaned");
} catch (e) {
  console.error("FAIL", e);
}

await pool.end();
