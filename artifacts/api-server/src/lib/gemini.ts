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
      model: "gemini-2.5-flash",
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
