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
  findAuditExecutor,
  getGuildLogSettings,
  sendModLog,
  truncate,
  userField,
} from "../lib/modlog.js";
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

export function registerServerLogs(client: Client) {
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

  // ── MESSAGE DELETE ─────────────────────────────────────────────────────────
  client.on("messageDelete", async (message: Message | PartialMessage) => {
    try {
      if (message.partial) {
        try {
          await message.fetch();
        } catch {
          /* uncached */
        }
      }
      if (!message.guild) return;

      const settings = await getGuildLogSettings(message.guild.id);
      if (message.author?.bot && settings.ignoreBots) return;
      if (message.webhookId && settings.ignoreWebhooks) return;

      let deletedBy = null as null | { id: string; tag?: string; username?: string; bot?: boolean };
      try {
        await new Promise((r) => setTimeout(r, 600));
        const logs = await message.guild.fetchAuditLogs({
          type: AuditLogEvent.MessageDelete,
          limit: 5,
        });
        const now = Date.now();
        const entry = logs.entries.find((e) => {
          if (now - e.createdTimestamp > 6_000) return false;
          const extra = e.extra as { channel?: { id?: string } } | undefined;
          return (
            extra?.channel?.id === message.channelId ||
            e.targetId === message.channelId
          );
        });
        if (
          entry?.executor &&
          message.author &&
          entry.executor.id !== message.author.id
        ) {
          deletedBy = entry.executor;
        }
      } catch {
        /* no audit */
      }

      const content =
        message.content && message.content.length > 0
          ? truncate(message.content, 1000)
          : message.attachments.size > 0
            ? `*(sin texto · ${message.attachments.size} adjunto(s))*`
            : "*(contenido no disponible en caché)*";

      const embed = baseLogEmbed(
        client,
        "🗑️ Mensaje eliminado",
        COLORS.delete,
      )
        .setThumbnail(safeAvatar(message.author ?? undefined))
        .addFields(
          {
            name: "👤 Autor",
            value: message.author ? userField(message.author) : "`Desconocido`",
            inline: false,
          },
          {
            name: "📍 Canal",
            value: message.channelId ? `<#${message.channelId}>` : "`?`",
            inline: true,
          },
          {
            name: "🆔 Mensaje",
            value: message.id ? `\`${message.id}\`` : "`?`",
            inline: true,
          },
          {
            name: "📄 Contenido",
            value: content.startsWith("(") ? content : `>>> ${content}`,
            inline: false,
          },
        );

      if (deletedBy) {
        embed.addFields({
          name: "🛡️ Eliminado por",
          value: userField(deletedBy),
          inline: false,
        });
      }

      if (settings.includeAttachments && message.attachments.size > 0) {
        const files = [...message.attachments.values()]
          .map((a) => `[${a.name}](${a.proxyURL || a.url})`)
          .join("\n");
        embed.addFields({
          name: "📎 Adjuntos",
          value: truncate(files, 500),
          inline: false,
        });
      }

      await sendModLog(client, message.guild.id, embed, {
        event: "message_delete",
        actorIsBot: Boolean(message.author?.bot),
        actorIsWebhook: Boolean(message.webhookId),
        channelId: message.channelId,
      });
    } catch (err) {
      logger.error({ err }, "serverLogs:messageDelete");
    }
  });

  // ── BULK DELETE ────────────────────────────────────────────────────────────
  client.on("messageDeleteBulk", async (messages, channel) => {
    try {
      const guild = "guild" in channel ? channel.guild : null;
      if (!guild) return;
      const embed = baseLogEmbed(
        client,
        "🧹 Borrado masivo de mensajes",
        COLORS.bulk,
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
      );
      await sendModLog(client, guild.id, embed, {
        event: "message_bulk_delete",
        channelId: channel.id,
      });
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
        if (oldMessage.partial) {
          try {
            await oldMessage.fetch();
          } catch {
            /* */
          }
        }
        if (newMessage.partial) {
          try {
            await newMessage.fetch();
          } catch {
            /* */
          }
        }
        if (!newMessage.guild) return;
        if (newMessage.author?.bot) return;

        const before = oldMessage.content ?? "";
        const after = newMessage.content ?? "";
        if (before === after) return;

        const embed = baseLogEmbed(client, "✏️ Mensaje editado", COLORS.edit)
          .setThumbnail(safeAvatar(newMessage.author ?? undefined))
          .addFields(
            {
              name: "👤 Autor",
              value: newMessage.author
                ? userField(newMessage.author)
                : "`Desconocido`",
              inline: false,
            },
            {
              name: "📍 Canal",
              value: newMessage.channelId
                ? `<#${newMessage.channelId}>`
                : "`?`",
              inline: true,
            },
            {
              name: "🔗 Ir al mensaje",
              value: newMessage.url ? `[Abrir](${newMessage.url})` : "`—`",
              inline: true,
            },
            {
              name: "📄 Antes",
              value: before
                ? `>>> ${truncate(before, 900)}`
                : "*(vacío / no en caché)*",
              inline: false,
            },
            {
              name: "📄 Después",
              value: after ? `>>> ${truncate(after, 900)}` : "*(vacío)*",
              inline: false,
            },
          );

        await sendModLog(client, newMessage.guild.id, embed, {
          event: "message_edit",
          actorIsBot: Boolean(newMessage.author?.bot),
          channelId: newMessage.channelId,
        });
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
          const embed = baseLogEmbed(client, "⏳ Timeout aplicado", COLORS.timeout)
            .setThumbnail(safeAvatar(newMember.user))
            .addFields(
              {
                name: "👤 Usuario",
                value: userField(newMember.user),
                inline: false,
              },
              {
                name: "⏱️ Hasta",
                value: `<t:${Math.floor(newT / 1000)}:F> (<t:${Math.floor(newT / 1000)}:R>)`,
                inline: false,
              },
            );
          await sendModLog(client, guild.id, embed, {
            event: "timeout",
            actorIsBot: newMember.user.bot,
          });
        } else if (oldT > now && (!newT || newT <= now)) {
          const embed = baseLogEmbed(
            client,
            "✅ Timeout removido",
            COLORS.untimeout,
          )
            .setThumbnail(safeAvatar(newMember.user))
            .addFields({
              name: "👤 Usuario",
              value: userField(newMember.user),
              inline: false,
            });
          await sendModLog(client, guild.id, embed, {
            event: "untimeout",
            actorIsBot: newMember.user.bot,
          });
        }

        // Nickname
        if (oldMember.nickname !== newMember.nickname) {
          const embed = baseLogEmbed(client, "🏷️ Apodo actualizado", COLORS.nick)
            .setThumbnail(safeAvatar(newMember.user))
            .addFields(
              {
                name: "👤 Usuario",
                value: userField(newMember.user),
                inline: false,
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
          const added = [...newIds].filter((id) => !oldIds.has(id) && id !== guild.id);
          const removed = [...oldIds].filter(
            (id) => !newIds.has(id) && id !== guild.id,
          );
          if (added.length || removed.length) {
            const embed = baseLogEmbed(
              client,
              "🎭 Roles actualizados",
              COLORS.roles,
            )
              .setThumbnail(safeAvatar(newMember.user))
              .addFields({
                name: "👤 Usuario",
                value: userField(newMember.user),
                inline: false,
              });
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
