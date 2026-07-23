/**
 * Rate limiting middleware — express-rate-limit v7 compatible.
 *
 * Aplica ventanas deslizantes independientes para:
 *   - /api/auth  → login/OAuth (muy estricto)
 *   - Escritura  → POST / PATCH / DELETE en la API protegida
 *   - General    → lectura de la API protegida (permisivo)
 */
import { rateLimit, type Options } from "express-rate-limit";
import type { Request, Response } from "express";

function onLimitReached(_req: Request, res: Response): void {
  res.status(429).json({
    error: "Too Many Requests",
    message:
      "Demasiadas solicitudes. Espera un momento antes de volver a intentarlo.",
    code: "RATE_LIMIT_EXCEEDED",
  });
}

const BASE_OPTIONS: Partial<Options> = {
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Usa la IP real respetando X-Forwarded-For (trust proxy = 1 en app.ts)
  keyGenerator: (req) =>
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.ip ??
    "unknown",
};

/**
 * Rutas de autenticación OAuth (/api/auth/discord, /api/auth/me, …)
 * 30 requests / 15 minutos por IP.
 */
export const authRateLimiter = rateLimit({
  ...BASE_OPTIONS,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: undefined,
  handler: onLimitReached,
  skip: (req) => req.method === "GET" && req.path === "/status",
});

/**
 * Rutas de escritura (POST / PATCH / DELETE) en la API protegida.
 * 60 requests / 1 minuto por IP.
 */
export const writeRateLimiter = rateLimit({
  ...BASE_OPTIONS,
  windowMs: 60 * 1000,
  limit: 60,
  message: undefined,
  handler: onLimitReached,
  skip: (req) => req.method === "GET" || req.method === "HEAD",
});

/**
 * Lectura general de la API protegida.
 * 300 requests / 1 minuto por IP.
 */
export const readRateLimiter = rateLimit({
  ...BASE_OPTIONS,
  windowMs: 60 * 1000,
  limit: 300,
  message: undefined,
  handler: onLimitReached,
});
