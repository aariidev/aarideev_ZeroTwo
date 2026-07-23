/**
 * Beta Testers API routes
 *
 * Routes for accessing beta features and functionalities
 * Protected by requireBetaTester middleware
 */
import { Router, type Request, type Response } from "express";
import {
  isBetaTester,
  getBetaTesterFeatures,
  getAllBetatesters,
  addBetaTester,
  removeBetaTester,
} from "../lib/betatesters.js";
import { isBotOwner } from "../lib/guildAccess.js";
import { requireBetaTester, attachBetaTesterStatus } from "../middleware/betatesters.js";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * Attach beta tester status to all requests
 */
router.use(attachBetaTesterStatus);

/**
 * GET /api/beta/status
 * Get current user's beta tester status and available features
 */
router.get("/status", (req: Request, res: Response) => {
  const userId = req.sessionUser?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isBeta = isBetaTester(userId);
  const features = getBetaTesterFeatures(userId);

  res.json({
    userId,
    isBetaTester: isBeta,
    features,
  });
});

/**
 * GET /api/beta/features
 * List all available beta features (requires beta tester status)
 */
router.get("/features", requireBetaTester, (req: Request, res: Response) => {
  const betaFeatures = {
    dashboard: {
      name: "Dashboard en desarrollo",
      description: "Acceso a nuevas características del dashboard",
      enabled: true,
    },
    commands: {
      name: "Comandos Beta",
      description: "Acceso a comandos experimentales del bot",
      enabled: true,
    },
    api: {
      name: "API Beta",
      description: "Acceso a endpoints experimentales de la API",
      enabled: true,
    },
    analytics: {
      name: "Analítica avanzada",
      description: "Estadísticas detalladas y análisis del bot",
      enabled: true,
    },
  };

  res.json({
    features: betaFeatures,
    count: Object.keys(betaFeatures).length,
  });
});

/**
 * GET /api/beta/panel
 * Access to beta testing panel (requires beta tester status)
 */
router.get("/panel", requireBetaTester, (req: Request, res: Response) => {
  const userId = req.sessionUser?.id!;

  res.json({
    userId,
    accessLevel: "beta-tester",
    panel: {
      title: "Panel de Beta Testers",
      sections: [
        {
          id: "feedback",
          title: "Reporte de Bugs",
          description: "Reporta problemas con las features en desarrollo",
        },
        {
          id: "features",
          title: "Features Disponibles",
          description: "Explora y prueba nuevas funcionalidades",
        },
        {
          id: "changelog",
          title: "Changelog de Beta",
          description: "Historial de cambios en features beta",
        },
      ],
    },
  });
});

/**
 * POST /api/beta/feedback
 * Submit feedback for beta features (requires beta tester status)
 */
router.post("/feedback", requireBetaTester, (req: Request, res: Response) => {
  const userId = req.sessionUser?.id!;
  const { title, description, type = "general" } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      error: "Título y descripción son requeridos",
    });
  }

  logger.info(
    { userId, title, type },
    "Beta tester submitted feedback",
  );

  res.status(201).json({
    success: true,
    feedback: {
      id: `feedback_${Date.now()}`,
      userId,
      title,
      description,
      type,
      submittedAt: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/beta/manage (owner-only)
 * Manage beta testers list
 */
router.post("/manage", (req: Request, res: Response) => {
  const userId = req.sessionUser?.id;

  if (!userId || !isBotOwner(userId)) {
    return res.status(403).json({
      error: "Solo los dueños del bot pueden gestionar beta testers",
    });
  }

  const { action, targetUserId } = req.body;

  if (action === "add") {
    if (!targetUserId) {
      return res.status(400).json({ error: "Se requiere targetUserId" });
    }
    addBetaTester(targetUserId);
    logger.info({ by: userId, targetUserId }, "Added beta tester");
    return res.json({ success: true, action: "added", userId: targetUserId });
  }

  if (action === "remove") {
    if (!targetUserId) {
      return res.status(400).json({ error: "Se requiere targetUserId" });
    }
    removeBetaTester(targetUserId);
    logger.info({ by: userId, targetUserId }, "Removed beta tester");
    return res.json({ success: true, action: "removed", userId: targetUserId });
  }

  if (action === "list") {
    const testers = getAllBetatesters();
    return res.json({ success: true, betatesters: testers, count: testers.length });
  }

  res.status(400).json({ error: "Acción no válida" });
});

/**
 * GET /api/beta/info (owner-only)
 * Get beta testing statistics and info
 */
router.get("/info", (req: Request, res: Response) => {
  const userId = req.sessionUser?.id;

  if (!userId || !isBotOwner(userId)) {
    return res.status(403).json({
      error: "Solo los dueños del bot pueden acceder a esta información",
    });
  }

  const betatesters = getAllBetatesters();

  res.json({
    totalBetatesters: betatesters.length,
    betatesters,
    stats: {
      activeBetaFeatures: 4,
      reportedBugs: 0,
      feedbackSubmissions: 0,
    },
  });
});

export default router;
