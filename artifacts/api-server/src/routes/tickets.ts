import { Router, type Request, type Response } from "express";
import {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type Client,
  type TextChannel,
} from "discord.js";
import { db, ticketsTable, guildTicketSettingsTable } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  defaultTicketConfig,
  getTicketConfig,
  setTicketConfig,
  closeTicketRecord,
  resolveCategories,
  type GuildTicketConfig,
} from "../bot/lib/tickets.js";
import {
  assertGuildManage,
  dataScopeGuildIds,
  resolveGuildAccess,
} from "../lib/guildAccess.js";
import { logger } from "../lib/logger.js";
import {
  validateBody,
  PatchTicketConfigBody,
  PostTicketPanelBody,
  PostTicketCloseBody,
} from "../middleware/validate.js";
import { buildTranscriptHtml } from "../bot/lib/transcriptHtml.js";

const router = Router();
let botClient: Client | null = null;

export function setBotClientForTickets(client: Client) {
  botClient = client;
}

// ── GET /tickets ─────────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const access = await resolveGuildAccess(req, botClient);
    const scope = dataScopeGuildIds(access);
    if (scope.size === 0) {
      return res.status(200).json([]);
    }

    const status = typeof req.query.status === "string" ? req.query.status : null;
    const guildId =
      typeof req.query.guildId === "string" ? req.query.guildId : null;
    const limit = Math.min(
      200,
      Math.max(1, Number(req.query.limit) || 100),
    );

    const conditions = [];
    if (status && status !== "all") {
      if (status === "active") {
        conditions.push(inArray(ticketsTable.status, ["open", "claimed"]));
      } else {
        conditions.push(eq(ticketsTable.status, status));
      }
    }
    if (guildId) {
      if (!scope.has(guildId)) {
        return res.status(200).json([]);
      }
      conditions.push(eq(ticketsTable.guildId, guildId));
    } else {
      conditions.push(inArray(ticketsTable.guildId, [...scope]));
    }

    let q = db
      .select()
      .from(ticketsTable)
      .orderBy(desc(ticketsTable.createdAt))
      .limit(limit)
      .$dynamic();

    if (conditions.length) {
      q = q.where(and(...conditions));
    }

    const rows = await q;
    const guildNames = new Map<string, string>();
    if (botClient) {
      for (const id of scope) {
        const g = botClient.guilds.cache.get(id);
        if (g) guildNames.set(g.id, g.name);
      }
    }

    res.status(200).json(
      rows.map((t) => ({
        ...t,
        guildName: guildNames.get(t.guildId) ?? null,
        createdAt: t.createdAt?.toISOString?.() ?? t.createdAt,
        closedAt: t.closedAt
          ? (t.closedAt as Date).toISOString?.() ?? t.closedAt
          : null,
      })),
    );
  } catch (err) {
    req.log?.error({ err }, "GET /tickets failed");
    res.status(500).json({ error: "Internal server error" });
  }
  return undefined;
});

// ── GET /tickets/stats ───────────────────────────────────────────────────────
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const access = await resolveGuildAccess(req, botClient);
    const scope = dataScopeGuildIds(access);
    if (scope.size === 0) {
      return res.status(200).json({
        open: 0,
        claimed: 0,
        closed: 0,
        active: 0,
        total: 0,
      });
    }

    const rows = await db
      .select({
        status: ticketsTable.status,
        guildId: ticketsTable.guildId,
      })
      .from(ticketsTable)
      .where(inArray(ticketsTable.guildId, [...scope]));

    const byStatus: Record<string, number> = {
      open: 0,
      claimed: 0,
      closed: 0,
    };
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }
    const open = byStatus.open ?? 0;
    const claimed = byStatus.claimed ?? 0;
    const closed = byStatus.closed ?? 0;

    res.status(200).json({
      open,
      claimed,
      closed,
      active: open + claimed,
      total: open + claimed + closed,
    });
  } catch (err) {
    req.log?.error({ err }, "GET /tickets/stats failed");
    res.status(500).json({ error: "Internal server error" });
  }
  return undefined;
});

// ── GET /tickets/guilds ──────────────────────────────────────────────────────
// Only guilds the user can manage (staff), not every bot guild.
router.get("/guilds", async (req: Request, res: Response) => {
  try {
    if (!botClient) {
      return res.status(200).json([]);
    }

    const access = await resolveGuildAccess(req, botClient);
    const scope = dataScopeGuildIds(access);
    if (scope.size === 0) {
      return res.status(200).json([]);
    }

    const botGuilds = [...scope]
      .map((id) => botClient!.guilds.cache.get(id))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));
    const guildIds = botGuilds.map((g) => g.id);

    const settingsRows =
      guildIds.length > 0
        ? await db
            .select()
            .from(guildTicketSettingsTable)
            .where(inArray(guildTicketSettingsTable.guildId, guildIds))
        : [];
    const settingsByGuild = new Map(
      settingsRows.map((r) => [r.guildId, r] as const),
    );

    const activeRows =
      guildIds.length > 0
        ? await db
            .select({
              guildId: ticketsTable.guildId,
              status: ticketsTable.status,
            })
            .from(ticketsTable)
            .where(
              and(
                inArray(ticketsTable.guildId, guildIds),
                inArray(ticketsTable.status, ["open", "claimed"]),
              ),
            )
        : [];
    const activeByGuild = new Map<string, number>();
    for (const r of activeRows) {
      activeByGuild.set(r.guildId, (activeByGuild.get(r.guildId) ?? 0) + 1);
    }

    const list = await Promise.all(botGuilds.map(async (guild) => {
      const row = settingsByGuild.get(guild.id);
      const cfg = row ? await getTicketConfig(guild.id) : defaultTicketConfig();

      return {
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL({ size: 64 }),
        memberCount: guild.memberCount,
        configured: Boolean(cfg.categoryId && cfg.staffRoleIds.length),
        config: cfg,
        activeTickets: activeByGuild.get(guild.id) ?? 0,
        canManage: access.manageGuildIds.has(guild.id),
      };
    }));

    list.sort((a, b) => a.name.localeCompare(b.name));
    res.status(200).json(list);
  } catch (err) {
    req.log?.error({ err }, "GET /tickets/guilds failed");
    res.status(500).json({ error: "Internal server error" });
  }
  return undefined;
});

// ── GET /tickets/guilds/:id/config ───────────────────────────────────────────
router.get("/guilds/:id/config", async (req: Request, res: Response) => {
  try {
    const guildId = String(req.params.id);
    if (!botClient) {
      return res.status(503).json({ error: "Bot offline" });
    }
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Bot no está en ese servidor" });
    }

    const access = await resolveGuildAccess(req, botClient);
    const gate = assertGuildManage(access, guildId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const config = await getTicketConfig(guildId);

    // Cap list sizes so huge guilds don't blow up Dev Tunnel responses
    const categories = guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildCategory)
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 150);

    const textChannels = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText ||
          c.type === ChannelType.GuildAnnouncement,
      )
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 250);

    const roles = guild.roles.cache
      .filter((r) => r.id !== guild.id && !r.managed)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
      }))
      .sort((a, b) => b.position - a.position)
      .slice(0, 200);

    res.status(200).json({
      guildId,
      name: guild.name,
      iconUrl: guild.iconURL({ size: 128 }),
      config,
      categories,
      textChannels,
      roles,
    });
  } catch (err) {
    req.log?.error({ err }, "GET ticket config failed");
    res.status(500).json({ error: "Internal server error" });
  }
  return undefined;
});

// ── PATCH /tickets/guilds/:id/config ─────────────────────────────────────────
router.patch("/guilds/:id/config", validateBody(PatchTicketConfigBody), async (req: Request, res: Response) => {
  try {
    const guildId = String(req.params.id);
    if (!botClient) {
      return res.status(503).json({ error: "Bot offline" });
    }
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Bot no está en ese servidor" });
    }

    const access = await resolveGuildAccess(req, botClient);
    const gate = assertGuildManage(access, guildId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const body = (req.body ?? {}) as Partial<GuildTicketConfig>;
    const patch: Partial<GuildTicketConfig> = {};

    if ("categoryId" in body) {
      const id = body.categoryId;
      if (id === null || id === "" || id === "none") {
        patch.categoryId = null;
      } else if (typeof id === "string") {
        const ch = guild.channels.cache.get(id);
        if (!ch || ch.type !== ChannelType.GuildCategory) {
          return res.status(400).json({ error: "Categoría inválida" });
        }
        patch.categoryId = id;
      }
    }

    if ("staffRoleId" in body) {
      const id = body.staffRoleId;
      if (id === null || id === "" || id === "none") {
        patch.staffRoleId = null;
        patch.staffRoleIds = [];
      } else if (typeof id === "string") {
        if (!guild.roles.cache.has(id)) {
          return res.status(400).json({ error: "Rol staff inválido" });
        }
        patch.staffRoleId = id;
      }
    }

    if (Array.isArray(body.staffRoleIds)) {
      const roleIds = [...new Set(body.staffRoleIds)]
        .filter((id): id is string => typeof id === "string" && guild.roles.cache.has(id))
        .slice(0, 25);
      patch.staffRoleIds = roleIds;
      patch.staffRoleId = roleIds[0] ?? patch.staffRoleId ?? null;
    }

    if ("logChannelId" in body) {
      const id = body.logChannelId;
      if (id === null || id === "" || id === "none") {
        patch.logChannelId = null;
      } else if (typeof id === "string") {
        const ch = guild.channels.cache.get(id);
        if (
          !ch ||
          (ch.type !== ChannelType.GuildText &&
            ch.type !== ChannelType.GuildAnnouncement)
        ) {
          return res.status(400).json({ error: "Canal de logs inválido" });
        }
        patch.logChannelId = id;
      }
    }

    if (typeof body.maxOpen === "number") {
      patch.maxOpen = Math.min(5, Math.max(1, Math.floor(body.maxOpen)));
    }
    if (typeof body.deleteAfterCloseSec === "number") {
      patch.deleteAfterCloseSec = Math.min(
        300,
        Math.max(0, Math.floor(body.deleteAfterCloseSec)),
      );
    }
    if (typeof body.panelTitle === "string" && body.panelTitle.trim()) {
      patch.panelTitle = body.panelTitle.trim().slice(0, 100);
    }
    if (typeof body.panelDescription === "string" && body.panelDescription.trim()) {
      patch.panelDescription = body.panelDescription.trim().slice(0, 2000);
    }
    if (["both", "staff_only", "owner_only"].includes(String(body.closePolicy))) {
      patch.closePolicy = body.closePolicy as GuildTicketConfig["closePolicy"];
    }
    if (["staff_only", "anyone"].includes(String(body.claimPolicy))) {
      patch.claimPolicy = body.claimPolicy as GuildTicketConfig["claimPolicy"];
    }
    if (typeof body.channelNameFormat === "string" && body.channelNameFormat.trim()) {
      patch.channelNameFormat = body.channelNameFormat.trim().slice(0, 80);
    }
    if (typeof body.welcomeMessage === "string") {
      patch.welcomeMessage = body.welcomeMessage.trim().slice(0, 500);
    }
    if (Array.isArray(body.categories)) {
      patch.categories = body.categories
        .filter((cat) =>
          cat &&
          typeof cat.id === "string" &&
          /^[a-z0-9_-]{1,32}$/.test(cat.id) &&
          typeof cat.label === "string" &&
          cat.label.trim(),
        )
        .map((cat) => ({
          id: cat.id.trim().toLowerCase(),
          label: cat.label.trim().slice(0, 50),
          emoji: typeof cat.emoji === "string" && cat.emoji.trim() ? cat.emoji.trim().slice(0, 10) : "🎫",
          description: typeof cat.description === "string" && cat.description.trim()
            ? cat.description.trim().slice(0, 100)
            : cat.label.trim().slice(0, 50),
          staffRoleIds: Array.isArray(cat.staffRoleIds)
            ? [...new Set(cat.staffRoleIds)].filter((id): id is string => typeof id === "string" && guild.roles.cache.has(id)).slice(0, 10)
            : [],
        }))
        .slice(0, 25);
    }

    const config = await setTicketConfig(guildId, patch);
    res.status(200).json({ ok: true, config });
  } catch (err) {
    req.log?.error({ err }, "PATCH ticket config failed");
    res.status(500).json({ error: "Internal server error" });
  }
  return undefined;
});

// ── POST /tickets/guilds/:id/panel ───────────────────────────────────────────
router.post("/guilds/:id/panel", validateBody(PostTicketPanelBody), async (req: Request, res: Response) => {
  try {
    const guildId = String(req.params.id);
    if (!botClient) {
      return res.status(503).json({ error: "Bot offline" });
    }
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: "Bot no está en ese servidor" });
    }

    const access = await resolveGuildAccess(req, botClient);
    const gate = assertGuildManage(access, guildId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const cfg = await getTicketConfig(guildId);
    if (!cfg.categoryId || !cfg.staffRoleIds.length) {
      return res.status(400).json({
        error: "Configura categoría y rol staff antes de publicar el panel.",
      });
    }

    const channelId =
      typeof req.body?.channelId === "string" ? req.body.channelId : null;
    if (!channelId) {
      return res.status(400).json({ error: "channelId requerido" });
    }

    const ch = guild.channels.cache.get(channelId);
    if (
      !ch ||
      (ch.type !== ChannelType.GuildText &&
        ch.type !== ChannelType.GuildAnnouncement)
    ) {
      return res.status(400).json({ error: "Canal inválido" });
    }

    const botIcon = botClient.user?.displayAvatarURL();
    const cats = resolveCategories(cfg);
    const embed = new EmbedBuilder()
      .setColor(0xff2d6b)
      .setAuthor({
        name: "Central de Tickets // Zero Two",
        iconURL: botIcon,
      })
      .setTitle(cfg.panelTitle)
      .setDescription(cfg.panelDescription)
      .addFields(
        {
          name: "📋 Categorías",
          value: cats.map((cat) => `${cat.emoji} **${cat.label}** — ${cat.description}`).join("\n"),
        },
        {
          name: "⏱️ Respuesta",
          value: "El staff te atenderá lo antes posible en un canal privado.",
        },
      )
      .setFooter({
        text: "Zero Two · Sistema de Tickets",
        iconURL: botIcon,
      })
      .setTimestamp();

    const select = new StringSelectMenuBuilder()
      .setCustomId("ticket_open")
      .setPlaceholder("Selecciona una categoría…")
      .addOptions(cats.map((cat) => ({
        label: cat.label,
        description: cat.description,
        value: cat.id,
        emoji: cat.emoji,
      })));

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      select,
    );

    await (ch as TextChannel).send({ embeds: [embed], components: [row] });

    res.status(200).json({ ok: true, channelId });
  } catch (err) {
    logger.error({ err }, "POST ticket panel failed");
    res.status(500).json({ error: "No se pudo publicar el panel" });
  }
  return undefined;
});

// ── POST /tickets/:id/close ──────────────────────────────────────────────────
router.post("/:id/close", validateBody(PostTicketCloseBody), async (req: Request, res: Response) => {
  try {
    const id = Number(String(req.params.id));
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const rows = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, id))
      .limit(1);
    const ticket = rows[0];
    if (!ticket) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }
    if (ticket.status === "closed") {
      return res.status(400).json({ error: "Ya está cerrado" });
    }

    const access = await resolveGuildAccess(req, botClient);
    const gate = assertGuildManage(access, ticket.guildId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const reason =
      typeof req.body?.reason === "string" ? req.body.reason : "Cerrado desde dashboard";
    const closer =
      req.sessionUser?.username ??
      req.sessionUser?.id ??
      "dashboard";

    await closeTicketRecord(
      ticket.channelId,
      req.sessionUser?.id ?? "dashboard",
      closer,
      reason,
    );

    // Try delete channel if bot online
    if (botClient) {
      const ch = botClient.channels.cache.get(ticket.channelId);
      if (ch && "isTextBased" in ch && ch.isTextBased() && !ch.isDMBased()) {
        try {
          const transcript = await buildTranscriptHtml(ch as TextChannel, {
            id: ticket.id,
            username: ticket.username,
            userId: ticket.userId,
            category: ticket.category,
            openedAt: ticket.createdAt,
            closedAt: new Date(),
            closedBy: closer,
            guildName:
              botClient?.guilds.cache.get(ticket.guildId)?.name ?? null,
            reason,
          });
          const cfg = await getTicketConfig(ticket.guildId);
          if (cfg.logChannelId) {
            const logCh = botClient.channels.cache.get(cfg.logChannelId);
            if (logCh?.isTextBased()) {
              await (logCh as TextChannel)
                .send({
                  embeds: [
                    new EmbedBuilder()
                      .setColor(0xff2d6b)
                      .setTitle("📄 Ticket cerrado (dashboard)")
                      .addFields(
                        {
                          name: "Usuario",
                          value: `<@${ticket.userId}>`,
                          inline: true,
                        },
                        {
                          name: "Cerrado por",
                          value: closer,
                          inline: true,
                        },
                        { name: "Motivo", value: reason },
                      )
                      .setTimestamp(),
                  ],
                  files: [
                    {
                      attachment: Buffer.from(transcript, "utf8"),
                      name: `ticket-${ticket.id}.html`,
                    },
                  ],
                })
                .catch(() => null);
            }
          }
          await ch
            .send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xff2d6b)
                  .setTitle("🔒 Ticket cerrado desde el dashboard")
                  .setDescription(`Cerrado por **${closer}**.\n${reason}`)
                  .setTimestamp(),
              ],
            })
            .catch(() => null);

          if (cfg.deleteAfterCloseSec > 0 && "delete" in ch) {
            setTimeout(() => {
              (ch as TextChannel)
                .delete(`Ticket cerrado desde dashboard por ${closer}`)
                .catch(() => null);
            }, cfg.deleteAfterCloseSec * 1000);
          }
        } catch (e) {
          logger.warn({ err: e }, "ticket close channel ops");
        }
      }
    }

    res.status(200).json({ ok: true, id });
  } catch (err) {
    req.log?.error({ err }, "POST close ticket failed");
    res.status(500).json({ error: "Internal server error" });
  }
  return undefined;
});

export default router;
