/**
 * Middleware de validación Zod para rutas Express.
 *
 * Uso:
 *   router.patch("/foo", validateBody(MySchema), handler)
 *   router.get("/foo", validateQuery(MyQuerySchema), handler)
 *
 * En caso de error de validación devuelve 400 con detalles de los campos.
 */
import type { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";

function formatZodError(err: ZodError): { field: string; message: string }[] {
  return err.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}

/**
 * Valida `req.body` contra un schema Zod y reemplaza el body
 * con el valor parseado (strip / coerce aplicados).
 */
export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation Error",
        code: "INVALID_REQUEST_BODY",
        details: formatZodError(result.error),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Valida `req.query` contra un schema Zod.
 */
export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: "Validation Error",
        code: "INVALID_QUERY_PARAMS",
        details: formatZodError(result.error),
      });
      return;
    }
    // Attach parsed query to request for downstream use
    (req as Request & { parsedQuery: T }).parsedQuery = result.data;
    next();
  };
}

// ── Schemas de guilds ─────────────────────────────────────────────────────────

export const PatchGuildSettingsBody = z.object({
  logChannelId: z.string().nullish(),
  channelId: z.string().nullish(),
  logEvents: z.array(z.string()).optional(),
  events: z.array(z.string()).optional(),
  ignoreBots: z.boolean().optional(),
  ignoreWebhooks: z.boolean().optional(),
  includeAttachments: z.boolean().optional(),
  joinAlertDays: z.number().int().min(0).max(365).optional(),
  ignoreChannels: z.array(z.string()).optional(),
  pingRoleId: z.string().nullish(),
}).passthrough(); // permite campos extra que el handler ya filtra

// ── Schemas de tickets ────────────────────────────────────────────────────────

export const PatchTicketConfigBody = z.object({
  categoryId: z.string().nullish(),
  staffRoleId: z.string().nullish(),
  logChannelId: z.string().nullish(),
  maxOpen: z.number().int().min(1).max(5).optional(),
  deleteAfterCloseSec: z.number().int().min(0).max(300).optional(),
  panelTitle: z.string().max(100).optional(),
  panelDescription: z.string().max(2000).optional(),
}).passthrough();

export const PostTicketPanelBody = z.object({
  channelId: z.string().min(1, "channelId es obligatorio"),
});

export const PostTicketCloseBody = z.object({
  reason: z.string().max(500).optional(),
});

// ── Schemas de level roles ────────────────────────────────────────────────────

export const LevelRoleEntrySchema = z.object({
  threshold: z.number().int().min(0),
  roleId: z.string().min(1),
});

export const PutLevelRolesBody = z.object({
  entries: z.array(LevelRoleEntrySchema).max(20),
});
