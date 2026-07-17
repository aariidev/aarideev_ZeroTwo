import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  AttachmentBuilder,
  version as djsVersion,
} from "discord.js";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "../../types.js";
import { BOT_VERSION } from "../../lib/version.js";
import { helpAssetsDir } from "../../lib/helpAssets.js";
import { pool } from "@workspace/db";

const PINK = 0xff2d6b;
const IMAGE_NAME = "info02.jpg";
const COLLECTOR_MS = 5 * 60 * 1000;

const SECTIONS = [
  {
    id: "overview",
    label: "General",
    emoji: "🤖",
    description: "Estado, versión y desarrollador",
  },
  {
    id: "system",
    label: "Sistema",
    emoji: "💻",
    description: "CPU, RAM, Node y plataforma",
  },
  {
    id: "network",
    label: "Red y alcance",
    emoji: "🌐",
    description: "Latencia, servidores y usuarios",
  },
  {
    id: "database",
    label: "Base de datos",
    emoji: "💾",
    description: "MySQL / HeidiSQL (zerotwo)",
  },
  {
    id: "links",
    label: "Enlaces",
    emoji: "🔗",
    description: "Dashboard, soporte e invitación",
  },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    units.length - 1,
  );
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

function resolveInfoImage(): { file: AttachmentBuilder | null; url: string | null } {
  const candidates = [
    path.join(helpAssetsDir(), IMAGE_NAME),
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../../assets/help",
      IMAGE_NAME,
    ),
    path.resolve(process.cwd(), "assets/help", IMAGE_NAME),
    path.resolve(process.cwd(), "../../assets/help", IMAGE_NAME),
  ];
  for (const full of candidates) {
    if (fs.existsSync(full)) {
      return {
        file: new AttachmentBuilder(full, { name: IMAGE_NAME }),
        url: `attachment://${IMAGE_NAME}`,
      };
    }
  }
  return { file: null, url: null };
}

async function getMysqlStatus(): Promise<string> {
  try {
    const t0 = Date.now();
    const conn = await pool.getConnection();
    try {
      await conn.ping();
      const [rows] = (await conn.query("SELECT DATABASE() AS db")) as [
        Array<{ db: string | null }>,
        unknown,
      ];
      const dbName = rows[0]?.db ?? "—";
      const ms = Date.now() - t0;
      return `🟢 Online · \`${dbName}\` · \`${ms}ms\``;
    } finally {
      conn.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 80) : "error";
    return `🔴 Offline · \`${msg}\``;
  }
}

function sampleCpuUsage(): Promise<string> {
  return new Promise((resolve) => {
    const start = cpuSnapshot();
    setTimeout(() => {
      const end = cpuSnapshot();
      const idle = end.idle - start.idle;
      const total = end.total - start.total;
      if (total <= 0) return resolve("—");
      const usage = (100 - (100 * idle) / total).toFixed(1);
      resolve(`${usage}%`);
    }, 120);
  });
}

function cpuSnapshot() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  const n = os.cpus().length || 1;
  return { idle: idle / n, total: total / n };
}

function ownerLine(): string {
  const ids = (process.env.OWNER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return process.env.DEVELOPER_NAME ?? "_.aari._";
  return ids.map((id) => `<@${id}>`).join(" · ");
}

function buildMenu(userId: string, selected: SectionId) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`zerotwoinf_menu:${userId}`)
      .setPlaceholder("📂 Elige una sección de información…")
      .addOptions(
        SECTIONS.map((s) => ({
          label: s.label,
          value: s.id,
          emoji: s.emoji,
          description: s.description,
          default: s.id === selected,
        })),
      ),
  );
}

async function buildSectionEmbed(
  section: SectionId,
  client: Client,
  imageUrl: string | null,
): Promise<EmbedBuilder> {
  const bot = client.user!;
  const ready = client.ws.status === 0;
  const now = Math.floor(Date.now() / 1000);
  const heap = process.memoryUsage().heapUsed;
  const rss = process.memoryUsage().rss;
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  const base = new EmbedBuilder()
    .setColor(PINK)
    .setAuthor({
      name: "Zero Two · Núcleo de Información",
      iconURL: bot.displayAvatarURL({ size: 128 }),
    })
    .setThumbnail(bot.displayAvatarURL({ size: 256 }))
    .setTimestamp()
    .setFooter({
      text: `Zero Two ${BOT_VERSION} · Solo tú puedes usar el menú`,
      iconURL: bot.displayAvatarURL({ size: 64 }),
    });

  if (imageUrl) base.setImage(imageUrl);

  if (section === "overview") {
    base
      .setTitle("🤖 Información general")
      .setDescription(
        "Panel en vivo del bot. Usa el **menú** de abajo para cambiar de sección.",
      )
      .addFields(
        {
          name: "📡 Estado",
          value: ready ? "🟢 Online" : "🔴 Desconectado",
          inline: true,
        },
        {
          name: "📅 Versión",
          value: `\`${BOT_VERSION}\``,
          inline: true,
        },
        {
          name: "👨‍💻 Desarrollador",
          value: ownerLine(),
          inline: true,
        },
        {
          name: "🕒 Uptime del proceso",
          value: `\`${formatUptime(process.uptime())}\``,
          inline: true,
        },
        {
          name: "⏳ Actualizado",
          value: `<t:${now}:R>`,
          inline: true,
        },
        {
          name: "🆔 Client ID",
          value: `\`${bot.id}\``,
          inline: true,
        },
        {
          name: "📛 Tag",
          value: `\`${bot.tag}\``,
          inline: true,
        },
        {
          name: "📚 Comandos cargados",
          value: `\`${(client as { commands?: { size: number } }).commands?.size ?? "—"}\``,
          inline: true,
        },
        {
          name: "🧩 Shards",
          value: `\`${client.ws.shards.size}\``,
          inline: true,
        },
      );
  }

  if (section === "system") {
    const cpu = await sampleCpuUsage();
    base
      .setTitle("💻 Sistema y runtime")
      .addFields(
        {
          name: "🟢 Node.js",
          value: `\`${process.version}\``,
          inline: true,
        },
        {
          name: "💫 Discord.js",
          value: `\`v${djsVersion}\``,
          inline: true,
        },
        {
          name: "🖥️ Plataforma",
          value: `\`${process.platform} (${process.arch})\``,
          inline: true,
        },
        {
          name: "🧠 Heap (Node)",
          value: `\`${formatBytes(heap)}\``,
          inline: true,
        },
        {
          name: "📦 RSS",
          value: `\`${formatBytes(rss)}\``,
          inline: true,
        },
        {
          name: "🧮 RAM sistema",
          value: `\`${formatBytes(totalMem - freeMem)} / ${formatBytes(totalMem)}\``,
          inline: true,
        },
        {
          name: "⚙️ CPU (muestra)",
          value: `\`${cpu}\``,
          inline: true,
        },
        {
          name: "🧵 CPUs lógicas",
          value: `\`${os.cpus().length}\``,
          inline: true,
        },
        {
          name: "⏳ Uptime del host",
          value: `\`${formatUptime(os.uptime())}\``,
          inline: true,
        },
      );
  }

  if (section === "network") {
    const guilds = client.guilds.cache.size;
    let members = 0;
    for (const g of client.guilds.cache.values()) members += g.memberCount ?? 0;
    const channels = client.channels.cache.size;
    const ping = client.ws.ping;

    base
      .setTitle("🌐 Red y alcance")
      .addFields(
        {
          name: "📶 Latencia WebSocket",
          value: ping >= 0 ? `\`${ping} ms\`` : "`calculando…`",
          inline: true,
        },
        {
          name: "🏠 Servidores",
          value: `\`${guilds.toLocaleString()}\``,
          inline: true,
        },
        {
          name: "👥 Miembros (suma)",
          value: `\`${members.toLocaleString()}\``,
          inline: true,
        },
        {
          name: "📡 Canales (caché)",
          value: `\`${channels.toLocaleString()}\``,
          inline: true,
        },
        {
          name: "👤 Usuarios (caché)",
          value: `\`${client.users.cache.size.toLocaleString()}\``,
          inline: true,
        },
        {
          name: "🎭 Emojis (caché)",
          value: `\`${client.emojis.cache.size.toLocaleString()}\``,
          inline: true,
        },
      );
  }

  if (section === "database") {
    const status = await getMysqlStatus();
    const url = process.env.DATABASE_URL ?? "";
    const dialect = url.startsWith("mysql")
      ? "MySQL / MariaDB"
      : url.startsWith("postgres")
        ? "PostgreSQL"
        : "—";
    let hostHint = "local";
    try {
      const u = new URL(url);
      hostHint = `${u.hostname}${u.port ? `:${u.port}` : ""}`;
    } catch {
      /* ignore */
    }

    base
      .setTitle("💾 Base de datos")
      .setDescription(
        "Persistencia de warns, tickets, economía, logs y configs de guild.",
      )
      .addFields(
        { name: "🔌 Estado", value: status, inline: false },
        { name: "🧬 Motor", value: `\`${dialect}\``, inline: true },
        { name: "🗄️ Host", value: `\`${hostHint}\``, inline: true },
        {
          name: "📁 Schema",
          value: "`zerotwo` (HeidiSQL)",
          inline: true,
        },
        {
          name: "📋 Tablas clave",
          value:
            "`warns` · `tickets` · `economy` · `bot_logs` · `guild_log_settings` · `bot_config`",
          inline: false,
        },
      );
  }

  if (section === "links") {
    const dash =
      process.env.DASHBOARD_URL ??
      process.env.PUBLIC_APP_URL ??
      "http://localhost:5173";
    const support =
      process.env.SUPPORT_SERVER_URL ?? "https://discord.gg/eSqrEcByrb";
    const invite = client.user
      ? `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`
      : "—";

    base
      .setTitle("🔗 Enlaces útiles")
      .addFields(
        {
          name: "📊 Dashboard",
          value: `[Abrir panel](${dash})`,
          inline: true,
        },
        {
          name: "💬 Soporte",
          value: `[Servidor](${support})`,
          inline: true,
        },
        {
          name: "➕ Invitar bot",
          value: `[Añadir a un servidor](${invite})`,
          inline: false,
        },
        {
          name: "🛠️ Comandos útiles",
          value:
            "`/help` · `/serverinfo` · `/cfglogs` · `/ticket` · `/wallet` · `/blackjack`",
          inline: false,
        },
      );
  }

  return base;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("zerotwoinf")
    .setDescription(
      "⚙️ Información en vivo de Zero Two — menú con sistema, red y base de datos",
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const { file, url } = resolveInfoImage();
    let section: SectionId = "overview";

    const embed = await buildSectionEmbed(section, client, url);
    const menu = buildMenu(userId, section);

    const payload: {
      embeds: EmbedBuilder[];
      components: ActionRowBuilder<StringSelectMenuBuilder>[];
      files?: AttachmentBuilder[];
    } = {
      embeds: [embed],
      components: [menu],
    };
    if (file) payload.files = [file];

    const msg = await interaction.editReply(payload);

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: COLLECTOR_MS,
      filter: (i) =>
        i.customId === `zerotwoinf_menu:${userId}` && i.user.id === userId,
    });

    collector.on("collect", async (i) => {
      try {
        section = (i.values[0] ?? "overview") as SectionId;
        const next = await buildSectionEmbed(section, client, url);
        const row = buildMenu(userId, section);
        // Re-attach file when switching so image stays visible
        const img = resolveInfoImage();
        await i.update({
          embeds: [next],
          components: [row],
          files: img.file ? [img.file] : [],
        });
      } catch {
        await i
          .reply({
            content: "❌ No se pudo actualizar la sección.",
            flags: 64,
          })
          .catch(() => null);
      }
    });

    collector.on("end", async () => {
      try {
        const final = await buildSectionEmbed(section, client, url);
        final.setFooter({
          text: `Zero Two ${BOT_VERSION} · menú expirado · usa /zerotwoinf de nuevo`,
          iconURL: client.user?.displayAvatarURL({ size: 64 }),
        });
        await msg.edit({ embeds: [final], components: [] });
      } catch {
        /* message deleted */
      }
    });
  },
};

export default command;
