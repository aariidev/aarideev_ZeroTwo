/**
 * Smoke-test authenticated ticket/guild APIs against local api-server.
 */
import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

function b64url(buf) {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const secret = process.env.SESSION_SECRET;
const ownerId = (process.env.OWNER_IDS ?? "").split(",")[0].trim();
const payload = {
  user: {
    id: ownerId,
    username: "owner",
    discriminator: "0",
    avatar: null,
    globalName: "Owner",
  },
  accessToken: "smoke-token",
  exp: Date.now() + 3_600_000,
};
const body = b64url(JSON.stringify(payload));
const sig = b64url(crypto.createHmac("sha256", secret).update(body).digest());
const cookie = `zt_session=${body}.${sig}`;

function get(p) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port: 8080,
        path: p,
        headers: { Cookie: cookie },
        timeout: 15000,
      },
      (res) => {
        let b = "";
        res.on("data", (d) => (b += d));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: b.slice(0, 400) }),
        );
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout " + p));
    });
  });
}

const paths = [
  "/api/auth/me",
  "/api/tickets?limit=5",
  "/api/tickets/stats",
  "/api/tickets/guilds",
  "/api/guilds",
  "/api/bot/stats",
];

for (const p of paths) {
  try {
    const r = await get(p);
    console.log(p, r.status, r.body.replace(/\s+/g, " ").slice(0, 160));
  } catch (e) {
    console.log(p, "ERR", e.message);
  }
}
