/**
 * Express middleware for beta tester authorization
 */
import type { Request, Response, NextFunction } from "express";
import { isBetaTester } from "./betatesters.js";
import { logger } from "./logger.js";

/**
 * Middleware: require user to be a beta tester
 */
export function requireBetaTester(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = req.sessionUser?.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized — no session" });
    return;
  }

  if (isBetaTester(userId)) {
    next();
    return;
  }

  logger.warn(
    { userId, path: req.path },
    "Non-beta tester attempted access to beta endpoint",
  );

  res.status(403).json({
    error: "Acceso denegado — necesitas ser beta tester para acceder a esta función.",
  });
}

/**
 * Middleware: allow beta testers to bypass certain checks
 * Adds betaTesterStatus to request
 */
export function attachBetaTesterStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = req.sessionUser?.id;
  (req as any).isBetaTester = userId ? isBetaTester(userId) : false;
  next();
}
