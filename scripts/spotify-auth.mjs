/**
 * One-shot Spotify OAuth for Zero Two Music (play-dl).
 *
 * 1) In Spotify Developer Dashboard → your app → Redirect URIs, add EXACTLY:
 *      http://127.0.0.1:3847/callback
 * 2) Run:
 *      node scripts/spotify-auth.mjs
 *    (or set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env first)
 * 3) Browser opens → accept → this script prints SPOTIFY_REFRESH_TOKEN
 * 4) Paste into .env and restart the bot
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const REDIRECT_URI = "http://127.0.0.1:3847/callback";
const PORT = 3847;
const SCOPES = [
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

function loadEnv() {
  if (!fs.existsSync(envPath)) return {};
  const map = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    map[m[1]] = v;
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
  return map;
}

loadEnv();

const clientId = (process.env.SPOTIFY_CLIENT_ID ?? "").trim();
const clientSecret = (process.env.SPOTIFY_CLIENT_SECRET ?? "").trim();

if (!clientId || !clientSecret) {
  console.error(`
Faltan SPOTIFY_CLIENT_ID o SPOTIFY_CLIENT_SECRET.

1) https://developer.spotify.com/dashboard → Create app
2) Redirect URI (exacto):
   ${REDIRECT_URI}
3) Copia Client ID y Client Secret al .env:

SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_MARKET=ES

4) Vuelve a ejecutar: node scripts/spotify-auth.mjs
`);
  process.exit(1);
}

console.log(`
════════════════════════════════════════════════════════
 Zero Two · Spotify OAuth
════════════════════════════════════════════════════════
En Spotify Dashboard → tu app → Redirect URIs, añade EXACTO:

  ${REDIRECT_URI}

(Client ID detectado: ${clientId.slice(0, 8)}…)
`);

const authUrl =
  "https://accounts.spotify.com/authorize?" +
  new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  }).toString();

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    if (u.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const err = u.searchParams.get("error");
    if (err) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>Error: ${err}</h1><p>Cierra esta pestaña.</p>`);
      console.error("Spotify denied:", err);
      server.close();
      process.exit(1);
    }
    const code = u.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("Missing code");
      return;
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    });

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const json = await tokenRes.json();
    if (!tokenRes.ok) {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<pre>${JSON.stringify(json, null, 2)}</pre>`);
      console.error("Token error:", json);
      server.close();
      process.exit(1);
    }

    const refresh = json.refresh_token;
    const access = json.access_token;

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <h1>✅ Spotify OK</h1>
      <p>Ya puedes cerrar esta pestaña y volver a la terminal.</p>
      <p>El <code>refresh_token</code> se imprimió en la consola.</p>
    `);

    console.log(`
════════════════════════════════════════════════════════
 ¡Listo! Pega esto en H:\\Discord\\02\\.env
════════════════════════════════════════════════════════

SPOTIFY_CLIENT_ID=${clientId}
SPOTIFY_CLIENT_SECRET=${clientSecret}
SPOTIFY_REFRESH_TOKEN=${refresh}
SPOTIFY_MARKET=ES

# Redirect URI usado (no hace falta en .env, solo en el dashboard):
# ${REDIRECT_URI}

Access token (temporal, no hace falta guardarlo): ${String(access).slice(0, 20)}…
════════════════════════════════════════════════════════
Luego reinicia el bot.
`);

    // Optional: auto-append refresh token if missing
    try {
      let env = fs.readFileSync(envPath, "utf8");
      if (!env.includes("SPOTIFY_REFRESH_TOKEN=")) {
        env += `\nSPOTIFY_REFRESH_TOKEN=${refresh}\n`;
        fs.writeFileSync(envPath, env);
        console.log("✓ SPOTIFY_REFRESH_TOKEN añadido al .env automáticamente");
      } else if (env.match(/SPOTIFY_REFRESH_TOKEN=\s*$/m) || env.includes("SPOTIFY_REFRESH_TOKEN=\n")) {
        env = env.replace(
          /SPOTIFY_REFRESH_TOKEN=.*/m,
          `SPOTIFY_REFRESH_TOKEN=${refresh}`,
        );
        fs.writeFileSync(envPath, env);
        console.log("✓ SPOTIFY_REFRESH_TOKEN actualizado en .env");
      } else {
        console.log(
          "(Ya había SPOTIFY_REFRESH_TOKEN en .env — revísalo o reemplázalo a mano)",
        );
      }
    } catch (e) {
      console.warn("No se pudo escribir .env automáticamente:", e.message);
    }

    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end(String(e));
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Escuchando callback en ${REDIRECT_URI}`);
  console.log("\nAbre esta URL en el navegador:\n");
  console.log(authUrl);
  console.log("");
  // Windows: open browser
  const cmd =
    process.platform === "win32"
      ? `start "" "${authUrl}"`
      : process.platform === "darwin"
        ? `open "${authUrl}"`
        : `xdg-open "${authUrl}"`;
  exec(cmd, () => {});
});
