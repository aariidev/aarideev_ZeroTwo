import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/** MySQL/MariaDB pool (HeidiSQL / XAMPP local, etc.) */
export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 25,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  connectTimeout: 8_000,
});

export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
