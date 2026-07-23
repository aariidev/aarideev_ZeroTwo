/**
 * Genera transcripciones HTML formateadas para tickets cerrados.
 * Reemplaza la versión de texto plano de buildTranscript().
 */
import type { TextChannel, Message } from "discord.js";
import { logger } from "../../lib/logger.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date: Date): string {
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function avatarUrl(msg: Message): string {
  return (
    msg.author.displayAvatarURL({ size: 32, extension: "webp" }) ??
    `https://cdn.discordapp.com/embed/avatars/${
      (Number(msg.author.discriminator) || 0) % 5
    }.png`
  );
}

function renderAttachments(msg: Message): string {
  if (msg.attachments.size === 0) return "";
  const items = [...msg.attachments.values()]
    .map((att) => {
      const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(att.name ?? "");
      if (isImage) {
        return `<a href="${escapeHtml(att.url)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(att.url)}" alt="${escapeHtml(att.name ?? "adjunto")}"
               style="max-width:300px;max-height:200px;border-radius:4px;margin-top:4px;display:block;" loading="lazy"/>
        </a>`;
      }
      return `<a href="${escapeHtml(att.url)}" target="_blank" rel="noopener"
              style="color:#7289da;">📎 ${escapeHtml(att.name ?? "archivo")}</a>`;
    })
    .join("\n");
  return `<div class="attachments">${items}</div>`;
}

function renderEmbeds(msg: Message): string {
  if (msg.embeds.length === 0) return "";
  const items = msg.embeds
    .map((e) => {
      const title = e.title ? `<strong>${escapeHtml(e.title)}</strong><br>` : "";
      const desc = e.description
        ? `<span>${escapeHtml(e.description.slice(0, 500))}</span>`
        : "";
      const color = e.color ? `#${e.color.toString(16).padStart(6, "0")}` : "#7289da";
      return `<div class="embed" style="border-left:3px solid ${color};padding:6px 10px;margin-top:4px;background:#2f3136;border-radius:0 4px 4px 0;">${title}${desc}</div>`;
    })
    .join("\n");
  return items;
}

function renderMessage(msg: Message, prevAuthorId: string | null): string {
  const isContinuation =
    prevAuthorId === msg.author.id &&
    msg.content.length > 0;

  const headerHtml = isContinuation
    ? ""
    : `<div class="msg-header">
        <img src="${escapeHtml(avatarUrl(msg))}" alt="avatar" class="avatar" loading="lazy"/>
        <span class="username ${msg.author.bot ? "bot" : ""}">${escapeHtml(
          msg.member?.displayName ?? msg.author.username,
        )}</span>
        ${msg.author.bot ? '<span class="badge bot-badge">BOT</span>' : ""}
        <span class="timestamp">${formatDate(msg.createdAt)}</span>
      </div>`;

  const content = msg.content
    ? `<div class="msg-content">${escapeHtml(msg.content)}</div>`
    : "";

  return `
    <div class="message${isContinuation ? " continuation" : ""}" id="msg-${msg.id}">
      ${headerHtml}
      ${content}
      ${renderAttachments(msg)}
      ${renderEmbeds(msg)}
    </div>`;
}

export async function buildTranscriptHtml(
  channel: TextChannel,
  ticketInfo: {
    id: number;
    username: string;
    userId: string;
    category: string;
    openedAt: Date;
    closedAt?: Date | null;
    closedBy?: string | null;
    claimedBy?: string | null;
    guildName?: string | null;
    reason?: string | null;
  },
  limit = 200,
): Promise<string> {
  let messages: Message[] = [];
  try {
    const fetched = await channel.messages.fetch({ limit });
    messages = [...fetched.values()].sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp,
    );
  } catch (err) {
    logger.warn({ err }, "tickets: transcript HTML fetch failed");
  }

  const msgHtml = (() => {
    let prevId: string | null = null;
    const parts: string[] = [];
    for (const msg of messages) {
      parts.push(renderMessage(msg, prevId));
      prevId = msg.author.id;
    }
    return parts.join("\n");
  })();

  const closedStr = ticketInfo.closedAt ? formatDate(ticketInfo.closedAt) : "—";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Ticket #${ticketInfo.id} — ${escapeHtml(ticketInfo.username)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #1e2124;
      color: #dcddde;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }
    header {
      background: #2f3136;
      border-bottom: 2px solid #ec4899;
      padding: 20px 24px;
    }
    header h1 { color: #ec4899; font-size: 1.4rem; margin-bottom: 8px; }
    .meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 0.85rem; color: #b9bbbe; }
    .meta span strong { color: #dcddde; }
    .messages { padding: 16px 24px; max-width: 900px; margin: 0 auto; }
    .message { padding: 6px 0 6px 48px; position: relative; }
    .message.continuation { padding-top: 2px; padding-bottom: 2px; }
    .msg-header {
      display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;
    }
    .avatar {
      width: 32px; height: 32px; border-radius: 50%;
      position: absolute; left: 0; top: 6px;
    }
    .username { font-weight: 600; color: #7289da; }
    .username.bot { color: #43b581; }
    .badge {
      font-size: 0.65rem; padding: 1px 4px; border-radius: 3px;
      vertical-align: middle; font-weight: 700; text-transform: uppercase;
    }
    .bot-badge { background: #7289da; color: #fff; }
    .timestamp { font-size: 0.75rem; color: #72767d; }
    .msg-content { word-break: break-word; white-space: pre-wrap; }
    .attachments { margin-top: 4px; }
    .message + .message:not(.continuation) { margin-top: 12px; }
    footer {
      text-align: center; padding: 20px; font-size: 0.78rem;
      color: #72767d; border-top: 1px solid #40444b; margin-top: 32px;
    }
    a { color: #7289da; }
  </style>
</head>
<body>
  <header>
    <h1>🎫 Ticket #${ticketInfo.id}</h1>
    <div class="meta">
      <span><strong>Usuario:</strong> ${escapeHtml(ticketInfo.username)} (${escapeHtml(ticketInfo.userId)})</span>
      <span><strong>Categoría:</strong> ${escapeHtml(ticketInfo.category)}</span>
      <span><strong>Servidor:</strong> ${escapeHtml(ticketInfo.guildName ?? "—")}</span>
      <span><strong>Abierto:</strong> ${formatDate(ticketInfo.openedAt)}</span>
      <span><strong>Cerrado:</strong> ${closedStr}</span>
      ${ticketInfo.closedBy ? `<span><strong>Cerrado por:</strong> ${escapeHtml(ticketInfo.closedBy)}</span>` : ""}
      ${ticketInfo.claimedBy ? `<span><strong>Atendido por:</strong> ${escapeHtml(ticketInfo.claimedBy)}</span>` : ""}
      ${ticketInfo.reason ? `<span><strong>Motivo:</strong> ${escapeHtml(ticketInfo.reason)}</span>` : ""}
      <span><strong>Mensajes:</strong> ${messages.length}</span>
    </div>
  </header>
  <main class="messages">
    ${msgHtml || "<p style='color:#72767d;padding:24px 0'>Sin mensajes.</p>"}
  </main>
  <footer>
    Generado por <strong>Zero Two</strong> · ${formatDate(new Date())}
  </footer>
</body>
</html>`;
}
