/**
 * dev-watch.mjs — Watcher de desarrollo Zero Two
 *
 * Uso:
 *   node scripts/dev-watch.mjs
 *
 * Notifica en Discord (DEV_LOG_CHANNEL_ID) con embeds cyberpunk
 * y botones Reiniciar / Cancelar.
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

// ── .env ──────────────────────────────────────────────────────────────────────
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

// Zero Two palette
const C = {
  pink: 0xff2d6b,
  cyan: 0x22d3ee,
  green: 0x22c55e,
  amber: 0xf59e0b,
  red: 0xef4444,
  purple: 0xa78bfa,
  slate: 0x64748b,
};

// ── ANSI consola ──────────────────────────────────────────────────────────────
const A = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  pink: "\x1b[38;2;255;45;107m",
  cyan: "\x1b[38;2;34;211;238m",
  green: "\x1b[38;2;34;197;94m",
  amber: "\x1b[38;2;245;158;11m",
  red: "\x1b[38;2;239;68;68m",
  purple: "\x1b[38;2;167;139;250m",
};

function log(tag, msg, color = A.cyan) {
  const t = new Date().toLocaleTimeString("es-ES", { hour12: false });
  console.log(
    `${A.dim}${t}${A.reset} ${color}${A.bold}[watch]${A.reset} ${A.dim}${tag}${A.reset} ${msg}`,
  );
}

// ── Estado ────────────────────────────────────────────────────────────────────
let botProcess = null;
let pendingBuild = false;
let buildTimer = null;
let notifyMsgId = null;
let isRestarting = false;
let buildSession = 0;
let botStartedAt = null;
/** @type {{ id: string, username: string, avatar: string | null } | null} */
let botUser = null;

// ── Discord REST ──────────────────────────────────────────────────────────────
const API = "https://discord.com/api/v10";

async function discordRequest(method, endpoint, body) {
  if (!DISCORD_TOKEN) return null;
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
    log(
      "discord",
      `${method} ${endpoint} → ${res.status}: ${text.slice(0, 160)}`,
      A.red,
    );
    return null;
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

async function loadBotUser() {
  const me = await discordRequest("GET", "/users/@me");
  if (me?.id) {
    botUser = {
      id: me.id,
      username: me.username ?? "Zero Two",
      avatar: me.avatar ?? null,
    };
  }
}

function botAvatarUrl(size = 128) {
  if (!botUser) return undefined;
  if (botUser.avatar) {
    const ext = botUser.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.avatar}.${ext}?size=${size}`;
  }
  return `https://cdn.discordapp.com/embed/avatars/0.png`;
}

function baseEmbed(opts) {
  const {
    color = C.pink,
    title,
    description,
    fields = [],
    footerExtra = "",
  } = opts;
  const avatar = botAvatarUrl(64);
  return {
    color,
    author: {
      name: "Zero Two · Dev Watcher",
      icon_url: avatar,
    },
    title,
    description,
    fields: fields.filter(Boolean).slice(0, 25),
    thumbnail: avatar ? { url: botAvatarUrl(128) } : undefined,
    timestamp: new Date().toISOString(),
    footer: {
      text: footerExtra
        ? `🌸 Zero Two Dev · ${footerExtra}`
        : "🌸 Zero Two Dev · Watcher",
      icon_url: avatar,
    },
  };
}

async function sendDevEmbed(embed, components = []) {
  if (!DEV_CHANNEL_ID) return null;
  const msg = await discordRequest(
    "POST",
    `/channels/${DEV_CHANNEL_ID}/messages`,
    { embeds: [embed], components },
  );
  return msg?.id ?? null;
}

async function editDevMessage(msgId, embed, components = []) {
  if (!DEV_CHANNEL_ID || !msgId) return;
  await discordRequest(
    "PATCH",
    `/channels/${DEV_CHANNEL_ID}/messages/${msgId}`,
    { embeds: [embed], components },
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function formatFileList(files, max = 12) {
  const list = files.slice(0, max).map((f) => {
    const name = f.replace(/\\/g, "/");
    let icon = "📄";
    if (name.includes("/commands/")) icon = "⚡";
    else if (name.includes("/events/")) icon = "📡";
    else if (name.includes("/music/")) icon = "🎵";
    else if (name.includes("/lib/")) icon = "🧩";
    else if (name.includes("/routes/")) icon = "🌐";
    else if (name.endsWith(".ts")) icon = "💠";
    return `${icon} \`${name}\``;
  });
  const extra =
    files.length > max ? `\n*…y ${files.length - max} más*` : "";
  return list.join("\n") + extra || "_sin detalle_";
}

function reloadButtons() {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: "Reiniciar ahora",
          emoji: { name: "🔄" },
          custom_id: "dev_reload_confirm",
        },
        {
          type: 2,
          style: 2,
          label: "Más tarde",
          emoji: { name: "⏳" },
          custom_id: "dev_reload_cancel",
        },
      ],
    },
  ];
}

function bar(pct, len = 10) {
  const f = Math.round((Math.min(100, Math.max(0, pct)) / 100) * len);
  return "█".repeat(f) + "░".repeat(Math.max(0, len - f));
}

// ── Notificaciones ────────────────────────────────────────────────────────────
async function notifyWatcherOnline() {
  await sendDevEmbed(
    baseEmbed({
      color: C.cyan,
      title: "👁️ Watcher en línea",
      description: [
        "El nexo de desarrollo está **activo** y vigilando el código.",
        "",
        "```ansi",
        "\u001b[0;36m● watching\u001b[0m  artifacts/api-server/src/**",
        "\u001b[0;35m● notify\u001b[0m    canal dev logs",
        "\u001b[0;32m● bot\u001b[0m       arrancando…",
        "```",
        "Cuando detecte cambios y compile bien, te pediré confirmación para reiniciar. 🌸",
      ].join("\n"),
      fields: [
        {
          name: "📁 Root",
          value: `\`${path.basename(ROOT)}\``,
          inline: true,
        },
        {
          name: "📡 Canal",
          value: DEV_CHANNEL_ID ? `<#${DEV_CHANNEL_ID}>` : "`—`",
          inline: true,
        },
        {
          name: "🧠 PID",
          value: `\`${process.pid}\``,
          inline: true,
        },
      ],
      footerExtra: "session start",
    }),
  );
}

async function notifyBuildReady(changedFiles) {
  buildSession += 1;
  const n = changedFiles.length;
  const embed = baseEmbed({
    color: C.amber,
    title: "✨ Build lista — ¿Reiniciar el bot?",
    description: [
      "He sincronizado el núcleo con tus últimos cambios.",
      "Pulsa **Reiniciar ahora** para aplicarlos, o **Más tarde** si sigues editando.",
      "",
      `> Sesión de build \`#${buildSession}\` · **${n}** archivo${n === 1 ? "" : "s"}`,
    ].join("\n"),
    fields: [
      {
        name: "📝 Archivos tocados",
        value: formatFileList(changedFiles),
        inline: false,
      },
      {
        name: "⚙️ Estado",
        value: [
          `\`[${bar(100)}]\` **100%** compile OK`,
          "Bot actual: **online** (pendiente de reload)",
        ].join("\n"),
        inline: false,
      },
    ],
    footerExtra: `build #${buildSession} · awaiting confirm`,
  });

  if (notifyMsgId) {
    await editDevMessage(notifyMsgId, embed, reloadButtons());
    return;
  }
  notifyMsgId = await sendDevEmbed(embed, reloadButtons());
}

async function notifyBuildError(stderr) {
  const text = String(stderr || "Sin detalle").slice(0, 1600);
  const isOom =
    /1455|out of memory|ENOMEM|VirtualAlloc|heap/i.test(text) ||
    !String(stderr || "").trim();

  await sendDevEmbed(
    baseEmbed({
      color: C.red,
      title: "💥 Fallo de compilación",
      description: isOom
        ? [
            "El compilador no dejó un log claro — suele ser **OOM** en Windows.",
            "",
            "**Qué probar**",
            "1. Cierra Chrome / apps pesadas",
            "2. `node artifacts/api-server/build.mjs`",
            "3. Reinicia el PC o sube el pagefile",
          ].join("\n")
        : "esbuild rechazó la build. Revisa el log:",
      fields: [
        {
          name: "📜 Log",
          value: `\`\`\`\n${text || "— vacío —"}\n\`\`\``,
          inline: false,
        },
      ],
      footerExtra: "build failed",
    }),
  );
}

async function notifyRestarting() {
  if (!notifyMsgId) return;
  await editDevMessage(
    notifyMsgId,
    baseEmbed({
      color: C.purple,
      title: "🔄 Reiniciando el núcleo…",
      description: [
        "Aplicando la nueva build.",
        "El proceso hijo se detendrá y volverá a subir en unos segundos.",
        "",
        `\`[${bar(60)}]\` *hot reload en curso*`,
      ].join("\n"),
      footerExtra: `build #${buildSession} · restarting`,
    }),
    [],
  );
}

async function notifyRestarted() {
  const up =
    botStartedAt != null
      ? `arranque <t:${Math.floor(botStartedAt / 1000)}:R>`
      : "recién online";

  const embed = baseEmbed({
    color: C.green,
    title: "✅ Bot reiniciado · nexo estable",
    description: [
      "La build se aplicó con éxito. Zero Two vuelve a estar **online**. 🌸",
      "",
      `> Build \`#${buildSession}\` · ${up}`,
    ].join("\n"),
    fields: [
      {
        name: "🟢 Estado",
        value: "`ONLINE`",
        inline: true,
      },
      {
        name: "📦 Sesión",
        value: `\`#${buildSession}\``,
        inline: true,
      },
      {
        name: "👁️ Watcher",
        value: "`activo`",
        inline: true,
      },
    ],
    footerExtra: `build #${buildSession} · ready`,
  });

  if (notifyMsgId) {
    await editDevMessage(notifyMsgId, embed, []);
    notifyMsgId = null;
  } else {
    await sendDevEmbed(embed);
  }
}

async function notifyCancelled() {
  // handled mostly by bot's devReload; watcher may clear pending
  pendingBuild = false;
}

// ── Build ─────────────────────────────────────────────────────────────────────
function runBuild() {
  return new Promise((resolve) => {
    log("build", "compilando…", A.amber);
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
      process.stdout.write(`${A.dim}${s}${A.reset}`);
    });
    proc.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(`${A.red}${s}${A.reset}`);
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

// ── Proceso bot ───────────────────────────────────────────────────────────────
function startBot() {
  if (botProcess) return;
  log("bot", "arrancando proceso hijo…", A.green);

  botProcess = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: API_DIR,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    env: { ...process.env, NODE_ENV: "development" },
  });
  botStartedAt = Date.now();

  botProcess.on("message", (message) => {
    if (message?.type !== "dev_reload_confirm") return;
    log("ipc", "dev_reload_confirm → reinicio", A.purple);
    void notifyRestarting();
    restartBot().catch(console.error);
  });

  botProcess.on("exit", (code, signal) => {
    botProcess = null;
    if (isRestarting) return;
    if (code !== 0 && signal !== "SIGTERM") {
      log("bot", `salió code=${code} signal=${signal}`, A.red);
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
    setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* */
      }
      resolve();
    }, 8000);
  });
}

async function restartBot() {
  if (isRestarting) return;
  isRestarting = true;
  log("bot", "reiniciando…", A.purple);
  await killBot();
  pendingBuild = false;
  isRestarting = false;
  startBot();
  await notifyRestarted();
}

process.on("SIGUSR2", () => {
  log("signal", "SIGUSR2 → reinicio", A.purple);
  void notifyRestarting();
  restartBot().catch(console.error);
});

// ── File watch ────────────────────────────────────────────────────────────────
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
    log(
      "fs",
      `cambios (${files.length})\n${files.map((f) => `     · ${f}`).join("\n")}`,
      A.cyan,
    );

    const result = await runBuild();

    if (!result.ok) {
      log("build", "FALLIDA", A.red);
      const detail = (result.stderr || result.stdout || "").trim();
      if (!detail) {
        log(
          "hint",
          "Sin salida — posible OOM 1455. Cierra apps y reintenta.",
          A.amber,
        );
      } else {
        console.error(detail.slice(-3000));
      }
      await notifyBuildError(
        detail ||
          "Sin stderr (posible OOM / errno 1455). Cierra apps y reintenta.",
      ).catch(console.error);
      building = false;
      return;
    }

    log("build", "OK — esperando confirmación en Discord", A.green);
    pendingBuild = true;
    await notifyBuildReady(files).catch(console.error);
    building = false;
  }, 1500);
}

function watchRecursive(dir) {
  fs.watch(dir, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    if (!/\.(ts|js|mjs)$/.test(filename)) return;
    if (filename.startsWith("dist") || filename.includes("node_modules"))
      return;
    scheduleRebuild(path.join(dir, filename));
  });
  log("fs", `vigilando ${path.relative(ROOT, dir)}/`, A.cyan);
}

async function shutdown(signal) {
  console.log();
  log("sys", `${signal} — apagando…`, A.amber);
  if (DEV_CHANNEL_ID) {
    await sendDevEmbed(
      baseEmbed({
        color: C.slate,
        title: "💤 Watcher detenido",
        description:
          "El nexo de desarrollo se ha cerrado. El bot hijo también se detuvo.",
        footerExtra: "session end",
      }),
    ).catch(() => null);
  }
  await killBot();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`
${A.pink}╔══════════════════════════════════════════════════════╗
${A.pink}║${A.reset}  ${A.bold}${A.cyan}✦ Zero Two${A.reset} ${A.dim}·${A.reset} ${A.pink}Dev Watcher${A.reset}                       ${A.pink}║
${A.pink}║${A.reset}  ${A.dim}hot-reload · embeds · esbuild${A.reset}                    ${A.pink}║
${A.pink}╠══════════════════════════════════════════════════════╣
${A.pink}║${A.reset}  ${A.dim}root${A.reset}   ${ROOT.padEnd(42).slice(0, 42)}  ${A.pink}║
${A.pink}║${A.reset}  ${A.dim}canal${A.reset}  ${(DEV_CHANNEL_ID || "— no configurado —").padEnd(42).slice(0, 42)}  ${A.pink}║
${A.pink}╚══════════════════════════════════════════════════════╝${A.reset}
`);

if (!DISCORD_TOKEN) {
  log("warn", "DISCORD_TOKEN vacío — embeds desactivados", A.amber);
}
if (!DEV_CHANNEL_ID) {
  log("warn", "DEV_LOG_CHANNEL_ID vacío — solo consola", A.amber);
}

await loadBotUser();
if (botUser) log("discord", `conectado como ${botUser.username}`, A.green);

log("build", "build inicial…", A.amber);
const initial = await runBuild();
if (!initial.ok) {
  log("build", "build inicial FALLIDA", A.red);
  console.error(initial.stderr);
  process.exit(1);
}
log("build", "build inicial OK", A.green);

startBot();
watchRecursive(SRC_DIR);
await notifyWatcherOnline().catch(() => null);

log("sys", "listo — edita src/ y confirma reloads en Discord 🌸", A.pink);
