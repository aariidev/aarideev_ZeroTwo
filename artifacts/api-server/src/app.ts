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
      ignore: (req) => req.url === "/api/health" || req.url === "/api/auth/status",
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
    allowedHeaders: ["Content-Type", "X-Dev-Token", "Authorization"],
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    signature: "Zero Two Core API // v2.4.0",
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
