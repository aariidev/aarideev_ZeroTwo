import type { Request, Response, NextFunction } from "express";
import {
  COOKIE_NAME,
  verifySession,
  type SessionUser,
} from "../lib/session.js";

export interface AuthedRequest extends Request {
  sessionUser?: SessionUser;
  accessToken?: string;
}

declare global {
  namespace Express {
    interface Request {
      sessionUser?: SessionUser;
      /** Discord OAuth access token for the logged-in user */
      accessToken?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    req.cookies?.[COOKIE_NAME] ??
    (typeof req.headers.cookie === "string"
      ? parseCookie(req.headers.cookie)[COOKIE_NAME]
      : undefined);

  const session = verifySession(token);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
  }

  req.sessionUser = session.user;
  req.accessToken = session.accessToken;
  next();
}

function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}
