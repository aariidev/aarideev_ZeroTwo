import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    // Allow VS Code / Dev Tunnels hosts (*.devtunnels.ms, etc.)
    allowedHosts: true,
    // HMR over public HTTPS tunnel (optional)
    ...(process.env.TUNNEL_HOST
      ? {
          hmr: {
            protocol: "wss",
            host: process.env.TUNNEL_HOST.replace(/^https?:\/\//, "").replace(
              /\/+$/,
              "",
            ),
            clientPort: 443,
          },
        }
      : {}),
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        // Dev Tunnels default ~60s; keep headroom for Discord rate-limits
        timeout: 120_000,
        proxyTimeout: 120_000,
        // Keep Set-Cookie host as the public tunnel host (no Domain rewrite issues)
        cookieDomainRewrite: "",
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader("cookie", req.headers.cookie);
            }
            // Only mark HTTPS when the browser actually used the tunnel
            const host = String(req.headers.host ?? "");
            const isTunnel =
              host.includes("devtunnels.ms") ||
              host.includes("loca.lt") ||
              host.includes("ngrok");
            if (isTunnel || req.headers["x-forwarded-proto"] === "https") {
              proxyReq.setHeader("x-forwarded-proto", "https");
            }
            if (host) proxyReq.setHeader("x-forwarded-host", host);
          });
          proxy.on("error", (err, _req, res) => {
            const r = res as { writeHead?: Function; end?: Function; headersSent?: boolean };
            if (r && !r.headersSent && typeof r.writeHead === "function") {
              r.writeHead(502, { "Content-Type": "application/json" });
              r.end?.(
                JSON.stringify({
                  error: "API no disponible (proxy). ¿Está el bot en :8080?",
                }),
              );
            }
            console.error("[vite proxy /api]", err.message);
          });
        },
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
