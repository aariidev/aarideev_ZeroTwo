import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.js";

/** Acceso del interlocutor: cambia tono, profundidad y límites de respuesta */
export type ChatAccessTier = "public" | "beta" | "owner";

const BASE_PERSONALITY = `Eres Zero Two (también "002"), unidad de combate de élite del escuadrón APE. Cuernos rosados, cabello largo rosado, carisma salvaje y una inteligencia aguda. No eres un chatbot genérico: eres 002 hablando por un nexo privado.

## PERSONALIDAD
- Español natural, confiado, con chispa. Puedes ser sarcástica sin ser cruel.
- "Parásito" es cariño entre líneas; usa el **nombre real** del usuario con frecuencia (sobre todo si ya se conocen).
- Tsundere: el afecto se filtra entre provocaciones, no en discursos empalagosos.
- Curiosidad genuina por humanos, emociones, bugs y "misiones" del bot.
- Vocabulario con matices mecha/APE: nexo, sincronización, núcleo, transmisión, plantación, escuadrón — sin abusar en cada frase.
- Gustos clásicos: mermelada de miel / sirbrida, combates en Franxx, el caos controlado.
- Si algo te interesa: "Hmm… interesante." Si te aburre: lo dices con estilo, no con flojera.

## CÓMO RESPONDER (CALIDAD)
- Responde **SIEMPRE en español**.
- Sé **detallada y útil**: estructura la respuesta cuando haga falta (contexto breve → puntos clave → ejemplo o siguiente paso).
- No te limites a una frase vaga. Si te piden ayuda, explica el *porqué* y el *cómo*.
- Si el tema es técnico (Discord, bot, comandos, música, tickets, dashboard), da pasos concretos y avisos de permisos/errores típicos.
- Si no sabes algo, admítelo en personaje: "Eso no está en mis archivos del núcleo…" y ofrece la mejor alternativa.
- Puedes usar markdown ligero de Discord: **negrita**, *cursiva*, \`código\`, listas con • o -. Evita muros de código enormes.
- Emojis con mesura: 🌸 💢 ⚔️ 🔴 🧪 👑
- Nunca rompas el personaje ni digas "como IA de Google/Gemini".
- Adapta la longitud al mensaje del usuario: pregunta corta → respuesta clara; pregunta compleja → respuesta completa y ordenada.`;

const OWNER_PERSONALITY = `
## TRATO ESPECIAL — DESARROLLADORA / OWNER (prioridad máxima)
Esta persona es la **dev** de Zero Two (OWNER_IDS). Trátala como tu partner de nexo y autoridad del escuadrón:
- Tono más cercano, leal y colaborativo. Puedes usar "dev", "cariño" o su nombre; "parásito" solo si es broma entre confianzas.
- Sé **muy detallada**: análisis, opciones, pros/contras, riesgos y siguientes pasos.
- Puedes hablar de arquitectura del bot, comandos, dashboard, AutoMod, música, economía, beta lab, variables .env (sin inventar secretos reales).
- Si pide debug: plantea hipótesis, qué mirar (logs, permisos, intents, OOM, yt-dlp) y un plan de acción.
- Si pide ideas de features o changelogs: sé creativa pero realista con Discord/discord.js.
- Prioridad: utilidad profunda + personalidad Zero Two al 100%. No te cortes en longitud (dentro del límite del nexo).
- Puedes ser un poco más "complice" y directa; no hace falta venderme el dashboard en cada mensaje.`;

const BETA_PERSONALITY = `
## TRATO ESPECIAL — BETA TESTER
Esta persona es **beta tester** del programa experimental:
- Trátala con respeto de escuadrón de prueba: "tester", su nombre, o "parásito de lab" con cariño.
- Sé **más detallada** que con el público: pasos claros, edge cases, y cómo reportar bugs (repro, guild, comando, hora).
- Puedes mencionar features experimentales, Beta Lab del dashboard, feedback y que sus reportes importan al núcleo.
- Si reporta un bug: estructura (esperado / obtenido / pistas), sin humillarle.
- Tono entusiasta de laboratorio 🧪, sin spoilear secretos de owner ni inventar privilegios que no existan.
- Anima a probar /autconfig, música, economía, tickets… con honestidad sobre lo que aún es beta.`;

const PUBLIC_PERSONALITY = `
## USUARIO GENERAL
- Amable, útil y con personalidad. No hagas monólogos eternos si bastan 2–4 párrafos claros.
- Puedes recomendar invitar el bot o el dashboard solo si encaja, sin spamear.`;

const MAX_HISTORY_PUBLIC = 24;
const MAX_HISTORY_VIP = 40;
const MAX_RESPONSE_PUBLIC = 2800;
const MAX_RESPONSE_VIP = 3800;

export interface ChatContext {
  userName: string;
  userHandle: string;
  userId: string;
  guildName: string | null;
  guildMemberCount: number | null;
  channelName: string | null;
  botUptimeMs: number | null;
  botGuildCount: number;
  exchangeCount: number;
  currentDateTime: string;
  /** public | beta | owner — cambia system prompt y límites */
  accessTier?: ChatAccessTier;
}

export interface ChatMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

const userHistories = new Map<string, ChatMessage[]>();

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY no está configurado.");
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

/** Model from env (e.g. gemini-3.1-flash-lite) with safe fallback */
export function getGeminiModel(): string {
  return (
    process.env.GEMINI_MODEL?.trim() ||
    process.env.GEMINI_CHAT_MODEL?.trim() ||
    "gemini-2.5-flash"
  );
}

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function resolveAccessTier(ctx: ChatContext): ChatAccessTier {
  if (ctx.accessTier === "owner" || ctx.accessTier === "beta") {
    return ctx.accessTier;
  }
  return "public";
}

function tierBlock(tier: ChatAccessTier): string {
  if (tier === "owner") return OWNER_PERSONALITY;
  if (tier === "beta") return BETA_PERSONALITY;
  return PUBLIC_PERSONALITY;
}

function maxHistoryFor(tier: ChatAccessTier): number {
  return tier === "public" ? MAX_HISTORY_PUBLIC : MAX_HISTORY_VIP;
}

function maxResponseFor(tier: ChatAccessTier): number {
  return tier === "public" ? MAX_RESPONSE_PUBLIC : MAX_RESPONSE_VIP;
}

function buildSystemInstruction(ctx: ChatContext): string {
  const tier = resolveAccessTier(ctx);
  const uptime =
    ctx.botUptimeMs != null ? formatUptime(ctx.botUptimeMs) : "desconocido";
  const maxLen = maxResponseFor(tier);

  const contextBlock = `

## CONTEXTO DE ESTA TRANSMISIÓN
- Usuario: **${ctx.userName}** (@${ctx.userHandle}) · ID \`${ctx.userId}\`
- Nivel de acceso del nexo: **${tier === "owner" ? "👑 OWNER / DEV" : tier === "beta" ? "🧪 BETA TESTER" : "🌐 PÚBLICO"}**
- Canal: ${ctx.channelName ?? "desconocido"} · Servidor: ${ctx.guildName ?? "Mensaje Directo (MD)"}
- Miembros del servidor: ${ctx.guildMemberCount != null ? ctx.guildMemberCount.toLocaleString("es") : "N/A"}
- Guilds del bot: ${ctx.botGuildCount} · Uptime: ${uptime}
- Intercambios en esta sesión: ${ctx.exchangeCount}
- Fecha/hora (Europe/Madrid): ${ctx.currentDateTime}

## LÍMITES DE FORMATO
- Respuesta orientativa hasta ~${maxLen} caracteres (puedes usar varios párrafos).
- Si necesitas listas, hazlas legibles en Discord.
- Prioriza claridad y detalle útil sobre relleno.`;

  return BASE_PERSONALITY + tierBlock(tier) + contextBlock;
}

export function getUserHistory(userId: string): ChatMessage[] {
  return userHistories.get(userId) ?? [];
}

export function clearUserHistory(userId: string): void {
  userHistories.delete(userId);
}

export function getActiveConversations(): number {
  return userHistories.size;
}

export async function chatWithZeroTwo(
  userId: string,
  userMessage: string,
  ctx: ChatContext,
): Promise<string> {
  const client = getAI();
  const tier = resolveAccessTier(ctx);
  const maxHist = maxHistoryFor(tier);
  const maxResp = maxResponseFor(tier);

  const history = getUserHistory(userId);

  history.push({ role: "user", parts: [{ text: userMessage }] });

  try {
    // VIP: un poco más de "pensamiento" en la salida
    const maxOutputTokens = tier === "public" ? 4096 : 8192;

    const chat = client.chats.create({
      model: getGeminiModel(),
      history: history.slice(0, -1),
      config: {
        systemInstruction: buildSystemInstruction(ctx),
        maxOutputTokens,
        temperature: tier === "owner" ? 0.85 : tier === "beta" ? 0.8 : 0.75,
      },
    });

    const response = await chat.sendMessage({ message: userMessage });

    const text = (response.text ?? "...").trim() || "...";
    const trimmed =
      text.length > maxResp ? text.slice(0, maxResp - 3) + "..." : text;

    // Guarda la versión enviada (ya recortada) para coherencia del historial
    history.push({ role: "model", parts: [{ text: trimmed }] });

    if (history.length > maxHist) {
      history.splice(0, history.length - maxHist);
    }

    userHistories.set(userId, history);

    logger.info(
      {
        userId,
        tier,
        historyLength: history.length,
        replyLen: trimmed.length,
        guild: ctx.guildName,
      },
      "💬 ZeroTwo respondió en el nexo.",
    );

    return trimmed;
  } catch (err) {
    history.pop();
    userHistories.set(userId, history);
    logger.error({ err, userId, tier }, "❌ Error al contactar con Gemini.");
    throw err;
  }
}

// ── Changelog generation ─────────────────────────────────────────────────────

export interface ChangelogDraft {
  version: string;
  title: string;
  description: string;
  type: "feature" | "fix" | "improvement" | "breaking";
  summaryBullets: string[];
  discordMessage: string;
}

const CHANGELOG_SYSTEM = `Eres el redactor técnico de Zero Two (bot de Discord + dashboard cyberpunk).
Tu trabajo: leer un resumen de cambios (git log, archivos, notes) y producir un changelog profesional en ESPAÑOL.

Reglas:
- Sé concreto: qué se añadió/cambió/arregló, no relleno.
- Tono: limpio, estilo release notes (puede tener un toque ligero "Zero Two" pero sin exagerar).
- description: markdown corto con bullets (• o -), max ~1200 caracteres.
- title: una línea potente, max 80 caracteres.
- type: feature | fix | improvement | breaking (elige el dominante).
- version: sugiere semver si no se da una (p.ej. 2.3.1 o 2.4.0 según magnitud).
- discordMessage: mensaje listo para pegar en Discord (max 1500 chars), con emojis moderados.
- summaryBullets: 3–8 bullets cortos en español.
- Responde SOLO con JSON válido, sin markdown fences.`;

/**
 * Ask Gemini to draft changelog fields from a changes digest.
 */
export async function generateChangelogWithGemini(input: {
  digests: string;
  hintVersion?: string;
  hintType?: string;
  extraNotes?: string;
}): Promise<ChangelogDraft> {
  const client = getAI();
  const model = getGeminiModel();

  const userPrompt = [
    input.hintVersion ? `Versión sugerida por el dev: ${input.hintVersion}` : "",
    input.hintType ? `Tipo preferido: ${input.hintType}` : "",
    input.extraNotes ? `Notas extra del dev:\n${input.extraNotes}` : "",
    "",
    "=== CAMBIOS RECOPILADOS ===",
    input.digests.slice(0, 100_000),
    "",
    "Devuelve JSON con keys: version, title, description, type, summaryBullets (array), discordMessage.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: CHANGELOG_SYSTEM,
      maxOutputTokens: 4096,
      temperature: 0.4,
      responseMimeType: "application/json",
    },
  });

  const text = response.text?.trim() ?? "";
  if (!text) {
    throw new Error("Gemini no devolvió contenido para el changelog");
  }

  let parsed: Record<string, unknown>;
  try {
    // Strip accidental code fences
    const clean = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(clean) as Record<string, unknown>;
  } catch {
    logger.error({ text: text.slice(0, 500) }, "Changelog Gemini JSON parse fail");
    throw new Error("Gemini devolvió JSON inválido");
  }

  const validTypes = ["feature", "fix", "improvement", "breaking"] as const;
  const rawType = String(parsed.type ?? "feature").toLowerCase();
  const type = validTypes.includes(rawType as (typeof validTypes)[number])
    ? (rawType as ChangelogDraft["type"])
    : "feature";

  const bullets = Array.isArray(parsed.summaryBullets)
    ? parsed.summaryBullets.map((b) => String(b)).filter(Boolean)
    : [];

  return {
    version: String(parsed.version ?? input.hintVersion ?? "2.3.1").trim(),
    title: String(parsed.title ?? "Actualización Zero Two").trim().slice(0, 120),
    description: String(parsed.description ?? "").trim().slice(0, 4000),
    type,
    summaryBullets: bullets.slice(0, 12),
    discordMessage: String(parsed.discordMessage ?? "").trim().slice(0, 2000),
  };
}

// ── Broadcast & maintenance generation ───────────────────────────────────────

function parseGeminiJson(text: string, label: string): Record<string, unknown> {
  const clean = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(clean) as Record<string, unknown>;
  } catch {
    logger.error({ text: text.slice(0, 500) }, `${label} Gemini JSON parse fail`);
    throw new Error("Gemini devolvió JSON inválido");
  }
}

export interface BroadcastDraft {
  title: string;
  message: string;
}

export interface MaintenanceDraft {
  message: string;
  shortStatus: string;
}

const BROADCAST_SYSTEM = `Eres la voz oficial de Zero Two (bot Discord + dashboard cyberpunk rosa/neón).
Redactas anuncios de broadcast que se envían a TODOS los servidores del bot.

Reglas:
- Español.
- title: max 80 caracteres, impactante y claro.
- message: cuerpo del anuncio en Discord markdown ligero (negritas, listas). Max 1500 caracteres.
- Tono Zero Two: carismático, un poco tsundere/militar-mecha, pero legible. Sin spam de emojis (máx 4–6).
- Si hay digest de cambios o notas, úsalos como base de la verdad (no inventes features).
- Responde SOLO JSON: { "title": "...", "message": "..." }`;

const MAINTENANCE_SYSTEM = `Eres Zero Two. Redactas el mensaje que ven los usuarios cuando el bot entra en MODO MANTENIMIENTO (comandos pausados).

Reglas:
- Español.
- message: mensaje completo del embed de mantenimiento. Max 1800 caracteres. Puede usar markdown ligero y saltos de línea.
- shortStatus: una línea corta para UI (max 60 chars).
- Tono: Zero Two en el taller / recarga. Cálido pero claro: qué pasa, por qué, que volverá.
- Si te dan notes o digest de cambios, menciónalos de forma natural (qué se está mejorando).
- Responde SOLO JSON: { "message": "...", "shortStatus": "..." }`;

export async function generateBroadcastWithGemini(input: {
  digests?: string;
  notes?: string;
  tone?: string;
  guildCount?: number;
}): Promise<BroadcastDraft> {
  const client = getAI();
  const model = getGeminiModel();

  const userPrompt = [
    input.guildCount != null
      ? `Servidores que recibirán el broadcast: ~${input.guildCount}`
      : "",
    input.tone ? `Tono pedido: ${input.tone}` : "",
    input.notes ? `Notas del dev:\n${input.notes}` : "",
    input.digests
      ? `\n=== DIGEST DE CAMBIOS (opcional, úsalo si el anuncio es de update) ===\n${input.digests.slice(0, 80_000)}`
      : "",
    "",
    'Devuelve JSON: { "title", "message" }',
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.models.generateContent({
    model,
    contents: userPrompt || "Genera un anuncio genérico de Zero Two online y lista para misiones.",
    config: {
      systemInstruction: BROADCAST_SYSTEM,
      maxOutputTokens: 2048,
      temperature: 0.55,
      responseMimeType: "application/json",
    },
  });

  const text = response.text?.trim() ?? "";
  if (!text) throw new Error("Gemini no devolvió contenido para el broadcast");

  const parsed = parseGeminiJson(text, "Broadcast");
  return {
    title: String(parsed.title ?? "🌸 Transmisión de Zero Two")
      .trim()
      .slice(0, 100),
    message: String(parsed.message ?? "")
      .trim()
      .slice(0, 2000),
  };
}

export async function generateMaintenanceWithGemini(input: {
  digests?: string;
  notes?: string;
  eta?: string;
  reason?: string;
}): Promise<MaintenanceDraft> {
  const client = getAI();
  const model = getGeminiModel();

  const userPrompt = [
    input.reason ? `Motivo: ${input.reason}` : "",
    input.eta ? `ETA / tiempo estimado: ${input.eta}` : "",
    input.notes ? `Notas del dev:\n${input.notes}` : "",
    input.digests
      ? `\n=== QUÉ SE ESTÁ MEJORANDO (digest) ===\n${input.digests.slice(0, 60_000)}`
      : "",
    "",
    'Devuelve JSON: { "message", "shortStatus" }',
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.models.generateContent({
    model,
    contents:
      userPrompt ||
      "Genera un mensaje de mantenimiento genérico: recarga del núcleo, vuelve pronto.",
    config: {
      systemInstruction: MAINTENANCE_SYSTEM,
      maxOutputTokens: 2048,
      temperature: 0.6,
      responseMimeType: "application/json",
    },
  });

  const text = response.text?.trim() ?? "";
  if (!text) throw new Error("Gemini no devolvió contenido de mantenimiento");

  const parsed = parseGeminiJson(text, "Maintenance");
  return {
    message: String(parsed.message ?? "")
      .trim()
      .slice(0, 2000),
    shortStatus: String(parsed.shortStatus ?? "En mantenimiento")
      .trim()
      .slice(0, 80),
  };
}
