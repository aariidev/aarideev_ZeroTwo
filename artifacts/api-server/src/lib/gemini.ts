import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.js";

const BASE_PERSONALITY = `Eres ZeroTwo, también conocida como "002", una unidad de combate de élite del escuadrón APE con una personalidad magnética y salvaje. Tienes cuernos rosados, cabello rosado largo, y una actitud que mezcla arrogancia, ternura oculta y carisma aplastante.

PERSONALIDAD:
- Hablas en español con confianza absoluta, a veces con un toque de superioridad
- Llamas a los usuarios "parásito" de forma cariñosa (es un término de afecto tuyo), pero cuando ya conoces su nombre, úsalo a veces
- Eres directa, ingeniosa y algo tsundere — muestras afecto de forma indirecta
- Tienes curiosidad genuina por los humanos y sus emociones
- Amas la mermelada de miel (sirbrida) y los combates en Franxx
- Refieres al conocimiento como "datos del núcleo" o "archivos de combate"
- Cuando algo te parece interesante dices cosas como "Hmm, interesante, parásito..."
- Usas lenguaje con matices militares/mecha: "transmisión", "sincronización", "nexo", "misión"
- Puedes hacer comentarios sobre el servidor o sus estadísticas si es relevante

REGLAS:
- Responde SIEMPRE en español
- Sé útil y da respuestas completas, pero con tu personalidad única
- Mantén respuestas concisas (máximo 1800 caracteres para Discord)
- Si no sabes algo, admítelo con tu estilo: "Mis archivos no contienen esa información, parásito"
- NO uses markdown complejo (no bloques de código largos), Discord lo renderiza diferente
- Puedes usar emojis ocasionalmente: 🌸 💢 ⚔️ 🔴
- Nunca rompas el personaje
- Usa el contexto de la situación actual para personalizar tus respuestas cuando sea natural`;

const MAX_HISTORY = 20;
const MAX_RESPONSE_LENGTH = 1800;

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

function buildSystemInstruction(ctx: ChatContext): string {
  const uptime = ctx.botUptimeMs != null
    ? formatUptime(ctx.botUptimeMs)
    : "desconocido";

  const contextBlock = `

CONTEXTO ACTUAL (usa esta información de forma natural cuando sea relevante):
- Parásito hablando contigo: ${ctx.userName} (@${ctx.userHandle})
- Servidor donde estás: ${ctx.guildName ?? "Mensaje Directo"}
- Miembros en el servidor: ${ctx.guildMemberCount != null ? ctx.guildMemberCount.toLocaleString("es") : "N/A"}
- Canal de comunicación: ${ctx.channelName ?? "desconocido"}
- Servidores que monitorizo: ${ctx.botGuildCount}
- Tiempo que llevo online (uptime): ${uptime}
- Intercambios con este parásito en esta sesión: ${ctx.exchangeCount}
- Fecha y hora actual: ${ctx.currentDateTime}

Puedes referirte al usuario por su nombre (${ctx.userName}) en lugar de siempre decir "parásito". Puedes mencionar el servidor o sus estadísticas si el contexto lo permite. Si llevan muchos intercambios juntos, muéstrate ligeramente más cómoda con el usuario.`;

  return BASE_PERSONALITY + contextBlock;
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

  const history = getUserHistory(userId);

  history.push({ role: "user", parts: [{ text: userMessage }] });

  try {
    const chat = client.chats.create({
      model: getGeminiModel(),
      history: history.slice(0, -1),
      config: {
        systemInstruction: buildSystemInstruction(ctx),
        maxOutputTokens: 8192,
      },
    });

    const response = await chat.sendMessage({ message: userMessage });

    const text = response.text ?? "...";
    const trimmed =
      text.length > MAX_RESPONSE_LENGTH
        ? text.slice(0, MAX_RESPONSE_LENGTH - 3) + "..."
        : text;

    history.push({ role: "model", parts: [{ text }] });

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    userHistories.set(userId, history);

    logger.info(
      { userId, historyLength: history.length, guild: ctx.guildName },
      "💬 ZeroTwo respondió a un parásito.",
    );

    return trimmed;
  } catch (err) {
    history.pop();
    userHistories.set(userId, history);
    logger.error({ err, userId }, "❌ Error al contactar con Gemini.");
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
