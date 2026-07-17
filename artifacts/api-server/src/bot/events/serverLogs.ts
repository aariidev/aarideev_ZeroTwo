import {
  AuditLogEvent,
  ChannelType,
  Client,
  GuildChannel,
  GuildMember,
  Invite,
  Message,
  PartialGuildMember,
  PartialMessage,
  Role,
  VoiceState,
  type NonThreadGuildBasedChannel,
} from "discord.js";
import {
  baseLogEmbed,
  codeBlock,
  findAuditExecutor,
  findBulkDeleteActor,
  findMessageDeleteActor,
  getGuildLogSettings,
  messageJumpLink,
  quoteBlock,
  sendModLog,
  truncate,
  userField,
} from "../lib/modlog.js";
import {
  deleteMessageSnapshot,
  deleteMessageSnapshots,
  getMessageSnapshots,
  indexMessage,
  resolveMessageData,
  startMessageStoreMaintenance,
  type StoredMessage,
} from "../lib/messageStore.js";
import { logBotEvent } from "../../lib/botLogger.js";
import { logger } from "../../lib/logger.js";

const COLORS = {
  ban: 0xff2d6b,
  unban: 0x22c55e,
  kick: 0xef4444,
  timeout: 0xf97316,
  untimeout: 0x84cc16,
  delete: 0xf59e0b,
  edit: 0x3b82f6,
  bulk: 0xdc2626,
  join: 0x00f5d4,
  leave: 0x94a3b8,
  roles: 0xa78bfa,
  nick: 0x38bdf8,
  channel: 0x2dd4bf,
  role: 0xc084fc,
  invite: 0xfbbf24,
  voice: 0x22d3ee,
};

function safeAvatar(user: { displayAvatarURL?: (o?: object) => string } | null | undefined) {
  try {
    return user?.displayAvatarURL?.({ size: 128 }) ?? null;
  } catch {
    return null;
  }
}

function channelLabel(ch: { id: string; name?: string | null }) {
  return ch.name ? `#${ch.name} (\`${ch.id}\`)` : `<#${ch.id}>`;
}

function persistServerLog(opts: {
  event: string;
  guildId: string;
  guildName?: string | null;
  userId?: string | null;
  username?: string | null;
  moderatorId?: string | null;
  moderatorName?: string | null;
  details?: Record<string, unknown>;
  level?: "info" | "warn" | "error";
}) {
  logBotEvent({
    level: opts.level ?? "info",
    event: opts.event as Parameters<typeof logBotEvent>[0]["event"],
    guildId: opts.guildId,
    guildName: opts.guildName,
    userId: opts.userId,
    username: opts.username,
    moderatorId: opts.moderatorId,
    moderatorName: opts.moderatorName,
    details: opts.details,
  });
}

function formatAttachments(snap: StoredMessage): string | null {
  if (!snap.attachments?.length) return null;
  return snap.attachments
    .slice(0, 8)
    .map((a) => {
      const size =
        typeof a.size === "number" ? ` · ${(a.size / 1024).toFixed(1)} KB` : "";
      const link = a.proxyUrl || a.url;
      return `• [${a.name}](${link})${size}`;
    })
    .join("\n");
}

export function registerServerLogs(client: Client) {
  startMessageStoreMaintenance();

  // ── INDEX messages into MySQL (source of truth for delete/edit logs) ───────
  client.on("messageCreate", (message) => {
    if (!message.guildId || message.system) return;
    void indexMessage(message);
  });

  // ── BAN ────────────────────────────────────────────────────────────────────
  client.on("guildBanAdd", async (ban) => {
    try {
      const { guild, user, reason } = ban;
      const audit = await findAuditExecutor(
        guild,
        AuditLogEvent.MemberBanAdd,
        user.id,
      );
      const embed = baseLogEmbed(client, "🔨 Miembro baneado", COLORS.ban)
        .setThumbnail(safeAvatar(user))
        .addFields(
          { name: "👤 Usuario", value: userField(user), inline: false },
          {
            name: "🛡️ Moderador",
            value: audit.executor ? userField(audit.executor) : "`Desconocido`",
            inline: true,
          },
          {
            name: "📝 Motivo",
            value: truncate(audit.reason ?? reason ?? "Sin motivo"),
            inline: false,
          },
        );
      await sendModLog(client, guild.id, embed, {
        event: "ban",
        actorIsBot: user.bot,
      });
    } catch (err) {
      logger.error({ err }, "serverLogs:guildBanAdd");
    }
  });

  // ── UNBAN ──────────────────────────────────────────────────────────────────
  client.on("guildBanRemove", async (ban) => {
    try {
      const { guild, user } = ban;
      const audit = await findAuditExecutor(
        guild,
        AuditLogEvent.MemberBanRemove,
        user.id,
      );
      const embed = baseLogEmbed(client, "✅ Miembro desbaneado", COLORS.unban)
        .setThumbnail(safeAvatar(user))
        .addFields(
          { name: "👤 Usuario", value: userField(user), inline: false },
          {
            name: "🛡️ Moderador",
            value: audit.executor ? userField(audit.executor) : "`Desconocido`",
            inline: true,
          },
          {
            name: "📝 Motivo",
            value: truncate(audit.reason ?? "Sin motivo"),
            inline: false,
          },
        );
      await sendModLog(client, guild.id, embed, {
        event: "unban",
        actorIsBot: user.bot,
      });
    } catch (err) {
      logger.error({ err }, "serverLogs:guildBanRemove");
    }
  });

  // ── MESSAGE DELETE (contenido desde MySQL, no solo caché Discord) ──────────
  client.on("messageDelete", async (message: Message | PartialMessage) => {
    try {
      if (message.partial) {
        try {
          await message.fetch();
        } catch {
          /* uncached — usaremos BD */
        }
      }

      const data = await resolveMessageData(message, message.id);
      const guild =
        message.guild ??
        (data?.guildId ? client.guilds.cache.get(data.guildId) : null);
      if (!guild) return;

      const channelId = message.channelId ?? data?.channelId;
      if (!channelId || !message.id) return;

      const settings = await getGuildLogSettings(guild.id);
      if (data?.authorBot && settings.ignoreBots) return;
      if (data?.webhookId && settings.ignoreWebhooks) return;
      if (settings.ignoreChannels?.includes(channelId)) return;

      const actor = await findMessageDeleteActor(guild, {
        authorId: data?.authorId ?? message.author?.id ?? null,
        channelId,
        isBotAuthor: Boolean(data?.authorBot || message.author?.bot),
      });

      const hasText = Boolean(data?.content && data.content.length > 0);
      const content = hasText
        ? quoteBlock(data!.content, 950)
        : data?.attachments?.length
          ? `*(sin texto · ${data.attachments.length} adjunto(s))*`
          : data?.embedCount
            ? `*(${data.embedCount} embed(s))*`
            : "*(sin contenido en BD ni caché — mensaje anterior a la indexación)*";

      const createdTs = data?.messageCreatedAt
        ? Math.floor(data.messageCreatedAt.getTime() / 1000)
        : message.createdTimestamp
          ? Math.floor(message.createdTimestamp / 1000)
          : null;
      const created = createdTs
        ? `<t:${createdTs}:f> · <t:${createdTs}:R>`
        : "`—`";

      const authorField = data
        ? `<@${data.authorId}>\n\`${data.authorTag}\` · \`${data.authorId}\`${data.authorBot ? " · 🤖" : ""}`
        : message.author
          ? userField(message.author)
          : "`Desconocido`";

      const source = data
        ? data.content || data.attachments.length
          ? "MySQL `message_snapshots`"
          : "BD (vacío) + gateway"
        : "solo gateway (no indexado)";

      const embed = baseLogEmbed(client, "🗑️ Mensaje eliminado", COLORS.delete, {
        description: `${actor.label}\n📦 Fuente de datos: **${source}**`,
        guildName: guild.name,
      }).addFields(
        {
          name: "👤 Autor del mensaje",
          value: authorField,
          inline: true,
        },
        {
          name: "🛡️ Quién lo borró",
          value: actor.executor
            ? userField(actor.executor)
            : actor.kind === "self" && data
              ? `<@${data.authorId}>\n\`${data.authorTag}\``
              : "`No detectado`",
          inline: true,
        },
        {
          name: "📍 Canal",
          value: `<#${channelId}>`,
          inline: true,
        },
        {
          name: "🆔 IDs",
          value:
            `Msg \`${message.id}\`\n` +
            `Canal \`${channelId}\`` +
            (data ? `\nAutor \`${data.authorId}\`` : "") +
            (actor.executor ? `\nEjecutor \`${actor.executor.id}\`` : ""),
          inline: true,
        },
        {
          name: "📅 Mensaje original",
          value: created,
          inline: true,
        },
        {
          name: "🔎 Tipo de borrado",
          value:
            actor.kind === "mod"
              ? "`Moderador`"
              : actor.kind === "self"
                ? "`Auto-borrado`"
                : actor.kind === "bot"
                  ? "`Bot / automod`"
                  : "`Desconocido`",
          inline: true,
        },
        {
          name: "📄 Contenido",
          value: content,
          inline: false,
        },
      );

      if (actor.reason) {
        embed.addFields({
          name: "📝 Motivo (audit log)",
          value: codeBlock(actor.reason, 400),
          inline: false,
        });
      }

      if (settings.includeAttachments && data?.attachments?.length) {
        const files = formatAttachments(data);
        if (files) {
          embed.addFields({
            name: `📎 Adjuntos (${data.attachments.length})`,
            value: truncate(files, 900),
            inline: false,
          });
        }
        const firstImg = data.attachments.find((a) =>
          a.contentType?.startsWith("image/"),
        );
        if (firstImg) {
          embed.setImage(firstImg.proxyUrl || firstImg.url);
        }
      }

      if (data?.stickers?.length) {
        embed.addFields({
          name: "🏷️ Stickers",
          value: data.stickers.map((s) => `\`${s}\``).join(", "),
          inline: false,
        });
      }

      // Thumbnail: try author avatar from live message
      if (message.author) {
        embed.setThumbnail(safeAvatar(message.author));
      }

      await sendModLog(client, guild.id, embed, {
        event: "message_delete",
        actorIsBot: Boolean(data?.authorBot || message.author?.bot),
        actorIsWebhook: Boolean(data?.webhookId || message.webhookId),
        channelId,
      });

      persistServerLog({
        event: "message_delete",
        guildId: guild.id,
        guildName: guild.name,
        userId: data?.authorId ?? message.author?.id,
        username: data?.authorTag ?? message.author?.username,
        moderatorId: actor.executor?.id,
        moderatorName: actor.executor?.username,
        details: {
          messageId: message.id,
          channelId,
          deleteKind: actor.kind,
          contentPreview: (data?.content ?? "").slice(0, 200),
          fromDatabase: Boolean(data),
          attachmentCount: data?.attachments?.length ?? 0,
        },
      });

      // Keep DB clean after logging
      await deleteMessageSnapshot(message.id);
    } catch (err) {
      logger.error({ err }, "serverLogs:messageDelete");
    }
  });

  // ── BULK DELETE ────────────────────────────────────────────────────────────
  client.on("messageDeleteBulk", async (messages, channel) => {
    try {
      const guild = "guild" in channel ? channel.guild : null;
      if (!guild) return;

      const ids = [...messages.keys()];
      const snaps = await getMessageSnapshots(ids);
      const actor = await findBulkDeleteActor(guild, channel.id, messages.size);

      const samples: string[] = [];
      // Prefer DB snapshots, then live cache
      for (const id of ids) {
        if (samples.length >= 10) break;
        const snap = snaps.get(id);
        const m = messages.get(id);
        const author =
          snap?.authorTag ??
          m?.author?.tag ??
          m?.author?.username ??
          snap?.authorId ??
          "?";
        const snip = snap?.content
          ? truncate(snap.content.replace(/\n/g, " "), 80)
          : m?.content
            ? truncate(m.content.replace(/\n/g, " "), 80)
            : snap?.attachments?.length
              ? `(${snap.attachments.length} adj.)`
              : "(vacío)";
        samples.push(`• \`${author}\`: ${snip}`);
      }

      const fromDb = snaps.size;
      const embed = baseLogEmbed(
        client,
        "🧹 Borrado masivo de mensajes",
        COLORS.bulk,
        {
          description: `${actor.label}\n📦 Reconstruidos desde BD: **${fromDb}/${messages.size}**`,
          guildName: guild.name,
        },
      ).addFields(
        {
          name: "📍 Canal",
          value: `<#${channel.id}>`,
          inline: true,
        },
        {
          name: "📊 Cantidad",
          value: `\`${messages.size}\` mensajes`,
          inline: true,
        },
        {
          name: "🛡️ Ejecutado por",
          value: actor.executor
            ? userField(actor.executor)
            : "`No detectado en audit log`",
          inline: false,
        },
      );

      if (actor.reason) {
        embed.addFields({
          name: "📝 Motivo",
          value: codeBlock(actor.reason, 300),
          inline: false,
        });
      }
      if (samples.length) {
        embed.addFields({
          name: "📋 Muestra (BD + caché)",
          value: truncate(samples.join("\n"), 900),
          inline: false,
        });
      }

      await sendModLog(client, guild.id, embed, {
        event: "message_bulk_delete",
        channelId: channel.id,
      });

      persistServerLog({
        event: "message_bulk_delete",
        guildId: guild.id,
        guildName: guild.name,
        moderatorId: actor.executor?.id,
        moderatorName: actor.executor?.username,
        details: {
          channelId: channel.id,
          count: messages.size,
          recoveredFromDb: fromDb,
        },
      });

      await deleteMessageSnapshots(ids);
    } catch (err) {
      logger.error({ err }, "serverLogs:messageDeleteBulk");
    }
  });

  // ── MESSAGE EDIT ───────────────────────────────────────────────────────────
  client.on(
    "messageUpdate",
    async (
      oldMessage: Message | PartialMessage,
      newMessage: Message | PartialMessage,
    ) => {
      try {
        if (newMessage.partial) {
          try {
            await newMessage.fetch();
          } catch {
            /* */
          }
        }
        if (!newMessage.guild || !newMessage.channelId || !newMessage.id) return;

        // Before content: live old → DB snapshot → empty
        const beforeSnap = await getMessageSnapshots([newMessage.id]);
        const dbBefore = beforeSnap.get(newMessage.id);

        const settings = await getGuildLogSettings(newMessage.guild.id);
        if (newMessage.author?.bot && settings.ignoreBots) return;
        if (
          (dbBefore?.authorBot || newMessage.author?.bot) &&
          settings.ignoreBots
        )
          return;
        if (settings.ignoreChannels?.includes(newMessage.channelId)) return;

        const before =
          oldMessage.content ??
          dbBefore?.content ??
          "";
        const after = newMessage.content ?? "";
        if (before === after) {
          // Still re-index embeds/attachments updates
          void indexMessage(newMessage);
          return;
        }

        const jump = messageJumpLink(
          newMessage.guild.id,
          newMessage.channelId,
          newMessage.id,
        );

        const authorVal = newMessage.author
          ? userField(newMessage.author)
          : dbBefore
            ? `<@${dbBefore.authorId}>\n\`${dbBefore.authorTag}\``
            : "`Desconocido`";

        const embed = baseLogEmbed(client, "✏️ Mensaje editado", COLORS.edit, {
          description:
            "Cambio de contenido detectado. El **antes** se lee de BD si el caché no lo tenía.",
          guildName: newMessage.guild.name,
        })
          .setThumbnail(safeAvatar(newMessage.author ?? undefined))
          .addFields(
            {
              name: "👤 Autor",
              value: authorVal,
              inline: true,
            },
            {
              name: "📍 Canal",
              value: `<#${newMessage.channelId}>`,
              inline: true,
            },
            {
              name: "🔗 Enlace",
              value: `[Ir al mensaje](${jump})`,
              inline: true,
            },
            {
              name: "📄 Antes",
              value: before
                ? quoteBlock(before, 900)
                : "*(vacío / no indexado aún)*",
              inline: false,
            },
            {
              name: "📄 Después",
              value: after ? quoteBlock(after, 900) : "*(vacío)*",
              inline: false,
            },
            {
              name: "📦 Fuente «antes»",
              value: oldMessage.content != null
                ? "`Caché Discord`"
                : dbBefore
                  ? "`MySQL message_snapshots`"
                  : "`No disponible`",
              inline: true,
            },
          );

        await sendModLog(client, newMessage.guild.id, embed, {
          event: "message_edit",
          actorIsBot: Boolean(newMessage.author?.bot || dbBefore?.authorBot),
          channelId: newMessage.channelId,
        });

        persistServerLog({
          event: "message_edit",
          guildId: newMessage.guild.id,
          guildName: newMessage.guild.name,
          userId: newMessage.author?.id ?? dbBefore?.authorId,
          username: newMessage.author?.username ?? dbBefore?.authorTag,
          details: {
            messageId: newMessage.id,
            channelId: newMessage.channelId,
            beforePreview: before.slice(0, 150),
            afterPreview: after.slice(0, 150),
          },
        });

        // Update snapshot with new content
        void indexMessage(newMessage);
      } catch (err) {
        logger.error({ err }, "serverLogs:messageUpdate");
      }
    },
  );

  // ── MEMBER JOIN ────────────────────────────────────────────────────────────
  client.on("guildMemberAdd", async (member: GuildMember) => {
    try {
      const settings = await getGuildLogSettings(member.guild.id);
      const accountAge = member.user.createdAt;
      const ageDays = Math.floor(
        (Date.now() - accountAge.getTime()) / (1000 * 60 * 60 * 24),
      );

      const embed = baseLogEmbed(client, "📥 Entrada al servidor", COLORS.join)
        .setThumbnail(safeAvatar(member.user))
        .addFields(
          { name: "👤 Usuario", value: userField(member.user), inline: false },
          {
            name: "📅 Cuenta creada",
            value: `<t:${Math.floor(accountAge.getTime() / 1000)}:R> (${ageDays}d)`,
            inline: true,
          },
          {
            name: "👥 Miembros",
            value: `\`${member.guild.memberCount}\``,
            inline: true,
          },
        );

      if (settings.joinAlertDays > 0 && ageDays < settings.joinAlertDays) {
        embed.addFields({
          name: "⚠️ Alerta",
          value: `Cuenta muy reciente (< ${settings.joinAlertDays} días)`,
          inline: false,
        });
      }

      await sendModLog(client, member.guild.id, embed, {
        event: "member_join",
        actorIsBot: member.user.bot,
      });
    } catch (err) {
      logger.error({ err }, "serverLogs:guildMemberAdd");
    }
  });

  // ── MEMBER LEAVE / KICK ────────────────────────────────────────────────────
  client.on(
    "guildMemberRemove",
    async (member: GuildMember | PartialGuildMember) => {
      try {
        const guild = member.guild;
        const user = member.user;
        const kickAudit = await findAuditExecutor(
          guild,
          AuditLogEvent.MemberKick,
          user?.id,
          6_000,
        );
        const isKick = Boolean(kickAudit.entry && kickAudit.executor && user?.id);

        const embed = baseLogEmbed(
          client,
          isKick ? "👢 Miembro expulsado (kick)" : "📤 Salida del servidor",
          isKick ? COLORS.kick : COLORS.leave,
        )
          .setThumbnail(safeAvatar(user ?? undefined))
          .addFields(
            {
              name: "👤 Usuario",
              value: user ? userField(user) : "`Desconocido`",
              inline: false,
            },
            {
              name: "👥 Miembros",
              value: `\`${guild.memberCount}\``,
              inline: true,
            },
          );

        if (isKick && kickAudit.executor) {
          embed.addFields(
            {
              name: "🛡️ Moderador",
              value: userField(kickAudit.executor),
              inline: true,
            },
            {
              name: "📝 Motivo",
              value: truncate(kickAudit.reason ?? "Sin motivo"),
              inline: false,
            },
          );
        } else if (member.joinedAt) {
          embed.addFields({
            name: "⏱️ Estuvo desde",
            value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`,
            inline: true,
          });
        }

        if ("roles" in member && member.roles) {
          const roles = member.roles.cache
            .filter((r) => r.id !== guild.id)
            .map((r) => `<@&${r.id}>`)
            .slice(0, 12);
          if (roles.length) {
            embed.addFields({
              name: "🎭 Roles",
              value: truncate(roles.join(" "), 500),
              inline: false,
            });
          }
        }

        await sendModLog(client, guild.id, embed, {
          event: isKick ? "kick" : "member_leave",
          actorIsBot: Boolean(user?.bot),
        });
      } catch (err) {
        logger.error({ err }, "serverLogs:guildMemberRemove");
      }
    },
  );

  // ── MEMBER UPDATE (timeout / roles / nick) ─────────────────────────────────
  client.on(
    "guildMemberUpdate",
    async (
      oldMember: GuildMember | PartialGuildMember,
      newMember: GuildMember,
    ) => {
      try {
        const guild = newMember.guild;

        // Timeout
        const oldT = oldMember.communicationDisabledUntilTimestamp ?? 0;
        const newT = newMember.communicationDisabledUntilTimestamp ?? 0;
        const now = Date.now();
        if (newT > now && newT !== oldT) {
          const audit = await findAuditExecutor(
            guild,
            AuditLogEvent.MemberUpdate,
            newMember.id,
            12_000,
          );
          const embed = baseLogEmbed(
            client,
            "⏳ Timeout aplicado",
            COLORS.timeout,
            {
              description: "Un miembro fue aislado temporalmente.",
              guildName: guild.name,
            },
          )
            .setThumbnail(safeAvatar(newMember.user))
            .addFields(
              {
                name: "👤 Usuario",
                value: userField(newMember.user),
                inline: true,
              },
              {
                name: "🛡️ Moderador",
                value: audit.executor
                  ? userField(audit.executor)
                  : "`Desconocido`",
                inline: true,
              },
              {
                name: "⏱️ Hasta",
                value: `<t:${Math.floor(newT / 1000)}:F>\n<t:${Math.floor(newT / 1000)}:R>`,
                inline: false,
              },
            );
          if (audit.reason) {
            embed.addFields({
              name: "📝 Motivo",
              value: codeBlock(audit.reason, 400),
              inline: false,
            });
          }
          await sendModLog(client, guild.id, embed, {
            event: "timeout",
            actorIsBot: newMember.user.bot,
          });
        } else if (oldT > now && (!newT || newT <= now)) {
          const audit = await findAuditExecutor(
            guild,
            AuditLogEvent.MemberUpdate,
            newMember.id,
            12_000,
          );
          const embed = baseLogEmbed(
            client,
            "✅ Timeout removido",
            COLORS.untimeout,
            { guildName: guild.name },
          )
            .setThumbnail(safeAvatar(newMember.user))
            .addFields(
              {
                name: "👤 Usuario",
                value: userField(newMember.user),
                inline: true,
              },
              {
                name: "🛡️ Por",
                value: audit.executor
                  ? userField(audit.executor)
                  : "`Desconocido / expiró`",
                inline: true,
              },
            );
          await sendModLog(client, guild.id, embed, {
            event: "untimeout",
            actorIsBot: newMember.user.bot,
          });
        }

        // Nickname
        if (oldMember.nickname !== newMember.nickname) {
          const audit = await findAuditExecutor(
            guild,
            AuditLogEvent.MemberUpdate,
            newMember.id,
            10_000,
          );
          const embed = baseLogEmbed(
            client,
            "🏷️ Apodo actualizado",
            COLORS.nick,
            { guildName: guild.name },
          )
            .setThumbnail(safeAvatar(newMember.user))
            .addFields(
              {
                name: "👤 Usuario",
                value: userField(newMember.user),
                inline: true,
              },
              {
                name: "🛡️ Cambiado por",
                value: audit.executor
                  ? userField(audit.executor)
                  : "`Desconocido / auto`",
                inline: true,
              },
              {
                name: "Antes",
                value: oldMember.nickname
                  ? `\`${oldMember.nickname}\``
                  : "`(ninguno)`",
                inline: true,
              },
              {
                name: "Después",
                value: newMember.nickname
                  ? `\`${newMember.nickname}\``
                  : "`(ninguno)`",
                inline: true,
              },
            );
          await sendModLog(client, guild.id, embed, {
            event: "member_nickname",
            actorIsBot: newMember.user.bot,
          });
        }

        // Roles
        if ("roles" in oldMember && oldMember.roles) {
          const oldIds = new Set(oldMember.roles.cache.keys());
          const newIds = new Set(newMember.roles.cache.keys());
          const added = [...newIds].filter(
            (id) => !oldIds.has(id) && id !== guild.id,
          );
          const removed = [...oldIds].filter(
            (id) => !newIds.has(id) && id !== guild.id,
          );
          if (added.length || removed.length) {
            const audit = await findAuditExecutor(
              guild,
              AuditLogEvent.MemberRoleUpdate,
              newMember.id,
              10_000,
            );
            const embed = baseLogEmbed(
              client,
              "🎭 Roles actualizados",
              COLORS.roles,
              { guildName: guild.name },
            )
              .setThumbnail(safeAvatar(newMember.user))
              .addFields(
                {
                  name: "👤 Usuario",
                  value: userField(newMember.user),
                  inline: true,
                },
                {
                  name: "🛡️ Por",
                  value: audit.executor
                    ? userField(audit.executor)
                    : "`Desconocido`",
                  inline: true,
                },
              );
            if (added.length) {
              embed.addFields({
                name: "➕ Añadidos",
                value: truncate(added.map((id) => `<@&${id}>`).join(" "), 500),
                inline: false,
              });
            }
            if (removed.length) {
              embed.addFields({
                name: "➖ Quitados",
                value: truncate(
                  removed.map((id) => `<@&${id}>`).join(" "),
                  500,
                ),
                inline: false,
              });
            }
            await sendModLog(client, guild.id, embed, {
              event: "member_roles",
              actorIsBot: newMember.user.bot,
            });
          }
        }
      } catch (err) {
        logger.error({ err }, "serverLogs:guildMemberUpdate");
      }
    },
  );

  // ── CHANNEL CREATE / DELETE ────────────────────────────────────────────────
  client.on("channelCreate", async (channel) => {
    try {
      if (!("guild" in channel) || !channel.guild) return;
      const ch = channel as GuildChannel;
      const embed = baseLogEmbed(client, "📁 Canal creado", COLORS.channel).addFields(
        {
          name: "Canal",
          value: channelLabel(ch),
          inline: true,
        },
        {
          name: "Tipo",
          value: `\`${ChannelType[ch.type] ?? ch.type}\``,
          inline: true,
        },
      );
      await sendModLog(client, ch.guild.id, embed, { event: "channel_create" });
    } catch (err) {
      logger.error({ err }, "serverLogs:channelCreate");
    }
  });

  client.on("channelDelete", async (channel) => {
    try {
      if (!("guild" in channel) || !channel.guild) return;
      const ch = channel as NonThreadGuildBasedChannel;
      const embed = baseLogEmbed(
        client,
        "🗑️ Canal eliminado",
        COLORS.channel,
      ).addFields(
        {
          name: "Canal",
          value: channelLabel(ch),
          inline: true,
        },
        {
          name: "Tipo",
          value: `\`${ChannelType[ch.type] ?? ch.type}\``,
          inline: true,
        },
      );
      await sendModLog(client, ch.guild.id, embed, { event: "channel_delete" });
    } catch (err) {
      logger.error({ err }, "serverLogs:channelDelete");
    }
  });

  // ── ROLE CREATE / DELETE ───────────────────────────────────────────────────
  client.on("roleCreate", async (role: Role) => {
    try {
      const embed = baseLogEmbed(client, "🏷️ Rol creado", COLORS.role).addFields(
        {
          name: "Rol",
          value: `${role} (\`${role.name}\` · \`${role.id}\`)`,
          inline: false,
        },
        {
          name: "Color",
          value: `\`${role.hexColor}\``,
          inline: true,
        },
      );
      await sendModLog(client, role.guild.id, embed, { event: "role_create" });
    } catch (err) {
      logger.error({ err }, "serverLogs:roleCreate");
    }
  });

  client.on("roleDelete", async (role: Role) => {
    try {
      const embed = baseLogEmbed(client, "🗑️ Rol eliminado", COLORS.role).addFields(
        {
          name: "Rol",
          value: `\`${role.name}\` · \`${role.id}\``,
          inline: false,
        },
      );
      await sendModLog(client, role.guild.id, embed, { event: "role_delete" });
    } catch (err) {
      logger.error({ err }, "serverLogs:roleDelete");
    }
  });

  // ── INVITES ────────────────────────────────────────────────────────────────
  client.on("inviteCreate", async (invite: Invite) => {
    try {
      if (!invite.guild) return;
      const embed = baseLogEmbed(
        client,
        "🔗 Invitación creada",
        COLORS.invite,
      ).addFields(
        {
          name: "Código",
          value: `[\`${invite.code}\`](https://discord.gg/${invite.code})`,
          inline: true,
        },
        {
          name: "Canal",
          value: invite.channelId ? `<#${invite.channelId}>` : "`?`",
          inline: true,
        },
        {
          name: "Creador",
          value: invite.inviter ? userField(invite.inviter) : "`Desconocido`",
          inline: false,
        },
        {
          name: "Máx. usos",
          value: invite.maxUses ? `\`${invite.maxUses}\`` : "`∞`",
          inline: true,
        },
      );
      await sendModLog(client, invite.guild.id, embed, {
        event: "invite_create",
        actorIsBot: Boolean(invite.inviter?.bot),
      });
    } catch (err) {
      logger.error({ err }, "serverLogs:inviteCreate");
    }
  });

  client.on("inviteDelete", async (invite: Invite) => {
    try {
      if (!invite.guild) return;
      const embed = baseLogEmbed(
        client,
        "🔗 Invitación eliminada",
        COLORS.invite,
      ).addFields({
        name: "Código",
        value: `\`${invite.code}\``,
        inline: true,
      });
      await sendModLog(client, invite.guild.id, embed, {
        event: "invite_delete",
      });
    } catch (err) {
      logger.error({ err }, "serverLogs:inviteDelete");
    }
  });

  // ── VOICE ──────────────────────────────────────────────────────────────────
  client.on(
    "voiceStateUpdate",
    async (oldState: VoiceState, newState: VoiceState) => {
      try {
        const guild = newState.guild ?? oldState.guild;
        if (!guild) return;
        const member = newState.member ?? oldState.member;
        if (!member) return;

        const oldCh = oldState.channelId;
        const newCh = newState.channelId;
        if (oldCh === newCh) return;

        if (!oldCh && newCh) {
          const embed = baseLogEmbed(client, "🎙️ Entrada a voz", COLORS.voice)
            .setThumbnail(safeAvatar(member.user))
            .addFields(
              {
                name: "👤 Usuario",
                value: userField(member.user),
                inline: false,
              },
              {
                name: "Canal",
                value: `<#${newCh}>`,
                inline: true,
              },
            );
          await sendModLog(client, guild.id, embed, {
            event: "voice_join",
            actorIsBot: member.user.bot,
          });
        } else if (oldCh && !newCh) {
          const embed = baseLogEmbed(client, "🎙️ Salida de voz", COLORS.voice)
            .setThumbnail(safeAvatar(member.user))
            .addFields(
              {
                name: "👤 Usuario",
                value: userField(member.user),
                inline: false,
              },
              {
                name: "Canal",
                value: `<#${oldCh}>`,
                inline: true,
              },
            );
          await sendModLog(client, guild.id, embed, {
            event: "voice_leave",
            actorIsBot: member.user.bot,
          });
        } else if (oldCh && newCh) {
          const embed = baseLogEmbed(
            client,
            "🎙️ Movimiento de voz",
            COLORS.voice,
          )
            .setThumbnail(safeAvatar(member.user))
            .addFields(
              {
                name: "👤 Usuario",
                value: userField(member.user),
                inline: false,
              },
              {
                name: "De",
                value: `<#${oldCh}>`,
                inline: true,
              },
              {
                name: "A",
                value: `<#${newCh}>`,
                inline: true,
              },
            );
          await sendModLog(client, guild.id, embed, {
            event: "voice_move",
            actorIsBot: member.user.bot,
          });
        }
      } catch (err) {
        logger.error({ err }, "serverLogs:voiceStateUpdate");
      }
    },
  );

  logger.info(
    "📡 Logs de servidor ampliados: mod · mensajes · miembros · canales · roles · invites · voz",
  );
}
