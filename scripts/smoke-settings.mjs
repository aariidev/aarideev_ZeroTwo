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
const body = b64url(
  JSON.stringify({
    user: {
      id: ownerId,
      username: "owner",
      discriminator: "0",
      avatar: null,
      globalName: "Owner",
    },
    accessToken: "smoke",
    exp: Date.now() + 3_600_000,
  }),
);
const cookie = `zt_session=${body}.${b64url(crypto.createHmac("sha256", secret).update(body).digest())}`;

function get(p) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port: 8080,
        path: p,
        headers: { Cookie: cookie },
        timeout: 15_000,
      },
      (res) => {
        let b = "";
        res.on("data", (d) => (b += d));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            ms: Date.now() - t0,
            len: b.length,
            body: b,
          }),
        );
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

const listRes = await get("/api/guilds");
const guilds = JSON.parse(listRes.body);
console.log(`guilds: ${guilds.length}`);

for (const g of guilds) {
  try {
    const r = await get(`/api/guilds/${g.id}/settings`);
    const ok = r.status === 200;
    console.log(
      `${ok ? "OK" : "!!"} ${(g.name || g.id).slice(0, 36).padEnd(36)} ${r.status} ${String(r.ms).padStart(4)}ms ${r.len}b`,
    );
  } catch (e) {
    console.log(`XX ${(g.name || g.id).slice(0, 36).padEnd(36)} ${e.message}`);
  }
}
