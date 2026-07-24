import {
  ChannelType,
  Client,
  EmbedBuilder,
  Message,
  type OmitPartialGroupDMChannel,
} from "discord.js";
import {
  chatWithZeroTwo,
  clearUserHistory,
  getUserHistory,
  type ChatAccessTier,
  type ChatContext,
} from "../../lib/gemini.js";
import { logger } from "../../lib/logger.js";
import { devState } from "../../lib/devState.js";
import { ownerUserIds } from "../lib/specialUser.js";
import { isBetaTester } from "../lib/betatesters.js";

/** Simple per-user cooldown (ms) for DMs — VIP más rápido */
const DM_COOLDOWN_MS = 2500;
const DM_COOLDOWN_VIP_MS = 900;
const lastDmAt = new Map<string, number>();
const PINK = 0xff2d6b;
const CYAN = 0x00f5d4;
const RED = 0xef4444;
const GOLD = 0xfbbf24;
const PURPLE = 0xa78bfa;

/** Soft CTA: menos frecuente en VIP */
const PROMO_CHANCE = 0.28;
const PROMO_CHANCE_BETA = 0.1;
const PROMO_CHANCE_OWNER = 0.04;

function resolveDmAccessTier(userId: string): ChatAccessTier {
  if (ownerUserIds().includes(userId)) return "owner";
  if (isBetaTester(userId)) return "beta";
  return "public";
}

function promoChanceFor(tier: ChatAccessTier): number {
  if (tier === "owner") return PROMO_CHANCE_OWNER;
  if (tier === "beta") return PROMO_CHANCE_BETA;
  return PROMO_CHANCE;
}

function embedColorFor(tier: ChatAccessTier): number {
  if (tier === "owner") return GOLD;
  if (tier === "beta") return PURPLE;
  return PINK;
}

function titleFor(tier: ChatAccessTier, continuation: boolean): string {
  if (continuation) return "🌸 Continuación…";
  if (tier === "owner") return "👑 Zero Two · Nexo Dev";
  if (tier === "beta") return "🧪 Zero Two · Nexo Beta";
  return "🌸 Zero Two · Respuesta del núcleo";
}

const RESET_PHRASES = new Set([
  "reset",
  "limpiar",
  "clear",
  "borra",
  "borrar",
  "reiniciar",
  "/chat reset",
  "chat reset",
]);

function isDm(message: Message): boolean {
  return (
    message.channel.type === ChannelType.DM ||
    message.channel.type === ChannelType.GroupDM ||
    !message.guild
  );
}

function dashboardUrl(): string {
  return (
    process.env.DASHBOARD_URL ??
    process.env.PUBLIC_APP_URL ??
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function inviteUrl(client: Client): string {
  const id =
    process.env.CLIENT_ID ??
    process.env.DISCORD_CLIENT_ID ??
    client.user?.id ??
    "";
  if (!id) return "https://discord.com/developers/applications";
  const perms = "8"; // Administrator shortcut; user can tweak in portal
  return `https://discord.com/oauth2/authorize?client_id=${id}&permissions=${perms}&scope=bot%20applications.commands`;
}

function supportUrl(): string | null {
  const u = process.env.SUPPORT_SERVER_URL?.trim();
  return u || null;
}

type PromoTip = { name: string; value: string };

function pickPromo(client: Client, tier: ChatAccessTier = "public"): PromoTip | null {
  if (Math.random() > promoChanceFor(tier)) return null;

  const dash = dashboardUrl();
  const invite = inviteUrl(client);
  const support = supportUrl();

  const tips: PromoTip[] = [
    {
      name: "🖥️ Dashboard",
      value: `Gestiona logs, tickets y más aquí:\n${dash}`,
    },
    {
      name: "➕ Invítame a tu servidor",
      value: `Si quieres el nexo en tu plantación:\n[Añadir Zero Two](${invite})`,
    },
    {
      name: "📡 Panel web",
      value: `Stats en tiempo real, warns y config de guilds:\n${dash}`,
    },
    {
      name: "🌸 ¿Nuevo servidor?",
      value: `Llévame contigo — moderación, economía y tickets:\n[Invitar bot](${invite})`,
    },
    {
      name: "🎫 Tickets & logs",
      value: `Configúralos desde el dashboard sin pelear con comandos:\n${dash}`,
    },
  ];

  if (support) {
    tips.push({
      name: "💬 Servidor de soporte",
      value: `Dudas o novedades:\n${support}`,
    });
  }

  return tips[Math.floor(Math.random() * tips.length)] ?? null;
}

/** Split long AI text into embed-safe description chunks (max 4096). */
function chunkForEmbed(text: string, max = 4000): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    let chunk = rest.slice(0, max);
    const br = Math.max(chunk.lastIndexOf("\n\n"), chunk.lastIndexOf("\n"), chunk.lastIndexOf(" "));
    if (br > max * 0.55) chunk = chunk.slice(0, br);
    parts.push(chunk.trim());
    rest = rest.slice(chunk.length).trimStart();
  }
  return parts.filter(Boolean);
}

function baseEmbed(client: Client, title?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(PINK)
    .setAuthor({
      name: title ?? "Zero Two · Nexo privado",
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTimestamp();
}

async function replyEmbeds(
  message: Message,
  embeds: EmbedBuilder[],
): Promise<void> {
  const first = embeds.slice(0, 1);
  const rest = embeds.slice(1);
  await message.reply({ embeds: first, allowedMentions: { parse: [] } });
  for (const emb of rest) {
    await message.channel.send({
      embeds: [emb],
      allowedMentions: { parse: [] },
    });
  }
}

/**
 * Reply to private messages with Gemini (Zero Two personality) — embeds only.
 */
export function registerDmChat(client: Client): void {
  client.on(
    "messageCreate",
    async (message: OmitPartialGroupDMChannel<Message>) => {
      try {
        if (message.author.bot) return;
        if (!isDm(message)) return;

        const content = (message.content ?? "").trim();
        if (!content) {
          if (message.attachments.size > 0) {
            await replyEmbeds(message, [
              baseEmbed(client)
                .setDescription(
                  "🌸 Solo veo el archivo, parásito.\nEscríbeme **con texto** y te respondo desde el núcleo.",
                )
                .setFooter({ text: "MD · Zero Two" }),
            ]);
          }
          return;
        }

        const accessTier = resolveDmAccessTier(message.author.id);

        // Owners / beta pueden hablar con el núcleo aunque haya mantenimiento
        if (devState.current.maintenanceMode && accessTier === "public") {
          const msg =
            devState.current.maintenanceMessage?.slice(0, 4000) ||
            "🔧 Estoy en mantenimiento, parásito. Vuelve en un rato. 🌸";
          await replyEmbeds(message, [
            baseEmbed(client, "Zero Two · Mantenimiento")
              .setColor(0xf59e0b)
              .setDescription(msg)
              .setFooter({ text: "Comandos y nexo en pausa" }),
          ]);
          return;
        }

        const now = Date.now();
        const last = lastDmAt.get(message.author.id) ?? 0;
        const cooldown =
          accessTier === "public" ? DM_COOLDOWN_MS : DM_COOLDOWN_VIP_MS;
        if (now - last < cooldown) return;
        lastDmAt.set(message.author.id, now);

        const lower = content.toLowerCase();
        if (RESET_PHRASES.has(lower)) {
          clearUserHistory(message.author.id);
          const resetLine =
            accessTier === "owner"
              ? "Archivos del nexo **dev** purgados. ¿Nueva misión, cariño?"
              : accessTier === "beta"
                ? "Sesión de lab reiniciada, tester. ¿Otro experimento? 🧪"
                : "💢 Archivos de conversación borrados.\n¿Empezamos de cero, parásito?";
          await replyEmbeds(message, [
            baseEmbed(client, "Zero Two · Nexo reiniciado")
              .setColor(CYAN)
              .setDescription(
                `${resetLine}\n\n_Escribe lo que quieras — sigo en el nexo privado._`,
              )
              .setFooter({
                text: "Tip: escribe «reset» cuando quieras limpiar el historial",
              }),
          ]);
          return;
        }

        try {
          await message.channel.sendTyping();
        } catch {
          /* ignore */
        }

        const history = getUserHistory(message.author.id);
        const ctx: ChatContext = {
          userName: message.author.displayName,
          userHandle: message.author.username,
          userId: message.author.id,
          guildName: null,
          guildMemberCount: null,
          channelName: "MD",
          botUptimeMs: client.uptime ?? null,
          botGuildCount: client.guilds.cache.size,
          exchangeCount: Math.floor(history.length / 2),
          currentDateTime: new Date().toLocaleString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Madrid",
          }),
          accessTier,
        };

        const typingTimer = setInterval(() => {
          message.channel.sendTyping().catch(() => null);
        }, 8000);

        try {
          // VIP pueden mandar mensajes más largos al núcleo
          const inputCap = accessTier === "public" ? 2000 : 3500;
          const reply = await chatWithZeroTwo(
            message.author.id,
            content.slice(0, inputCap),
            ctx,
          );
          clearInterval(typingTimer);

          const text =
            reply?.trim() ||
            "…El nexo no devolvió datos. Prueba otra vez, parásito.";
          const chunks = chunkForEmbed(text);
          const exchanges = Math.floor(
            getUserHistory(message.author.id).length / 2,
          );
          const promo = pickPromo(client, accessTier);
          const color = embedColorFor(accessTier);

          const embeds = chunks.map((chunk, i) => {
            const emb = baseEmbed(client, titleFor(accessTier, i > 0))
              .setColor(color)
              .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
              .setDescription(chunk);

            if (i === 0) {
              const q =
                content.length > 200
                  ? `${content.slice(0, 197)}…`
                  : content;
              emb.addFields({
                name: "📡 Tú dijiste",
                value: q.length > 1020 ? `${q.slice(0, 1017)}…` : q,
              });
            }

            if (i === chunks.length - 1) {
              if (promo) {
                emb.addFields({
                  name: promo.name,
                  value: promo.value.slice(0, 1020),
                });
              }
              const tierTag =
                accessTier === "owner"
                  ? "👑 Dev"
                  : accessTier === "beta"
                    ? "🧪 Beta"
                    : "MD";
              emb.setFooter({
                text: [
                  `📨 ${tierTag}`,
                  `💬 ${exchanges} intercambio${exchanges !== 1 ? "s" : ""}`,
                  "«reset» para limpiar",
                ].join(" · "),
                iconURL: client.user?.displayAvatarURL() ?? undefined,
              });
            }

            return emb;
          });

          await replyEmbeds(message, embeds);
        } catch (err) {
          clearInterval(typingTimer);
          const isConfig =
            err instanceof Error && err.message.includes("GEMINI_API_KEY");
          logger.error(
            { err, userId: message.author.id },
            "dmChat: gemini error",
          );
          await replyEmbeds(message, [
            baseEmbed(client, "Zero Two · Error de sincronización")
              .setColor(RED)
              .setDescription(
                isConfig
                  ? "❌ **Nexo de IA no disponible.**\nFalta `GEMINI_API_KEY` en el servidor. Avisa al administrador."
                  : "❌ **Fallo en la transmisión, parásito.**\nAlgo interrumpió el enlace con mi núcleo. Inténtalo en unos segundos.",
              ),
          ]);
        }
      } catch (err) {
        logger.error({ err }, "dmChat: unhandled");
      }
    },
  );

  logger.info(
    "💬 DMs con Gemini activos (detalle ↑ · trato especial owner/beta · embeds)",
  );
}
