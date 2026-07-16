import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import authRouter from "./routes/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === "/api/health" || req.url === "/api/auth/status",
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
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
    signature: "Zero Two Core API // v2.3.0",
  });
});

// Auth routes (public)
app.use("/api/auth", authRouter);

// Protected API surface
app.use("/api", requireAuth, router);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error(
    { err },
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
