/**
 * Beta testers — Zero Two.
 *
 * Fuentes (unión):
 *  1. ENV: BETA_TESTER_IDS (y alias BETATESTERS_IDS)
 *  2. Archivo persistente data/beta-testers.json (add/remove en runtime)
 *
 * Los owners siempre se tratan como beta para acceso a features.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../../lib/logger.js";

const CACHE_TTL_MS = 30_000;

let envCache: Set<string> | null = null;
let envCacheAt = 0;
/** IDs añadidos en runtime / archivo (persistentes) */
let extraIds = new Set<string>();
/** IDs quitados del env en runtime (solo sesión, no borra el .env) */
let removedIds = new Set<string>();
let fileLoaded = false;

function parseIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ownerIds(): string[] {
  return parseIds(process.env.OWNER_IDS);
}

function envBetaIds(): Set<string> {
  const now = Date.now();
  if (envCache && now - envCacheAt < CACHE_TTL_MS) return envCache;

  const fromPrimary = parseIds(process.env.BETA_TESTER_IDS);
  const fromAlias = parseIds(process.env.BETATESTERS_IDS);
  envCache = new Set([...fromPrimary, ...fromAlias]);
  envCacheAt = now;
  return envCache;
}

function dataFilePath(): string {
  // Prefer CWD (repo root when bot runs from monorepo), fallback junto al dist
  const candidates = [
    path.resolve(process.cwd(), "data", "beta-testers.json"),
    path.resolve(process.cwd(), "artifacts", "api-server", "data", "beta-testers.json"),
  ];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.resolve(here, "..", "..", "..", "data", "beta-testers.json"));
  } catch {
    /* */
  }
  // Use first existing parent dir writable, else CWD/data
  for (const p of candidates) {
    const dir = path.dirname(p);
    try {
      if (fs.existsSync(dir) || fs.existsSync(path.dirname(dir))) return p;
    } catch {
      /* */
    }
  }
  return candidates[0]!;
}

function ensureFileLoaded(): void {
  if (fileLoaded) return;
  fileLoaded = true;
  const file = dataFilePath();
  try {
    if (!fs.existsSync(file)) return;
    const raw = fs.readFileSync(file, "utf8");
    const json = JSON.parse(raw) as { ids?: string[] };
    if (Array.isArray(json.ids)) {
      extraIds = new Set(json.ids.map(String).filter(Boolean));
      logger.info(
        { count: extraIds.size, file },
        "🧪 Beta testers cargados desde archivo",
      );
    }
  } catch (err) {
    logger.warn({ err, file }, "No se pudo leer beta-testers.json");
  }
}

function persistExtra(): void {
  const file = dataFilePath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          ids: [...extraIds],
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch (err) {
    logger.warn({ err, file }, "No se pudo guardar beta-testers.json");
  }
}

/** Todos los IDs beta activos (env + archivo − removidos en sesión) */
export function getAllBetatesters(): string[] {
  ensureFileLoaded();
  const set = new Set<string>([...envBetaIds(), ...extraIds]);
  for (const id of removedIds) set.delete(id);
  return [...set];
}

export function isBetaTester(userId: string | null | undefined): boolean {
  if (!userId) return false;
  ensureFileLoaded();
  if (ownerIds().includes(userId)) return true;
  if (removedIds.has(userId)) return false;
  if (extraIds.has(userId)) return true;
  return envBetaIds().has(userId);
}

/** True si es beta (no owner) o owner */
export function isBetaOrOwner(userId: string): boolean {
  return isBetaTester(userId);
}

export function addBetaTester(userId: string): { ok: true; already: boolean } {
  ensureFileLoaded();
  removedIds.delete(userId);
  const already =
    extraIds.has(userId) ||
    (envBetaIds().has(userId) && !removedIds.has(userId));
  extraIds.add(userId);
  persistExtra();
  return { ok: true, already };
}

export function removeBetaTester(userId: string): {
  ok: true;
  wasPresent: boolean;
  onlyEnv: boolean;
} {
  ensureFileLoaded();
  const inExtra = extraIds.has(userId);
  const inEnv = envBetaIds().has(userId);
  const wasPresent = (inExtra || inEnv) && !removedIds.has(userId);

  if (inExtra) {
    extraIds.delete(userId);
    persistExtra();
  }
  if (inEnv) {
    // No podemos editar .env: marcamos exclusión de sesión
    removedIds.add(userId);
  }
  return { ok: true, wasPresent, onlyEnv: inEnv && !inExtra };
}

export function invalidateBetaCache(): void {
  envCache = null;
  envCacheAt = 0;
}

export type BetaFeature = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

/** Catálogo de features experimentales (ajusta al ir liberando) */
export function listBetaFeatures(): BetaFeature[] {
  return [
    {
      id: "presence",
      name: "Rich Presence 2.0",
      description: "Now playing real, modo Darling y /presence preview",
      enabled: true,
    },
    {
      id: "music-spotify",
      name: "Spotify → YouTube progressive",
      description: "Playlists con carga progresiva y embeds verdes",
      enabled: true,
    },
    {
      id: "maintenance-bypass",
      name: "Bypass de mantenimiento",
      description: "Usar el bot mientras está en modo mantenimiento",
      enabled: true,
    },
    {
      id: "no-cooldown",
      name: "Sin cooldowns",
      description: "Cooldowns de comandos desactivados para testers",
      enabled: true,
    },
    {
      id: "dashboard-beta",
      name: "Dashboard experimental",
      description: "Secciones nuevas del panel web (en desarrollo)",
      enabled: true,
    },
  ];
}

export function getBetaTesterFeatures(userId: string): {
  canAccess: boolean;
  features: BetaFeature[];
} {
  const canAccess = isBetaTester(userId);
  return {
    canAccess,
    features: canAccess ? listBetaFeatures() : [],
  };
}
