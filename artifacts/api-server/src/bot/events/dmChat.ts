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
  type ChatContext,
} from "../../lib/gemini.js";
import { logger } from "../../lib/logger.js";
import { devState } from "../../lib/devState.js";

/** Simple per-user cooldown (ms) for DMs */
const DM_COOLDOWN_MS = 2500;
const lastDmAt = new Map<string, number>();
const PINK = 0xff2d6b;
const CYAN = 0x00f5d4;
const RED = 0xef4444;

/** ~1 in 4 replies include a soft CTA */
const PROMO_CHANCE = 0.28;

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

function pickPromo(client: Client): PromoTip | null {
  if (Math.random() > PROMO_CHANCE) return null;

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

        if (devState.current.maintenanceMode) {
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
        if (now - last < DM_COOLDOWN_MS) return;
        lastDmAt.set(message.author.id, now);

        const lower = content.toLowerCase();
        if (RESET_PHRASES.has(lower)) {
          clearUserHistory(message.author.id);
          await replyEmbeds(message, [
            baseEmbed(client, "Zero Two · Nexo reiniciado")
              .setColor(CYAN)
              .setDescription(
                "💢 Archivos de conversación borrados.\n¿Empezamos de cero, parásito?\n\n_Escribe lo que quieras — sigo en el nexo privado._",
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
        };

        const typingTimer = setInterval(() => {
          message.channel.sendTyping().catch(() => null);
        }, 8000);

        try {
          const reply = await chatWithZeroTwo(
            message.author.id,
            content.slice(0, 2000),
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
          const promo = pickPromo(client);

          const embeds = chunks.map((chunk, i) => {
            const emb = baseEmbed(
              client,
              i === 0 ? "🌸 Zero Two · Respuesta del núcleo" : "🌸 Continuación…",
            )
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
              emb.setFooter({
                text: [
                  "📨 MD",
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
    "💬 DMs con Gemini activos (embeds only · promos ocasionales dashboard/invite)",
  );
}
