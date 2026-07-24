import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import router from "./routes/index.js";
import authRouter from "./routes/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import {
  authRateLimiter,
  readRateLimiter,
  writeRateLimiter,
} from "./middleware/rateLimiter.js";
import { logger } from "./lib/logger.js";
import { BOT_VERSION } from "./bot/lib/version.js";
import {
  discordWebhookEventsGet,
  discordWebhookEventsPost,
  discordWebhookRawBody,
} from "./routes/discordWebhooks.js";

const app: Express = express();

// Dev Tunnels / reverse proxies send X-Forwarded-* — needed for secure cookies & correct hosts
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incomingId = req.headers["x-request-id"];
      const requestId = Array.isArray(incomingId)
        ? incomingId[0]
        : incomingId || randomUUID();

      res.setHeader("x-request-id", requestId);
      return requestId;
    },
    autoLogging: {
      ignore: (req) =>
        req.url === "/api/health" ||
        req.url === "/api/auth/status" ||
        req.url?.startsWith("/api/discord/webhooks"),
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url?.split("?")[0]} -> ${res.statusCode}`,
    customErrorMessage: (req, res) =>
      `${req.method} ${req.url?.split("?")[0]} -> ${res.statusCode}`,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
          remoteAddress: req.remoteAddress,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "X-Dev-Token",
      "Authorization",
      "X-Signature-Ed25519",
      "X-Signature-Timestamp",
    ],
  }),
);

app.use(cookieParser());

/**
 * Discord Event Webhooks MUST run before express.json():
 * signature is over the exact raw body bytes.
 * Public — no session cookie / requireAuth.
 */
app.get("/api/discord/webhooks/events", discordWebhookEventsGet);
app.post(
  "/api/discord/webhooks/events",
  discordWebhookRawBody,
  discordWebhookEventsPost,
);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api/health", async (_req: Request, res: Response) => {
  let dbStatus: { ok: boolean; ms: number; error?: string } = {
    ok: false,
    ms: 0,
  };
  try {
    const { pingDb } = await import("@workspace/db");
    dbStatus = await pingDb();
  } catch (err) {
    dbStatus = {
      ok: false,
      ms: 0,
      error: err instanceof Error ? err.message : "db unavailable",
    };
  }

  res.status(dbStatus.ok ? 200 : 503).json({
    status: dbStatus.ok ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    signature: `Zero Two Core API // ${BOT_VERSION}`,
    db: dbStatus,
  });
});

// Auth routes (public) — rate limitado estrictamente
app.use("/api/auth", authRateLimiter, authRouter);

// Protected API surface — write limiter en métodos de escritura, read limiter general
app.use("/api", requireAuth, writeRateLimiter, readRateLimiter, router);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error(
    { err, requestId: req.id },
    "❌ Excepción controlada en el núcleo del servidor Express",
  );

  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Interferencia crítica en los sistemas internos.",
    code: "CORE_SERVER_COLLAPSE",
  });
});

export default app;
