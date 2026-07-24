/**
 * API Beta Testers — /api/beta/*
 * Requiere sesión Discord (requireAuth en app.ts).
 */
import { Router, type Request, type Response } from "express";
import {
  isBetaTester,
  getAllBetatesters,
  addBetaTester,
  removeBetaTester,
  listBetaFeatures,
  getBetaTesterFeatures,
} from "../bot/lib/betatesters.js";
import { isBotOwner } from "../lib/guildAccess.js";
import { logger } from "../lib/logger.js";
import { BOT_VERSION } from "../bot/lib/version.js";

const router = Router();

/** Feedback en memoria (últimos N); también va a logs */
const FEEDBACK_MAX = 100;
const feedbackLog: Array<{
  id: string;
  userId: string;
  username?: string;
  title: string;
  description: string;
  type: string;
  submittedAt: string;
}> = [];

function requireBeta(req: Request, res: Response): string | null {
  const userId = req.sessionUser?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
    return null;
  }
  if (!isBetaTester(userId)) {
    res.status(403).json({
      error: "Necesitas ser beta tester para esta acción.",
      code: "BETA_REQUIRED",
    });
    return null;
  }
  return userId;
}

/**
 * GET /api/beta/status
 * Estado del usuario actual (cualquier sesión autenticada).
 */
router.get("/status", (req: Request, res: Response) => {
  const userId = req.sessionUser?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
  }

  const beta = isBetaTester(userId);
  const owner = isBotOwner(userId);
  const { features } = getBetaTesterFeatures(userId);
  const enabledIds = features.filter((f) => f.enabled).map((f) => f.id);

  res.json({
    userId,
    isBetaTester: beta,
    isOwner: owner,
    version: BOT_VERSION,
    features: {
      canAccessBetaPanel: beta,
      canAccessBetaFeatures: beta,
      canUseBetaCommands: beta,
      betaFeaturesEnabled: enabledIds,
    },
    featureList: features,
    testerCount: getAllBetatesters().length,
  });
});

/**
 * GET /api/beta/features
 * Catálogo de features (público para autenticados; detalle completo si es beta).
 */
router.get("/features", (req: Request, res: Response) => {
  const userId = req.sessionUser?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
  }

  const beta = isBetaTester(userId);
  const list = listBetaFeatures();

  res.json({
    isBetaTester: beta,
    count: list.length,
    features: list.map((f) => ({
      id: f.id,
      name: f.name,
      description: beta
        ? f.description
        : "Disponible para beta testers — solicita acceso a la dev.",
      enabled: f.enabled,
      locked: !beta,
    })),
  });
});

/**
 * GET /api/beta/panel
 * Metadatos del panel (solo beta).
 */
router.get("/panel", (req: Request, res: Response) => {
  const userId = requireBeta(req, res);
  if (!userId) return;

  res.json({
    userId,
    accessLevel: isBotOwner(userId) ? "owner" : "beta-tester",
    panel: {
      title: "Panel de Beta Testers",
      subtitle: "Laboratorio experimental · Zero Two",
      sections: [
        {
          id: "info",
          title: "Información",
          description: "Tu acceso y beneficios del programa",
        },
        {
          id: "features",
          title: "Features",
          description: "Funciones experimentales activas",
        },
        {
          id: "feedback",
          title: "Feedback",
          description: "Reporta bugs o ideas",
        },
        ...(isBotOwner(userId)
          ? [
              {
                id: "manage",
                title: "Gestionar",
                description: "Añadir o quitar beta testers",
              },
            ]
          : []),
      ],
    },
  });
});

/**
 * POST /api/beta/feedback
 */
router.post("/feedback", (req: Request, res: Response) => {
  const userId = requireBeta(req, res);
  if (!userId) return;

  const title = String(req.body?.title ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const type = String(req.body?.type ?? "general").trim() || "general";

  if (!title || !description) {
    return res.status(400).json({
      error: "Título y descripción son requeridos",
      code: "VALIDATION",
    });
  }
  if (title.length > 120 || description.length > 4000) {
    return res.status(400).json({
      error: "Título máx. 120 · descripción máx. 4000",
      code: "VALIDATION",
    });
  }

  const entry = {
    id: `fb_${Date.now()}`,
    userId,
    username: req.sessionUser?.username,
    title,
    description,
    type,
    submittedAt: new Date().toISOString(),
  };
  feedbackLog.unshift(entry);
  if (feedbackLog.length > FEEDBACK_MAX) feedbackLog.length = FEEDBACK_MAX;

  logger.info(
    { userId, title, type, feedbackId: entry.id },
    "🧪 Beta feedback recibido",
  );

  res.status(201).json({ success: true, feedback: entry });
});

/**
 * GET /api/beta/feedback — owner only (últimos envíos)
 */
router.get("/feedback", (req: Request, res: Response) => {
  const userId = req.sessionUser?.id;
  if (!userId || !isBotOwner(userId)) {
    return res.status(403).json({
      error: "Solo owners pueden listar feedback",
      code: "OWNER_ONLY",
    });
  }
  res.json({ items: feedbackLog, count: feedbackLog.length });
});

/**
 * POST /api/beta/manage — owner only
 * body: { action: "add"|"remove"|"list", targetUserId?: string }
 */
router.post("/manage", (req: Request, res: Response) => {
  const userId = req.sessionUser?.id;
  if (!userId || !isBotOwner(userId)) {
    return res.status(403).json({
      error: "Solo los dueños del bot pueden gestionar beta testers",
      code: "OWNER_ONLY",
    });
  }

  const action = String(req.body?.action ?? "");
  const targetUserId = req.body?.targetUserId
    ? String(req.body.targetUserId).trim()
    : "";

  if (action === "list") {
    const betatesters = getAllBetatesters();
    return res.json({
      success: true,
      betatesters,
      count: betatesters.length,
    });
  }

  if (action === "add") {
    if (!/^\d{5,25}$/.test(targetUserId)) {
      return res.status(400).json({ error: "targetUserId inválido" });
    }
    const result = addBetaTester(targetUserId);
    logger.info({ by: userId, targetUserId }, "Beta tester añadido (API)");
    return res.json({
      success: true,
      action: "added",
      userId: targetUserId,
      already: result.already,
      betatesters: getAllBetatesters(),
    });
  }

  if (action === "remove") {
    if (!/^\d{5,25}$/.test(targetUserId)) {
      return res.status(400).json({ error: "targetUserId inválido" });
    }
    const result = removeBetaTester(targetUserId);
    logger.info({ by: userId, targetUserId }, "Beta tester eliminado (API)");
    return res.json({
      success: true,
      action: "removed",
      userId: targetUserId,
      wasPresent: result.wasPresent,
      onlyEnv: result.onlyEnv,
      betatesters: getAllBetatesters(),
    });
  }

  res.status(400).json({ error: "Acción no válida (add|remove|list)" });
});

/**
 * GET /api/beta/info — owner stats
 */
router.get("/info", (req: Request, res: Response) => {
  const userId = req.sessionUser?.id;
  if (!userId || !isBotOwner(userId)) {
    return res.status(403).json({
      error: "Solo owners",
      code: "OWNER_ONLY",
    });
  }

  const betatesters = getAllBetatesters();
  res.json({
    totalBetatesters: betatesters.length,
    betatesters,
    stats: {
      activeBetaFeatures: listBetaFeatures().filter((f) => f.enabled).length,
      feedbackSubmissions: feedbackLog.length,
      version: BOT_VERSION,
    },
  });
});

export default router;
