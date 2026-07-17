/**
 * Capture dashboard screenshots for README (assets/screenshots/*.jpg)
 * Requires: dashboard on :5173, api on :8080, SESSION_SECRET in .env
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "assets", "screenshots");

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signSession(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

const PAGES = [
  { file: "dashboard-home.jpg", url: "/", wait: 2500, name: "Overview" },
  {
    file: "dashboard-commands.jpg",
    url: "/commands",
    wait: 2500,
    name: "Commands",
  },
  {
    file: "dashboard-guilds.jpg",
    url: "/guilds",
    wait: 2500,
    name: "Guilds",
  },
  { file: "dashboard-warns.jpg", url: "/warns", wait: 2500, name: "Warns" },
  { file: "dashboard-logs.jpg", url: "/logs", wait: 2500, name: "Logs" },
];

async function main() {
  loadEnv();
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET missing in .env");

  const ownerId =
    (process.env.OWNER_IDS ?? "").split(",")[0]?.trim() || "100000000000000000";

  const token = signSession(
    {
      user: {
        id: ownerId,
        username: "aariidev",
        globalName: "Ari",
        avatar: null,
        discriminator: "0",
      },
      accessToken: "screenshot-capture-token",
      exp: Date.now() + 60 * 60 * 1000,
    },
    secret,
  );

  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });

  await context.addCookies([
    {
      name: "zt_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();
  const base = process.env.DASHBOARD_URL?.replace(/\/$/, "") || "http://localhost:5173";

  // Warm-up auth
  await page.goto(base + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  // If still on login, fail with clear message
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (/iniciar sesión|login with discord|VERIFICANDO/i.test(bodyText) && !(await page.locator("text=Overview").count())) {
    // check for typical app chrome
    const hasSidebar = (await page.locator("nav, aside").count()) > 0;
    if (!hasSidebar) {
      console.error("Auth failed — dashboard still shows login.");
      console.error(bodyText.slice(0, 400));
      await page.screenshot({ path: path.join(OUT, "_auth-fail.png") });
      await browser.close();
      process.exit(1);
    }
  }

  for (const shot of PAGES) {
    const target = base + shot.url;
    console.log(`→ ${shot.name}: ${target}`);
    await page.goto(target, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(shot.wait);
    // Hide toasts if any
    await page.evaluate(() => {
      document
        .querySelectorAll("[data-sonner-toaster], .Toaster, [role='status']")
        .forEach((el) => {
          el.style.display = "none";
        });
    });
    const outPath = path.join(OUT, shot.file);
    await page.screenshot({
      path: outPath,
      type: "jpeg",
      quality: 88,
      fullPage: false,
    });
    const size = fs.statSync(outPath).size;
    console.log(`  saved ${shot.file} (${Math.round(size / 1024)} KB)`);
  }

  await browser.close();
  console.log(`\nDone → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
