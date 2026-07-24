import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Sourcemaps on a ~6MB bundled bot eat a lot of RAM (Go esbuild → VirtualAlloc).
 * Default OFF to avoid Windows errno 1455 / OOM. Enable with:
 *   set ESBUILD_SOURCEMAP=1
 * Disable explicitly:
 *   set ESBUILD_DISABLE_SOURCEMAP=1
 */
function resolveSourcemap() {
  if (process.env.ESBUILD_DISABLE_SOURCEMAP === "1") return false;
  if (process.env.ESBUILD_SOURCEMAP === "1") return "linked";
  // Cheap maps only when explicitly developing with source maps
  if (process.env.ESBUILD_SOURCEMAP === "inline") return "inline";
  return false;
}

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  const sourcemap = resolveSourcemap();
  if (!sourcemap) {
    console.log(
      "[build] sourcemaps OFF (set ESBUILD_SOURCEMAP=1 to enable; saves RAM on Windows)",
    );
  }

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Lower peak memory on constrained machines
    treeShaking: true,
    legalComments: "none",
    // Avoid keeping the whole graph as huge strings longer than needed
    write: true,
    // Keep the biggest deps external so esbuild uses less RAM (Windows OOM / errno 1455).
    // Runtime resolves them from node_modules next to the package.
    external: [
      "*.node",
      // Heavy app deps — do not bundle
      "discord.js",
      "@discordjs/*",
      "discord-api-types",
      "@sapphire/*",
      "drizzle-orm",
      "drizzle-orm/*",
      "express",
      "express-*",
      "pino",
      "pino-*",
      "thread-stream",
      "sonic-boom",
      "zod",
      "cors",
      "cookie-parser",
      "express-rate-limit",
      // Bundle @workspace/* (TS monorepo packages) — do NOT externalize
      // or Node hits ERR_UNSUPPORTED_DIR_IMPORT on bare "./schema" paths.
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "@discordjs/opus",
      "@discordjs/voice",
      "sodium-native",
      "sodium",
      "libsodium-wrappers",
      "ffmpeg-static",
      "play-dl",
      "youtube-dl-exec",
      "opusscript",
      "tweetnacl",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap,
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] }),
    ],
    banner: {
      js: [
        "import { createRequire as __bannerCrReq } from 'node:module';",
        "import __bannerPath from 'node:path';",
        "import __bannerUrl from 'node:url';",
        "globalThis.require = __bannerCrReq(import.meta.url);",
        "globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);",
        "globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);",
      ].join("\n"),
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});