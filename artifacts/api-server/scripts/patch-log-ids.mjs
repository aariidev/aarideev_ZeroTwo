/**
 * Inject guildId/targetId into baseLogEmbed option objects in serverLogs.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "bot",
  "events",
  "serverLogs.ts",
);

let src = fs.readFileSync(file, "utf8");

/**
 * For each baseLogEmbed( ... { ... } ) block, if it has guildName: X.guild.name
 * and no guildId yet, inject guildId: X.guild.id
 * Also inject targetId from common variable patterns when possible.
 */

// Inject after guildIcon line when guildIcon: FOO.guild.iconURL
// Pattern: guildName: VAR.guild.name,
//          guildIcon: VAR.guild.iconURL({ size: 64 }),
src = src.replace(
  /guildName:\s*([\w.]+)\.guild\.name,\s*\n(\s*)guildIcon:\s*\1\.guild\.iconURL\(\{\s*size:\s*64\s*\}\),/g,
  (m, obj, indent) => {
    if (m.includes("guildId:")) return m;
    return (
      `guildName: ${obj}.guild.name,\n` +
      `${indent}guildIcon: ${obj}.guild.iconURL({ size: 64 }),\n` +
      `${indent}guildId: ${obj}.guild.id,`
    );
  },
);

// guildName: guild.name without intermediate object
src = src.replace(
  /guildName:\s*guild\.name,\s*\n(\s*)guildIcon:\s*guild\.iconURL\(\{\s*size:\s*64\s*\}\),/g,
  (m, indent) => {
    if (m.includes("guildId:")) return m;
    return (
      `guildName: guild.name,\n` +
      `${indent}guildIcon: guild.iconURL({ size: 64 }),\n` +
      `${indent}guildId: guild.id,`
    );
  },
);

// member.guild
src = src.replace(
  /guildName:\s*member\.guild\.name,\s*\n(\s*)guildIcon:\s*member\.guild\.iconURL\(\{\s*size:\s*64\s*\}\),/g,
  (m, indent) => {
    if (m.includes("guildId:")) return m;
    return (
      `guildName: member.guild.name,\n` +
      `${indent}guildIcon: member.guild.iconURL({ size: 64 }),\n` +
      `${indent}guildId: member.guild.id,`
    );
  },
);

// newMessage.guild / message.guild
for (const pref of ["newMessage", "message", "oldMessage", "msg"]) {
  const re = new RegExp(
    `guildName:\\s*${pref}\\.guild\\.name,\\s*\\n(\\s*)guildIcon:\\s*${pref}\\.guild\\.iconURL\\(\\{\\s*size:\\s*64\\s*\\}\\),`,
    "g",
  );
  src = src.replace(re, (m, indent) => {
    if (m.includes("guildId:")) return m;
    return (
      `guildName: ${pref}.guild.name,\n` +
      `${indent}guildIcon: ${pref}.guild.iconURL({ size: 64 }),\n` +
      `${indent}guildId: ${pref}.guild.id,`
    );
  });
}

// invite.guild
src = src.replace(
  /guildName:\s*invite\.guild\.name,\s*\n(\s*)guildIcon:\s*invite\.guild\.iconURL\(\{\s*size:\s*64\s*\}\),/g,
  (m, indent) => {
    if (m.includes("guildId:")) return m;
    return (
      `guildName: invite.guild.name,\n` +
      `${indent}guildIcon: invite.guild.iconURL({ size: 64 }),\n` +
      `${indent}guildId: invite.guild.id,`
    );
  },
);

// role.guild
src = src.replace(
  /guildName:\s*role\.guild\.name,\s*\n(\s*)guildIcon:\s*role\.guild\.iconURL\(\{\s*size:\s*64\s*\}\),/g,
  (m, indent) => {
    if (m.includes("guildId:")) return m;
    return (
      `guildName: role.guild.name,\n` +
      `${indent}guildIcon: role.guild.iconURL({ size: 64 }),\n` +
      `${indent}guildId: role.guild.id,`
    );
  },
);

// ch.guild already covered by first pattern with ch

// Inject targetId for known event blocks — after guildId line when event is known
const targetByEvent = {
  channel_create: "ch.id",
  channel_delete: "ch.id",
  channel_update: "newCh.id",
  role_create: "role.id",
  role_delete: "role.id",
  role_update: "newRole.id",
  member_join: "member.id",
  member_leave: "member.id",
  member_roles: "newMember.id",
  member_nickname: "newMember.id",
  member_boost: "newMember.id",
  message_delete: "message.id",
  message_edit: "newMessage.id",
  message_bulk_delete: undefined,
  ban: "user.id",
  unban: "user.id",
  kick: "member.id",
  timeout: "newMember.id",
  untimeout: "newMember.id",
  invite_create: "invite.code",
  invite_delete: "invite.code",
  voice_join: "newState.member?.id ?? newState.id",
  voice_leave: "oldState.member?.id ?? oldState.id",
  voice_move: "newState.member?.id ?? newState.id",
  thread_create: "thread.id",
  thread_delete: "thread.id",
  emoji_create: "emoji.id ?? emoji.name",
  emoji_delete: "emoji.id ?? emoji.name",
};

// For each event: "xxx", ... guildId: something,
// add targetId if missing
for (const [event, targetExpr] of Object.entries(targetByEvent)) {
  if (!targetExpr) continue;
  const re = new RegExp(
    `(event:\\s*"${event}",[\\s\\S]*?guildId:\\s*[^,\\n]+,)(?!\\s*\\n\\s*targetId:)`,
    "g",
  );
  src = src.replace(re, (m) => {
    if (m.includes("targetId:")) return m;
    // only within a reasonable size (one baseLogEmbed opts)
    if (m.length > 600) return m;
    return `${m}\n        targetId: ${targetExpr},`;
  });
}

fs.writeFileSync(file, src);
console.log("Patched", file);
// count guildId and targetId
const g = (src.match(/guildId:/g) || []).length;
const t = (src.match(/targetId:/g) || []).length;
console.log({ guildId: g, targetId: t });
