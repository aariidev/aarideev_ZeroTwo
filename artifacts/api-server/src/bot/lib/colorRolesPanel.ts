/**
 * Panel de roles de color por reacción (Zero Two).
 * Embed(s) + reacciones → self-assign de colores (exclusivo: un color a la vez).
 */
import {
  EmbedBuilder,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type TextChannel,
  type User,
} from "discord.js";
import { db, botConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { BOT_VERSION } from "./version.js";

const PINK = 0xff2d6b;
const MAX_REACTIONS_PER_MESSAGE = 20;

export type ColorRoleDef = {
  name: string;
  color: number;
  aliases?: string[];
};

const CONFIG_KEY = (guildId: string) => `color_reaction_panel:${guildId}`;

export type ColorPanelMessage = {
  channelId: string;
  messageId: string;
  /** emoji → roleId */
  map: Record<string, string>;
};

export type ColorPanelConfig = {
  guildId: string;
  exclusive: boolean;
  messages: ColorPanelMessage[];
  updatedAt: string;
};

/** messageId → panel meta (hot path for reactions) */
const messageIndex = new Map<
  string,
  { guildId: string; map: Record<string, string>; exclusive: boolean }
>();

function rebuildIndex(guildId: string, cfg: ColorPanelConfig | null) {
  // drop old entries for this guild
  for (const [mid, meta] of messageIndex) {
    if (meta.guildId === guildId) messageIndex.delete(mid);
  }
  if (!cfg) return;
  for (const m of cfg.messages) {
    messageIndex.set(m.messageId, {
      guildId,
      map: m.map,
      exclusive: cfg.exclusive,
    });
  }
}

export async function getColorPanelConfig(
  guildId: string,
): Promise<ColorPanelConfig | null> {
  try {
    const rows = await db
      .select()
      .from(botConfigTable)
      .where(eq(botConfigTable.key, CONFIG_KEY(guildId)))
      .limit(1);
    if (!rows[0]?.value) return null;
    const parsed = JSON.parse(rows[0].value) as ColorPanelConfig;
    if (!parsed?.messages?.length) return null;
    rebuildIndex(guildId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function saveColorPanelConfig(
  cfg: ColorPanelConfig,
): Promise<void> {
  const value = JSON.stringify(cfg);
  await db
    .insert(botConfigTable)
    .values({ key: CONFIG_KEY(cfg.guildId), value })
    .onDuplicateKeyUpdate({ set: { value } });
  rebuildIndex(cfg.guildId, cfg);
}

/** Leading emoji from role name (e.g. "🔴 Rojo" → "🔴") */
export function extractColorEmoji(name: string): string {
  const m = name.match(
    /^(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)/u,
  );
  if (m?.[1]) return m[1];
  // fallback: first token
  const tok = name.trim().split(/\s+/)[0];
  return tok && tok.length <= 8 ? tok : "🎨";
}

function normalizeLabel(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Resolve palette entries → live role IDs in the guild (by name/alias).
 */
export function resolveColorRolesInGuild(
  guild: Guild,
  palette: ColorRoleDef[],
): { def: ColorRoleDef; roleId: string; emoji: string }[] {
  const out: { def: ColorRoleDef; roleId: string; emoji: string }[] = [];
  const usedEmojis = new Set<string>();

  for (const def of palette) {
    const labels = new Set([
      normalizeLabel(def.name),
      ...(def.aliases ?? []).map(normalizeLabel),
    ]);
    labels.delete("");

    const role = guild.roles.cache.find((r) => {
      if (r.managed || r.id === guild.id) return false;
      const n = normalizeLabel(r.name);
      return labels.has(n) || r.name.toLowerCase() === def.name.toLowerCase();
    });
    if (!role) continue;

    let emoji = extractColorEmoji(def.name);
    if (usedEmojis.has(emoji)) {
      // rare collision — skip this entry rather than break reactions
      continue;
    }
    usedEmojis.add(emoji);
    out.push({ def, roleId: role.id, emoji });
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export type CreateColorPanelResult = {
  ok: boolean;
  messages: number;
  roles: number;
  channelId: string;
  errors: string[];
  messageUrls: string[];
};

/**
 * Post reaction-role embed(s) in `channel` for the given palette.
 * Max 20 reactions/message → auto-split into several embeds.
 */
export async function createColorReactionPanel(
  guild: Guild,
  channel: TextChannel,
  palette: ColorRoleDef[],
  botUser?: User | null,
): Promise<CreateColorPanelResult> {
  const result: CreateColorPanelResult = {
    ok: false,
    messages: 0,
    roles: 0,
    channelId: channel.id,
    errors: [],
    messageUrls: [],
  };

  const me = guild.members.me;
  if (!me) {
    result.errors.push("No se pudo leer el miembro del bot.");
    return result;
  }
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    result.errors.push("Falta permiso **Gestionar roles**.");
    return result;
  }
  const perms = channel.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.SendMessages)) {
    result.errors.push("No puedo enviar mensajes en ese canal.");
    return result;
  }
  if (!perms.has(PermissionFlagsBits.AddReactions)) {
    result.errors.push("No puedo añadir reacciones en ese canal.");
    return result;
  }
  if (!perms.has(PermissionFlagsBits.EmbedLinks)) {
    result.errors.push("No puedo enviar embeds en ese canal.");
    return result;
  }

  await guild.roles.fetch().catch(() => null);
  const resolved = resolveColorRolesInGuild(guild, palette);
  if (resolved.length === 0) {
    result.errors.push(
      "No hay roles de color en el servidor. Ejecuta `/autconfig` con `colores: true` primero.",
    );
    return result;
  }

  const chunks = chunk(resolved, MAX_REACTIONS_PER_MESSAGE);
  const panelMessages: ColorPanelMessage[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const part = chunks[i]!;
    const lines = part.map((p) => `${p.emoji} → **${p.def.name}**`);
    const embed = new EmbedBuilder()
      .setColor(PINK)
      .setAuthor({
        name: "Zero Two · Colores",
        iconURL: botUser?.displayAvatarURL({ size: 64 }),
      })
      .setTitle(
        chunks.length > 1
          ? `🎨 Elige tu color (${i + 1}/${chunks.length})`
          : "🎨 Elige tu color",
      )
      .setDescription(
        [
          "Reacciona con el emoji del color que quieras.",
          "Solo **un color a la vez**: al elegir otro se quita el anterior.",
          "Quita tu reacción para soltar el color.",
          "",
          lines.join("\n"),
        ].join("\n"),
      )
      .setFooter({
        text: `Zero Two ${BOT_VERSION} · Panel de colores`,
      })
      .setTimestamp();

    let msg: Message;
    try {
      msg = await channel.send({ embeds: [embed] });
    } catch (e) {
      result.errors.push(
        `No pude enviar el embed ${i + 1}: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    const map: Record<string, string> = {};
    for (const p of part) {
      try {
        await msg.react(p.emoji);
        map[p.emoji] = p.roleId;
        // mild rate-limit padding
        await new Promise((r) => setTimeout(r, 280));
      } catch (e) {
        result.errors.push(
          `Reacción ${p.emoji}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    if (Object.keys(map).length === 0) {
      await msg.delete().catch(() => null);
      continue;
    }

    panelMessages.push({
      channelId: channel.id,
      messageId: msg.id,
      map,
    });
    result.messageUrls.push(msg.url);
    result.messages++;
    result.roles += Object.keys(map).length;
  }

  if (panelMessages.length === 0) {
    result.errors.push("No se creó ningún mensaje del panel.");
    return result;
  }

  const cfg: ColorPanelConfig = {
    guildId: guild.id,
    exclusive: true,
    messages: panelMessages,
    updatedAt: new Date().toISOString(),
  };
  try {
    await saveColorPanelConfig(cfg);
  } catch (e) {
    result.errors.push(
      `Guardar panel: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  result.ok = true;
  return result;
}

function reactionEmojiKey(reaction: MessageReaction | PartialMessageReaction): string {
  if (reaction.emoji.id) {
    // custom emoji — not used for our unicode palette, but support
    return reaction.emoji.id;
  }
  return reaction.emoji.name ?? "";
}

async function applyColorRole(
  guild: Guild,
  userId: string,
  roleId: string,
  allColorRoleIds: string[],
  exclusive: boolean,
  add: boolean,
): Promise<void> {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member || member.user.bot) return;

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return;

  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role || role.managed) return;
  if (role.position >= me.roles.highest.position) return;

  try {
    if (add) {
      if (exclusive) {
        const toRemove = allColorRoleIds.filter(
          (id) => id !== roleId && member.roles.cache.has(id),
        );
        if (toRemove.length) {
          await member.roles.remove(toRemove, "Zero Two · cambio de color");
        }
      }
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId, "Zero Two · panel de colores");
      }
    } else if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId, "Zero Two · quitar color");
    }
  } catch (err) {
    logger.debug(
      { err, guildId: guild.id, userId, roleId, add },
      "color role reaction apply failed",
    );
  }
}

async function onReaction(
  client: Client,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  add: boolean,
): Promise<void> {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (user.partial) await user.fetch();
  } catch {
    return;
  }

  const msgId = reaction.message.id;
  let meta = messageIndex.get(msgId);

  if (!meta) {
    // Lazy load from DB if message belongs to a guild we know
    const guildId = reaction.message.guildId;
    if (!guildId) return;
    const cfg = await getColorPanelConfig(guildId);
    meta = messageIndex.get(msgId);
    if (!meta && cfg) {
      // not our message
      return;
    }
    if (!meta) return;
  }

  const emoji = reactionEmojiKey(reaction);
  const roleId = meta.map[emoji];
  if (!roleId) return;

  const guild =
    reaction.message.guild ??
    (await client.guilds.fetch(meta.guildId).catch(() => null));
  if (!guild) return;

  const allRoleIds = Object.values(meta.map);
  // include role ids from sibling panel messages (exclusive across pages)
  const cfg = await getColorPanelConfig(meta.guildId);
  const allColorIds = cfg
    ? cfg.messages.flatMap((m) => Object.values(m.map))
    : allRoleIds;

  await applyColorRole(
    guild,
    user.id,
    roleId,
    allColorIds,
    meta.exclusive,
    add,
  );
}

/** Wire reaction listeners once */
export function registerColorRoleReactions(client: Client): void {
  client.on("messageReactionAdd", (reaction, user) => {
    void onReaction(client, reaction, user, true);
  });
  client.on("messageReactionRemove", (reaction, user) => {
    void onReaction(client, reaction, user, false);
  });
  logger.info("🎨 Panel de colores por reacción registrado");
}

/** Warm index for all guilds (optional, call after ready) */
export async function warmColorPanelIndex(client: Client): Promise<void> {
  for (const g of client.guilds.cache.values()) {
    await getColorPanelConfig(g.id).catch(() => null);
  }
}
