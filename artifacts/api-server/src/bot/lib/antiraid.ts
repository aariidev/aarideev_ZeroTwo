/**
 * Antiraid: detecta joins masivos y actúa (kick/ban/none).
 */
import {
  EmbedBuilder,
  type Client,
  type Guild,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { db, guildAntiraidSettingsTable, type GuildAntiraidSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { BOT_VERSION } from "./version.js";

const PINK = 0xff2d6b;

/** guildId → join timestamps (ms) */
const joinBuckets = new Map<string, number[]>();

export type AntiraidAction = "kick" | "ban" | "none";

export async function getAntiraidSettings(
  guildId: string,
): Promise<GuildAntiraidSettings> {
  const rows = await db
    .select()
    .from(guildAntiraidSettingsTable)
    .where(eq(guildAntiraidSettingsTable.guildId, guildId))
    .limit(1);
  if (rows[0]) return rows[0];

  await db.insert(guildAntiraidSettingsTable).values({ guildId }).catch(() => null);
  const again = await db
    .select()
    .from(guildAntiraidSettingsTable)
    .where(eq(guildAntiraidSettingsTable.guildId, guildId))
    .limit(1);
  return (
    again[0] ?? {
      guildId,
      enabled: false,
      threshold: 5,
      timeWindow: 60,
      action: "kick",
      logChannelId: null,
      updatedAt: new Date(),
    }
  );
}

export async function updateAntiraidSettings(
  guildId: string,
  patch: Partial<{
    enabled: boolean;
    threshold: number;
    timeWindow: number;
    action: AntiraidAction;
    logChannelId: string | null;
  }>,
): Promise<GuildAntiraidSettings> {
  await getAntiraidSettings(guildId); // ensure row
  const cur = await getAntiraidSettings(guildId);
  await db
    .update(guildAntiraidSettingsTable)
    .set({
      enabled: patch.enabled ?? cur.enabled,
      threshold: patch.threshold ?? cur.threshold,
      timeWindow: patch.timeWindow ?? cur.timeWindow,
      action: patch.action ?? cur.action,
      logChannelId:
        patch.logChannelId !== undefined ? patch.logChannelId : cur.logChannelId,
    })
    .where(eq(guildAntiraidSettingsTable.guildId, guildId));
  return getAntiraidSettings(guildId);
}

function pruneJoins(guildId: string, windowMs: number): number[] {
  const now = Date.now();
  const list = (joinBuckets.get(guildId) ?? []).filter((t) => now - t <= windowMs);
  joinBuckets.set(guildId, list);
  return list;
}

async function sendAntiraidLog(
  client: Client,
  settings: GuildAntiraidSettings,
  guild: Guild,
  member: GuildMember,
  joinCount: number,
  acted: string,
): Promise<void> {
  if (!settings.logChannelId) return;
  try {
    const ch = await client.channels.fetch(settings.logChannelId);
    if (!ch?.isTextBased() || ch.isDMBased()) return;
    await (ch as TextChannel).send({
      embeds: [
        new EmbedBuilder()
          .setColor(PINK)
          .setAuthor({
            name: "Zero Two · Antiraid",
            iconURL: client.user?.displayAvatarURL() ?? undefined,
          })
          .setTitle("🚨 Posible raid detectado")
          .setDescription(
            [
              `**Servidor:** ${guild.name}`,
              `**Joins en ventana:** \`${joinCount}\` / umbral \`${settings.threshold}\` (${settings.timeWindow}s)`,
              `**Miembro:** ${member} (\`${member.user.tag}\` · \`${member.id}\`)`,
              `**Cuenta creada:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
              `**Acción:** ${acted}`,
            ].join("\n"),
          )
          .setFooter({ text: `Zero Two ${BOT_VERSION}` })
          .setTimestamp(),
      ],
    });
  } catch (err) {
    logger.warn({ err, guildId: guild.id }, "antiraid: log failed");
  }
}

/**
 * Call on every guildMemberAdd.
 */
export async function handleAntiraidJoin(
  client: Client,
  member: GuildMember,
): Promise<void> {
  if (member.user.bot) return;

  const settings = await getAntiraidSettings(member.guild.id);
  if (!settings.enabled) return;

  const windowMs = Math.max(10, settings.timeWindow) * 1000;
  const threshold = Math.max(2, settings.threshold);

  const list = pruneJoins(member.guild.id, windowMs);
  list.push(Date.now());
  joinBuckets.set(member.guild.id, list);

  if (list.length < threshold) return;

  const action = (settings.action as AntiraidAction) || "kick";
  let acted = "solo alerta (none)";

  try {
    if (action === "kick") {
      await member.kick("Zero Two Antiraid: join rate limit");
      acted = "👢 kick";
    } else if (action === "ban") {
      await member.ban({
        reason: "Zero Two Antiraid: join rate limit",
        deleteMessageSeconds: 0,
      });
      acted = "🔨 ban";
    }
  } catch (err) {
    acted = `falló acción (${action}) — ¿permisos/jerarquía?`;
    logger.warn(
      { err, guildId: member.guild.id, userId: member.id },
      "antiraid: action failed",
    );
  }

  logger.warn(
    {
      guildId: member.guild.id,
      userId: member.id,
      joins: list.length,
      action,
    },
    "antiraid: trip",
  );

  await sendAntiraidLog(
    client,
    settings,
    member.guild,
    member,
    list.length,
    acted,
  );
}

export function registerAntiraid(client: Client): void {
  client.on("guildMemberAdd", (member) => {
    void handleAntiraidJoin(client, member).catch((err) =>
      logger.error({ err }, "antiraid: unhandled"),
    );
  });
  logger.info("🛡️ Antiraid listener activo");
}
