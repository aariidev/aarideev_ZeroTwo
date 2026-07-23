/**
 * Sistema de roles por nivel de economía.
 *
 * Los servidores configuran umbrales de saldo → roleId en la tabla
 * bot_config con clave `economy_level_roles:<guildId>`.
 *
 * Formato JSON almacenado:
 *   [{ threshold: 1000, roleId: "123456789" }, …]
 *   (ordenado de mayor a menor threshold)
 *
 * Lógica: se asigna el rol del umbral más alto que el usuario supera,
 * y se retiran los demás roles de nivel que ya no correspondan.
 */
import { type Guild, type GuildMember } from "discord.js";
import { db, botConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export type LevelRoleEntry = {
  /** Saldo mínimo para obtener el rol */
  threshold: number;
  roleId: string;
};

const CONFIG_KEY = (guildId: string) => `economy_level_roles:${guildId}`;

// ── Persistencia ──────────────────────────────────────────────────────────────

export async function getLevelRoles(guildId: string): Promise<LevelRoleEntry[]> {
  try {
    const rows = await db
      .select()
      .from(botConfigTable)
      .where(eq(botConfigTable.key, CONFIG_KEY(guildId)))
      .limit(1);

    if (!rows[0]?.value) return [];
    const parsed = JSON.parse(rows[0].value) as LevelRoleEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => typeof e.threshold === "number" && typeof e.roleId === "string")
      .sort((a, b) => b.threshold - a.threshold); // mayor primero
  } catch {
    return [];
  }
}

export async function setLevelRoles(
  guildId: string,
  entries: LevelRoleEntry[],
): Promise<void> {
  const sorted = [...entries]
    .filter((e) => e.threshold >= 0 && e.roleId)
    .sort((a, b) => b.threshold - a.threshold);

  const value = JSON.stringify(sorted);

  await db
    .insert(botConfigTable)
    .values({ key: CONFIG_KEY(guildId), value })
    .onDuplicateKeyUpdate({ set: { value } });
}

// ── Asignación automática ─────────────────────────────────────────────────────

/**
 * Comprueba si `member` alcanza un nuevo umbral con `balance` y asigna /
 * retira roles en consecuencia. Silencioso si no hay roles configurados.
 */
export async function checkAndAssignLevelRoles(
  guild: Guild,
  member: GuildMember,
  balance: number,
): Promise<void> {
  const entries = await getLevelRoles(guild.id);
  if (entries.length === 0) return;

  const me = guild.members.me;
  if (!me) return;

  // Todos los roleIds configurados para este servidor
  const allLevelRoleIds = new Set(entries.map((e) => e.roleId));

  // Rol que corresponde al saldo actual (umbral más alto superado)
  const earnedEntry = entries.find((e) => balance >= e.threshold) ?? null;

  const toAdd: string[] = [];
  const toRemove: string[] = [];

  for (const roleId of allLevelRoleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;

    // Comprobar que el bot tiene posición superior al rol
    if (me.roles.highest.position <= role.position) continue;

    const hasCurrent = member.roles.cache.has(roleId);
    const shouldHave = earnedEntry?.roleId === roleId;

    if (shouldHave && !hasCurrent) toAdd.push(roleId);
    if (!shouldHave && hasCurrent) toRemove.push(roleId);
  }

  if (toAdd.length === 0 && toRemove.length === 0) return;

  try {
    if (toAdd.length > 0) {
      await member.roles.add(toAdd, `Zero Two: nivel de economía (${balance} fichas)`);
    }
    if (toRemove.length > 0) {
      await member.roles.remove(
        toRemove,
        `Zero Two: nivel de economía actualizado (${balance} fichas)`,
      );
    }
    logger.info(
      { guildId: guild.id, userId: member.id, balance, toAdd, toRemove },
      "economy:levelRoles updated",
    );
  } catch (err) {
    logger.warn(
      { err, guildId: guild.id, userId: member.id },
      "economy:levelRoles assign failed",
    );
  }
}
