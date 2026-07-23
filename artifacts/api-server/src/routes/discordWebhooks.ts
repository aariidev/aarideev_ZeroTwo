/**
 * Discord Application Event Webhooks
 * https://docs.discord.com/developers/events/webhook-events
 *
 * Portal → Webhooks → URL de punto de conexión:
 *   {API_PUBLIC_URL}/api/discord/webhooks/events
 *
 * Firma Ed25519 con DISCORD_PUBLIC_KEY o verify_key de GET /applications/@me.
 * PING (type 0) → 204 + Content-Type application/json
 * Firma inválida → 401
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import sodium from "sodium-native";
import { EmbedBuilder } from "discord.js";
import { db, activityTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { BOT_VERSION } from "../bot/lib/version.js";

const PINK = 0xff2d6b;
const GREEN = 0x22c55e;
const AMBER = 0xf59e0b;
const RED = 0xef4444;

type WebhookOuter = {
  version?: number;
  application_id?: string;
  type?: number;
  event?: {
    type?: string;
    timestamp?: string;
    data?: Record<string, unknown>;
  };
};

let cachedPublicKey: string | null = null;
let fetchKeyPromise: Promise<string | null> | null = null;

function envPublicKey(): string | null {
  const k =
    process.env.DISCORD_PUBLIC_KEY?.trim() ||
    process.env.PUBLIC_KEY?.trim() ||
    "";
  // strip accidental quotes / whitespace
  const cleaned = k.replace(/^["']|["']$/g, "").replace(/\s+/g, "");
  return cleaned || null;
}

/** Public key: env first, else Bot API applications/@me.verify_key */
export async function resolveDiscordPublicKey(): Promise<string | null> {
  const fromEnv = envPublicKey();
  if (fromEnv) {
    cachedPublicKey = fromEnv;
    return fromEnv;
  }
  if (cachedPublicKey) return cachedPublicKey;
  if (fetchKeyPromise) return fetchKeyPromise;

  fetchKeyPromise = (async () => {
    const token = process.env.DISCORD_TOKEN?.trim();
    if (!token) return null;
    try {
      const res = await fetch(
        "https://discord.com/api/v10/applications/@me",
        {
          headers: {
            Authorization: `Bot ${token}`,
            "User-Agent": `ZeroTwoBot (${BOT_VERSION})`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) {
        logger.warn(
          { status: res.status },
          "discord webhooks: no se pudo leer applications/@me para verify_key",
        );
        return null;
      }
      const data = (await res.json()) as { verify_key?: string };
      const key = data.verify_key?.replace(/\s+/g, "") ?? null;
      if (key) {
        cachedPublicKey = key;
        logger.info(
          { keyPrefix: key.slice(0, 8) },
          "discord webhooks: verify_key cargada desde Discord API",
        );
      }
      return key;
    } catch (err) {
      logger.warn({ err }, "discord webhooks: error fetch verify_key");
      return null;
    } finally {
      fetchKeyPromise = null;
    }
  })();

  return fetchKeyPromise;
}

/** Validate X-Signature-Ed25519 + X-Signature-Timestamp against raw body. */
export function verifyDiscordEd25519(
  publicKeyHex: string,
  signatureHex: string,
  timestamp: string,
  rawBody: Buffer | string,
): boolean {
  try {
    const sig = Buffer.from(signatureHex.trim(), "hex");
    const pk = Buffer.from(publicKeyHex.trim(), "hex");
    if (sig.length !== sodium.crypto_sign_BYTES) return false;
    if (pk.length !== sodium.crypto_sign_PUBLICKEYBYTES) return false;

    const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const message = Buffer.concat([Buffer.from(timestamp, "utf8"), bodyBuf]);
    return sodium.crypto_sign_verify_detached(sig, message, pk);
  } catch {
    return false;
  }
}

function ack204(res: Response): void {
  // Discord exige Content-Type válido en respuestas a PING
  res.status(204).type("json").end();
}

async function notifyOwnerWebhook(embed: EmbedBuilder): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Zero Two · App Events",
        embeds: [embed.toJSON()],
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    logger.warn({ err }, "discord webhook events: notify owner failed");
  }
}

function userLabel(u: Record<string, unknown> | undefined): {
  id: string;
  tag: string;
} {
  if (!u) return { id: "?", tag: "desconocido" };
  const id = String(u.id ?? "?");
  const username = String(u.username ?? "user");
  const disc = u.discriminator;
  const global = u.global_name ? String(u.global_name) : null;
  const tag =
    global ||
    (disc && disc !== "0" ? `${username}#${disc}` : username);
  return { id, tag };
}

async function handleAppEvent(
  eventType: string,
  timestamp: string | undefined,
  data: Record<string, unknown> | undefined,
): Promise<void> {
  const ts = timestamp ?? new Date().toISOString();

  switch (eventType) {
    case "APPLICATION_AUTHORIZED": {
      const user = userLabel(data?.user as Record<string, unknown> | undefined);
      const guild = data?.guild as Record<string, unknown> | undefined;
      const scopes = Array.isArray(data?.scopes)
        ? (data!.scopes as string[]).join(", ")
        : "—";
      const integration =
        data?.integration_type === 0
          ? "Servidor"
          : data?.integration_type === 1
            ? "Usuario"
            : `tipo ${String(data?.integration_type ?? "?")}`;

      logger.info(
        {
          event: eventType,
          userId: user.id,
          guildId: guild?.id,
          scopes,
        },
        "discord: APPLICATION_AUTHORIZED",
      );

      try {
        await db.insert(activityTable).values({
          command: "EVENT_APP_AUTHORIZED",
          userId: user.id,
          username: user.tag,
          guildId: guild?.id ? String(guild.id) : "user-install",
          guildName: guild?.name ? String(guild.name) : integration,
          success: true,
        });
      } catch (err) {
        logger.warn({ err }, "discord webhooks: activity insert failed");
      }

      const emb = new EmbedBuilder()
        .setColor(GREEN)
        .setAuthor({ name: `Zero Two · App autorizada · ${BOT_VERSION}` })
        .setTitle("✅ Nueva autorización")
        .setDescription(
          [
            `**Usuario:** \`${user.tag}\` (\`${user.id}\`)`,
            `**Contexto:** ${integration}`,
            guild?.name
              ? `**Servidor:** ${String(guild.name)} (\`${String(guild.id)}\`)`
              : null,
            `**Scopes:** \`${scopes}\``,
            `**Cuando:** <t:${Math.floor(new Date(ts).getTime() / 1000)}:R>`,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .setTimestamp(new Date(ts));
      await notifyOwnerWebhook(emb);
      break;
    }

    case "APPLICATION_DEAUTHORIZED": {
      const user = userLabel(data?.user as Record<string, unknown> | undefined);
      logger.info(
        { event: eventType, userId: user.id },
        "discord: APPLICATION_DEAUTHORIZED",
      );
      try {
        await db.insert(activityTable).values({
          command: "EVENT_APP_DEAUTHORIZED",
          userId: user.id,
          username: user.tag,
          guildId: "user",
          guildName: "deauthorized",
          success: true,
        });
      } catch {
        /* ignore */
      }
      const emb = new EmbedBuilder()
        .setColor(AMBER)
        .setAuthor({ name: `Zero Two · App desautorizada · ${BOT_VERSION}` })
        .setTitle("🔌 Autorización revocada")
        .setDescription(
          [
            `**Usuario:** \`${user.tag}\` (\`${user.id}\`)`,
            `**Cuando:** <t:${Math.floor(new Date(ts).getTime() / 1000)}:R>`,
          ].join("\n"),
        )
        .setTimestamp(new Date(ts));
      await notifyOwnerWebhook(emb);
      break;
    }

    case "ENTITLEMENT_CREATE":
    case "ENTITLEMENT_UPDATE":
    case "ENTITLEMENT_DELETE": {
      const sku = data?.sku_id ? String(data.sku_id) : "?";
      const userId = data?.user_id ? String(data.user_id) : "?";
      const id = data?.id ? String(data.id) : "?";
      logger.info(
        { event: eventType, sku, userId, id },
        `discord: ${eventType}`,
      );
      const color =
        eventType === "ENTITLEMENT_CREATE"
          ? GREEN
          : eventType === "ENTITLEMENT_DELETE"
            ? RED
            : AMBER;
      const emb = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `Zero Two · Entitlement · ${BOT_VERSION}` })
        .setTitle(eventType.replaceAll("_", " "))
        .setDescription(
          [
            `**ID:** \`${id}\``,
            `**SKU:** \`${sku}\``,
            `**User:** \`${userId}\``,
            `**Cuando:** <t:${Math.floor(new Date(ts).getTime() / 1000)}:R>`,
          ].join("\n"),
        )
        .setTimestamp(new Date(ts));
      await notifyOwnerWebhook(emb);
      break;
    }

    default: {
      logger.info(
        {
          event: eventType,
          keys: data ? Object.keys(data) : [],
        },
        "discord: webhook event (unhandled specialty)",
      );
      if (process.env.DISCORD_WEBHOOK_EVENTS_VERBOSE === "1") {
        const emb = new EmbedBuilder()
          .setColor(PINK)
          .setAuthor({ name: `Zero Two · Event webhook · ${BOT_VERSION}` })
          .setTitle(eventType)
          .setDescription(
            "```json\n" +
              JSON.stringify(data ?? {}, null, 2).slice(0, 1800) +
              "\n```",
          )
          .setTimestamp(new Date(ts));
        await notifyOwnerWebhook(emb);
      }
      break;
    }
  }
}

/**
 * POST handler — expects req.body as Buffer (express.raw) OR rawBody set.
 */
export const discordWebhookEventsPost: RequestHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const publicKey = await resolveDiscordPublicKey();
    if (!publicKey) {
      logger.error(
        "discord webhooks: sin public key (DISCORD_PUBLIC_KEY o Bot token)",
      );
      res.status(503).type("json").json({ error: "Webhook endpoint not configured" });
      return;
    }

    const signature = String(req.header("X-Signature-Ed25519") ?? "");
    const timestamp = String(req.header("X-Signature-Timestamp") ?? "");

    let raw: Buffer;
    if (Buffer.isBuffer(req.body)) {
      raw = req.body;
    } else if (
      (req as Request & { rawBody?: Buffer }).rawBody &&
      Buffer.isBuffer((req as Request & { rawBody?: Buffer }).rawBody)
    ) {
      raw = (req as Request & { rawBody: Buffer }).rawBody;
    } else if (typeof req.body === "string") {
      raw = Buffer.from(req.body);
    } else {
      logger.warn("discord webhooks: body no es raw Buffer");
      res.status(401).type("text").send("invalid request signature");
      return;
    }

    if (!signature || !timestamp) {
      res.status(401).type("text").send("invalid request signature");
      return;
    }

    if (!verifyDiscordEd25519(publicKey, signature, timestamp, raw)) {
      logger.warn(
        {
          hasSig: Boolean(signature),
          ts: timestamp,
          bodyLen: raw.length,
          keyLen: publicKey.length,
        },
        "discord webhooks: firma Ed25519 inválida",
      );
      res.status(401).type("text").send("invalid request signature");
      return;
    }

    let body: WebhookOuter;
    try {
      body = JSON.parse(raw.toString("utf8")) as WebhookOuter;
    } catch {
      res.status(400).type("json").json({ error: "invalid json" });
      return;
    }

    // type 0 = PING — must ACK with 204
    if (body.type === 0) {
      logger.info("discord webhooks: PING ok ✓");
      ack204(res);
      return;
    }

    // type 1 = Event — ACK first (< 3s), process async
    ack204(res);

    if (body.type === 1 && body.event?.type) {
      // fire-and-forget after response
      void handleAppEvent(
        body.event.type,
        body.event.timestamp,
        body.event.data,
      ).catch((err) => {
        logger.error(
          { err, type: body.event?.type },
          "discord webhooks: handler error",
        );
      });
    }
  } catch (err) {
    logger.error({ err }, "discord webhooks: unhandled POST error");
    if (!res.headersSent) {
      res.status(500).type("json").json({ error: "internal error" });
    }
  }
};

/** GET — status / URL hint (sin auth). */
export const discordWebhookEventsGet: RequestHandler = async (
  _req: Request,
  res: Response,
) => {
  const key = await resolveDiscordPublicKey();
  const base =
    process.env.API_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "";
  res.status(200).json({
    ok: true,
    configured: Boolean(key),
    endpoint: base
      ? `${base}/api/discord/webhooks/events`
      : "/api/discord/webhooks/events",
    method: "POST",
    hint: key
      ? "Pega la URL en Discord Developer Portal → Webhooks → URL de punto de conexión y Guarda"
      : "Falta public key: pon DISCORD_PUBLIC_KEY en .env o asegúrate de que DISCORD_TOKEN puede leer applications/@me",
    version: BOT_VERSION,
  });
};

/** Express middleware stack for POST: raw JSON body only on this path. */
export function discordWebhookRawBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // If a parent already filled raw buffer, skip
  if (Buffer.isBuffer(req.body)) {
    next();
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
  req.on("end", () => {
    req.body = Buffer.concat(chunks);
    next();
  });
  req.on("error", (err) => next(err));
}
