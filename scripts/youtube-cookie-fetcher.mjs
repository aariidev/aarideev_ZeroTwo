import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Parse arguments
const args = process.argv.slice(2);
const isLoginMode = args.includes('--login');

// Paths
const AUTH_DIR = path.join(process.cwd(), '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'youtube.json');
const COOKIE_FILE = path.join(process.cwd(), '..', 'cookies.txt'); // Assuming script runs in /scripts

// Ensure auth dir exists
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

/**
 * Converts Playwright cookies to Netscape HTTP Cookie File format.
 * This format is required by youtube-dl-exec and yt-dlp.
 */
function formatNetscapeCookies(cookies) {
  let netscape = "# Netscape HTTP Cookie File\n";
  netscape += "# http://curl.haxx.se/rfc/cookie_spec.html\n";
  netscape += "# This is a generated file!  Do not edit.\n\n";

  for (const cookie of cookies) {
    const domain = cookie.domain;
    const includeSubDomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const path = cookie.path;
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expiry = cookie.expires > 0 ? Math.floor(cookie.expires) : 0;
    const name = cookie.name;
    const value = cookie.value;

    netscape += `${domain}\t${includeSubDomains}\t${path}\t${secure}\t${expiry}\t${name}\t${value}\n`;
  }
  return netscape;
}

async function main() {
  if (isLoginMode) {
    console.log("=== YOUTUBE COOKIE MATIC: LOGIN MODE ===");
    console.log("Opening browser...");
    console.log("Please log in to your Google/YouTube account in the browser window.");
    console.log("Waiting for authentication...");

    // Launch visible browser - try Edge first, fall back to chromium
    let browser;
    try {
      browser = await chromium.launch({ 
        headless: false, 
        channel: 'msedge',
        args: ['--disable-blink-features=AutomationControlled']
      });
    } catch (e) {
      console.log("Edge not found via channel, trying executablePath...");
      browser = await chromium.launch({ 
        headless: false, 
        executablePath: 'C:\\Program Files (x86)\\Microsoft\\EdgeCore\\152.0.4191.66\\msedge.exe',
        args: ['--disable-blink-features=AutomationControlled']
      });
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Hide playwright detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.goto('https://www.youtube.com');

    // Wait for successful authentication
    let authenticated = false;
    let attempts = 0;
    const maxAttempts = 300; // 5 minutes with 1-second checks

    while (!authenticated && attempts < maxAttempts) {
      try {
        const cookies = await context.cookies('https://www.youtube.com');
        // Check for YouTube authentication cookies
        const hasAuthCookie = cookies.some(c => 
          c.name === 'SAPISID' || 
          c.name === '__Secure-1PSID' || 
          c.name === '__Secure-3PSID' ||
          c.name === 'LOGIN_INFO' ||
          c.name === 'SECURE_SESSION'
        );
        
        if (hasAuthCookie) {
          // Check if page title changed to indicate logged in state
          const title = await page.title();
          if (title && title !== 'YouTube' && title !== '') {
            authenticated = true;
            console.log("✅ Authentication detected!");
            break;
          }
        }
      } catch (e) {
        // Page might still be loading or browser closed
        if (e.message.includes('closed')) {
          console.error("❌ Browser was closed before authentication could be saved.");
          process.exit(1);
        }
      }

      attempts++;
      if (attempts % 10 === 0) {
        console.log(`Waiting for authentication... (${attempts}s elapsed)`);
      }
      await page.waitForTimeout(1000);
    }

    if (!authenticated) {
      console.error("⚠️ Could not detect successful authentication after 5 minutes.");
      console.error("Make sure you logged in and are on the YouTube homepage.");
      try {
        await browser.close();
      } catch (e) {
        // Browser might already be closed
      }
      process.exit(1);
    }

    console.log("Saving session and cookies...");
    try {
      await context.storageState({ path: AUTH_FILE });
      
      // Also save cookies in Netscape format
      const cookies = await context.cookies('https://www.youtube.com');
      const netscapeFormat = formatNetscapeCookies(cookies);
      fs.writeFileSync(COOKIE_FILE, netscapeFormat, 'utf8');
      
      console.log(`✅ Session saved to ${AUTH_FILE}`);
      console.log(`✅ Cookies exported to ${COOKIE_FILE}`);
      console.log("You can now run 'pnpm run cookies:fetch' to automatically renew them.");
    } catch (e) {
      console.error("❌ Error saving session:", e.message);
      process.exit(1);
    } finally {
      try {
        await browser.close();
      } catch (e) {
        // Browser might already be closed
      }
    }

  } else {
    console.log("=== YOUTUBE COOKIE MATIC: AUTOMATIC MODE ===");
    if (!fs.existsSync(AUTH_FILE)) {
      console.error("❌ No session found!");
      console.error("Please run 'pnpm run cookies:login' first to log in manually.");
      process.exit(1);
    }

    console.log("Launching headless browser with saved session...");
    let browser;
    try {
      browser = await chromium.launch({ 
        headless: true, 
        channel: 'msedge',
        args: ['--disable-blink-features=AutomationControlled']
      });
    } catch (e) {
      console.log("Edge not found via channel, trying executablePath...");
      browser = await chromium.launch({ 
        headless: true, 
        executablePath: 'C:\\Program Files (x86)\\Microsoft\\EdgeCore\\152.0.4191.66\\msedge.exe',
        args: ['--disable-blink-features=AutomationControlled']
      });
    }
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    
    // Hide playwright detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log("Navigating to YouTube to refresh cookies...");
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' });
    
    // Optional: wait a bit to ensure background auth requests finish
    await page.waitForTimeout(3000);

    const cookies = await context.cookies('https://www.youtube.com');
    if (cookies.length === 0) {
      console.error("❌ No cookies found. Your session might have expired.");
      console.error("Please run 'pnpm run cookies:login' again.");
      await browser.close();
      process.exit(1);
    }

    console.log(`Found ${cookies.length} cookies. Formatting to Netscape...`);
    const netscapeFormat = formatNetscapeCookies(cookies);
    fs.writeFileSync(COOKIE_FILE, netscapeFormat, 'utf8');
    
    // Update the saved session state in case cookies were refreshed
    await context.storageState({ path: AUTH_FILE });

    await browser.close();
    console.log(`✅ Cookies successfully updated in ${COOKIE_FILE}`);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
