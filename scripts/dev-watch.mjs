/**
 * dev-watch.mjs — Watcher de desarrollo para Zero Two Bot
 *
 * Uso:
 *   node scripts/dev-watch.mjs
 *
 * Qué hace:
 *  1. Compila el código una vez al arrancar
 *  2. Arranca el bot como proceso hijo
 *  3. Vigila cambios en src/ con debounce de 1.5s
 *  4. Cuando detecta cambios, compila en segundo plano
 *  5. Si la build es exitosa, manda un embed al canal DEV_LOG_CHANNEL_ID
 *     con botones "✅ Reiniciar ahora" / "❌ Cancelar"
 *  6. Cuando el bot confirma (IPC o SIGUSR2), mata el hijo y lo reinicia
 *
 * Variables de entorno necesarias (en .env):
 *   DISCORD_TOKEN, DEV_LOG_CHANNEL_ID, OWNER_IDS
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const API_DIR = path.join(ROOT, "artifacts", "api-server");
const SRC_DIR = path.join(API_DIR, "src");
const BUILD_SCRIPT = path.join(API_DIR, "build.mjs");
const ENV_PATH = path.join(ROOT, ".env");

// ── Cargar .env ───────────────────────────────────────────────────────────────
function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
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
loadEnv();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN ?? "";
const DEV_CHANNEL_ID = process.env.DEV_LOG_CHANNEL_ID ?? "";
const BOT_COLOR_OK = 0x57f287;
const BOT_COLOR_WARN = 0xffa500;
const BOT_COLOR_ERR = 0xff2d6b;

// ── Estado global ─────────────────────────────────────────────────────────────
let botProcess = null;
let pendingBuild = false;   // hay una build lista esperando confirmación
let buildTimer = null;      // debounce timer
let notifyMsgId = null;     // ID del mensaje de Discord con los botones
let isRestarting = false;

// ── Discord REST mínimo (sin discord.js, solo fetch) ─────────────────────────
const API = "https://discord.com/api/v10";

async function discordRequest(method, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[discord] ${method} ${endpoint} → ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  return res.json().catch(() => null);
}

async function sendDevEmbed(embed, components = []) {
  if (!DEV_CHANNEL_ID) return null;
  const msg = await discordRequest("POST", `/channels/${DEV_CHANNEL_ID}/messages`, {
    embeds: [embed],
    components,
  });
  return msg?.id ?? null;
}

async function editDevMessage(msgId, embed, components = []) {
  if (!DEV_CHANNEL_ID || !msgId) return;
  await discordRequest("PATCH", `/channels/${DEV_CHANNEL_ID}/messages/${msgId}`, {
    embeds: [embed],
    components,
  });
}

// ── Build ─────────────────────────────────────────────────────────────────────
function runBuild() {
  return new Promise((resolve) => {
    console.log("[watch] 🔨 Compilando...");
    // Low-memory defaults for Windows (esbuild is Go; OOM → errno 1455)
    const env = {
      ...process.env,
      ESBUILD_DISABLE_SOURCEMAP: process.env.ESBUILD_SOURCEMAP ? "0" : "1",
      GOGC: process.env.GOGC ?? "50",
      GOMAXPROCS: process.env.GOMAXPROCS ?? "2",
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=2048"]
        .filter(Boolean)
        .join(" "),
    };
    if (env.ESBUILD_DISABLE_SOURCEMAP === "0") {
      delete env.ESBUILD_DISABLE_SOURCEMAP;
    }

    const proc = spawn("node", [BUILD_SCRIPT], {
      cwd: API_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s);
    });
    proc.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(s);
    });

    proc.on("error", (err) => {
      resolve({
        ok: false,
        stdout,
        stderr: `${stderr}\n[spawn error] ${err.message}`,
      });
    });

    proc.on("close", (code) => {
      resolve({ ok: code === 0, stdout, stderr, code });
    });
  });
}

// ── Notificación Discord ──────────────────────────────────────────────────────
async function notifyBuildReady(changedFiles) {
  // Si ya hay una notificación previa sin responder, editarla
  if (notifyMsgId) {
    await editDevMessage(notifyMsgId, {
      color: BOT_COLOR_WARN,
      title: "🔨 Nueva build lista (actualizada)",
      description:
        `**Archivos modificados:**\n\`\`\`\n${changedFiles.slice(0, 10).join("\n")}\n\`\`\`\n` +
        `¿Deseas reiniciar el bot ahora?`,
      timestamp: new Date().toISOString(),
      footer: { text: "Zero Two Dev · Watcher" },
    }, reloadButtons());
    return;
  }

  notifyMsgId = await sendDevEmbed(
    {
      color: BOT_COLOR_WARN,
      title: "🔨 Build lista — ¿Reiniciar bot?",
      description:
        `**Archivos modificados:**\n\`\`\`\n${changedFiles.slice(0, 10).join("\n")}\n\`\`\`\n` +
        `Pulsa **Reiniciar ahora** para aplicar los cambios, o **Cancelar** para ignorarlos.`,
      timestamp: new Date().toISOString(),
      footer: { text: "Zero Two Dev · Watcher" },
    },
    reloadButtons(),
  );
}

function reloadButtons() {
  return [
    {
      type: 1, // ACTION_ROW
      components: [
        {
          type: 2, // BUTTON
          style: 3, // SUCCESS (green)
          label: "✅ Reiniciar ahora",
          custom_id: "dev_reload_confirm",
        },
        {
          type: 2,
          style: 4, // DANGER (red)
          label: "❌ Cancelar",
          custom_id: "dev_reload_cancel",
        },
      ],
    },
  ];
}

async function notifyBuildError(stderr) {
  const text = String(stderr || "Sin detalle").slice(0, 1800);
  await sendDevEmbed({
    color: BOT_COLOR_ERR,
    title: "❌ Error de compilación",
    description: `\`\`\`\n${text}\n\`\`\``,
    timestamp: new Date().toISOString(),
    footer: { text: "Zero Two Dev · Watcher" },
  });
}

async function notifyRestarted() {
  // Editar el mensaje de confirmación si existe
  if (notifyMsgId) {
    await editDevMessage(notifyMsgId, {
      color: BOT_COLOR_OK,
      title: "✅ Bot reiniciado correctamente",
      description: "El bot ha aplicado la nueva build y está online. 🌸",
      timestamp: new Date().toISOString(),
      footer: { text: "Zero Two Dev · Watcher" },
    });
    notifyMsgId = null;
  }
}

// ── Control del proceso hijo ──────────────────────────────────────────────────
function startBot() {
  if (botProcess) return;
  console.log("[watch] 🚀 Arrancando bot...");

  botProcess = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: API_DIR,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    env: { ...process.env, NODE_ENV: "development" },
  });

  botProcess.on("message", (message) => {
    if (message?.type !== "dev_reload_confirm") return;
    console.log("[watch] 📨 IPC dev_reload_confirm recibido → reiniciando bot");
    restartBot().catch(console.error);
  });

  botProcess.on("exit", (code, signal) => {
    botProcess = null;
    if (isRestarting) return; // reinicio controlado, no loguear como error
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(`[watch] ⚠️  Bot salió con código ${code} / señal ${signal}`);
    }
  });
}

function killBot() {
  return new Promise((resolve) => {
    if (!botProcess) {
      resolve();
      return;
    }
    const proc = botProcess;
    botProcess = null;
    proc.once("exit", resolve);
    proc.kill("SIGTERM");
    // Forzar si no muere en 8s
    setTimeout(() => {
      try { proc.kill("SIGKILL"); } catch { }
      resolve();
    }, 8000);
  });
}

async function restartBot() {
  if (isRestarting) return;
  isRestarting = true;
  console.log("[watch] 🔄 Reiniciando bot...");
  await killBot();
  pendingBuild = false;
  isRestarting = false;
  startBot();
  await notifyRestarted();
}

// ── SIGUSR2: señal de "confirmar reload" que manda devReload.ts ───────────────
process.on("SIGUSR2", () => {
  console.log("[watch] 📨 SIGUSR2 recibido → reiniciando bot");
  restartBot().catch(console.error);
});

// ── Watcher de archivos ───────────────────────────────────────────────────────
const changedSinceLastBuild = new Set();
let building = false;

function scheduleRebuild(filePath) {
  changedSinceLastBuild.add(path.relative(API_DIR, filePath));

  if (buildTimer) clearTimeout(buildTimer);
  buildTimer = setTimeout(async () => {
    if (building) return;
    building = true;

    const files = [...changedSinceLastBuild];
    changedSinceLastBuild.clear();
    console.log(`[watch] 📝 Cambios detectados:\n  ${files.join("\n  ")}`);

    const result = await runBuild();

    if (!result.ok) {
      console.error("[watch] ❌ Build fallida");
      const detail = (result.stderr || result.stdout || "").trim();
      if (!detail) {
        console.error(
          "[watch] Sin salida del compilador — suele ser OOM (VirtualAlloc / errno 1455).\n" +
            "  1) Cierra Firefox/Chrome/apps pesadas\n" +
            "  2) node artifacts/api-server/build.mjs\n" +
            "  3) Si sigue fallando, reinicia el PC o aumenta el pagefile",
        );
      } else {
        console.error("[watch] ── error ──\n" + detail.slice(-3000));
      }
      await notifyBuildError(
        detail ||
          "Sin stderr (posible out of memory / errno 1455). Cierra apps y reintenta el build.",
      ).catch(console.error);
      building = false;
      return;
    }

    console.log("[watch] ✅ Build exitosa — esperando confirmación en Discord");
    pendingBuild = true;
    await notifyBuildReady(files).catch(console.error);
    building = false;
  }, 1500); // debounce 1.5s
}

function watchRecursive(dir) {
  // fs.watch con recursive está soportado en Windows
  fs.watch(dir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    // Solo archivos TypeScript/JS fuente
    if (!/\.(ts|js|mjs)$/.test(filename)) return;
    // Ignorar la carpeta dist y node_modules
    if (filename.startsWith("dist") || filename.includes("node_modules")) return;

    const full = path.join(dir, filename);
    scheduleRebuild(full);
  });
  console.log(`[watch] 👀 Vigilando cambios en ${path.relative(ROOT, dir)}/`);
}

// ── Señales de apagado ────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[watch] ${signal} recibido — apagando...`);
  await killBot();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`
════════════════════════════════════════════
  Zero Two Dev Watcher
  Root: ${ROOT}
  Canal notificaciones: ${DEV_CHANNEL_ID || "(no configurado — solo consola)"}
════════════════════════════════════════════
`);

// Build inicial
console.log("[watch] 🔨 Build inicial...");
const initial = await runBuild();
if (!initial.ok) {
  console.error("[watch] ❌ Build inicial fallida:");
  console.error(initial.stderr);
  process.exit(1);
}
console.log("[watch] ✅ Build inicial OK");

startBot();
watchRecursive(SRC_DIR);
