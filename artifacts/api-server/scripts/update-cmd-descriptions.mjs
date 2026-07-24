/**
 * One-shot: update top-level slash command descriptions (max 100 chars).
 * Run: node scripts/update-cmd-descriptions.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "src", "bot", "commands");

/** @type {Record<string, string>} */
const DESCS = {
  help: "📋 Panel de comandos Zero Two — explora módulos y usos",
  ping: "🏓 Latencia del bot y del WebSocket en tiempo real",
  avatar: "🖼️ Avatar a tamaño completo de un usuario (o el tuyo)",
  serverinfo: "🏠 Informe del servidor — miembros, canales y seguridad",
  userinfo: "👤 Ficha de un miembro — perfil, roles y permisos",
  zerotwoinf: "⚙️ Info en vivo de Zero Two — sistema, red y base de datos",
  presence: "🎮 Preview de la rich presence rotativa de Zero Two",
  beta: "🧪 Programa beta — features de lab, status y feedback",
  sugerencias: "💡 Buzón de sugerencias — propone ideas al servidor",
  nivel: "📊 Niveles y XP — progreso, top y logros",
  welcome: "🌸 Bienvenida y despedida — mensajes y autoroles",
  reglas: "📖 Publica el embed de reglas del servidor",
  rules: "📖 Post the server rules embed (English)",
  cfgembed: "🎨 Constructor visual de embeds personalizados",
  cfglogs: "📡 Canal y catálogo de logs del servidor",
  ticket: "🎫 Tickets de soporte — panel, claim, close y setup",
  // ticket.ts sometimes parsed as first setName "config" if order wrong
  ban: "🔨 Banea a un miembro y limpia mensajes recientes",
  unban: "🔓 Revoca un ban por ID de usuario",
  kick: "👢 Expulsa a un miembro del servidor",
  mute: "🔇 Silencia a un miembro por un tiempo",
  unmute: "🔊 Quita el silencio a un miembro",
  timeout: "⏳ Aísla temporalmente a un miembro (timeout)",
  untimeout: "✅ Quita el timeout antes de tiempo",
  warn: "⚠️ Advertencias — add, list, remove y clear",
  warns: "📜 Consulta el expediente de warns de un usuario",
  clearwarns: "🧹 Borra todas las advertencias de un usuario",
  delwarn: "🗑️ Elimina una advertencia por su folio #id",
  purge: "🧼 Borra mensajes del canal (máx. 14 días)",
  lock: "🔒 Bloquea el envío de mensajes en el canal",
  unlock: "🔓 Desbloquea el canal para hablar de nuevo",
  slowmode: "🐢 Activa o ajusta el modo lento del canal",
  logs: "📋 Historial de sanciones y acciones del bot",
  automod: "🛡️ AutoMod Zero Two — pack, estado y reglas",
  antiraid: "🚨 Antiraid — frena joins masivos automáticamente",
  autconfig: "⚙️ Setup del servidor — colores, AutoMod, antiraid y más",
  giverole: "🎖️ Da o quita un rol a un miembro",
  "8ball": "🎱 Pregunta al núcleo — sí, no o misterio",
  meme: "😂 Memes de Reddit — SpanishMeme, anime, code y más",
  poker: "🃏 Poker Texas Hold'em — mano, flop y showdown",
  ship: "💘 Compatibilidad entre dos personas + ship name",
  chat: "💬 Habla con Zero Two (Gemini) en el nexo",
  chrome: "🦾 Cyberware Edgerunners — info y upgrades",
  gig: "🌃 Consigue un gig en Night City",
  psycho: "💉 Test de cyberpsychosis estilo Edgerunners",
  blackjack: "🃏 Blackjack del casino — apuesta y gana fichas",
  slots: "🎰 Tragaperras del casino — prueba tu suerte",
  daily: "🎁 Recompensa diaria de fichas — ¡mantén la racha!",
  wallet: "💳 Tu saldo, stats y daily del casino",
  shop: "🏪 Tienda del casino — cajas, multi y exclusivos",
  inventory: "🎒 Inventario de ítems — usa cajas y power-ups",
  pay: "💸 Transfiere fichas a otro miembro",
  top: "🏆 Ranking de los más ricos del servidor",
  play: "▶️ Reproduce YouTube o Spotify (track, álbum, playlist)",
  skip: "⏭️ Salta a la siguiente canción",
  stop: "⏹️ Detiene la música y limpia la cola",
  pause: "⏸️ Pausa o reanuda la reproducción",
  queue: "📋 Cola de reproducción — páginas y orden",
  nowplaying: "🎵 Canción actual con controles en vivo",
  volume: "🔊 Volumen del bot (0–150)",
  loop: "🔁 Loop: off → pista → cola",
  shuffle: "🔀 Mezcla la cola al azar",
  leave: "🚪 Sale del canal de voz",
  remove: "🗑️ Quita una pista de la cola por posición",
  clear: "🧹 Vacía la cola (sigue la canción actual)",
  continue: "▶️ Reanuda la sesión de música guardada",
  musicpanel: "🎛️ Panel fijo de música del servidor",
  dev: "👑 Panel owner — economía, ítems y herramientas dev",
};

let updated = 0;
let failed = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".ts")) processFile(p);
  }
}

function processFile(file) {
  let src = fs.readFileSync(file, "utf8");
  const nameMatch = src.match(/\.setName\("([a-z0-9_]+)"\)/);
  if (!nameMatch) return;
  const name = nameMatch[1];
  const desc = DESCS[name];
  if (!desc) {
    console.log("SKIP", name, path.relative(root, file));
    return;
  }
  if ([...desc].length > 100 && desc.length > 100) {
    // Discord counts UTF-16 code units roughly; keep ASCII length check
    if (desc.length > 100) {
      console.log("TOO_LONG", name, desc.length, desc);
      failed++;
      return;
    }
  }

  const quoted = JSON.stringify(desc);

  // After first setName, find first setDescription("...") single-line
  const nameIdx = src.indexOf(`.setName("${name}")`);
  if (nameIdx < 0) return;
  const after = src.slice(nameIdx);
  const descIdxRel = after.search(/\.setDescription\(/);
  if (descIdxRel < 0) {
    console.log("NO_DESC", name);
    failed++;
    return;
  }
  const abs = nameIdx + descIdxRel;
  const rest = src.slice(abs);
  // .setDescription("...") or .setDescription(\n  "..."\n) or "a" + "b"
  const m = rest.match(
    /^\.setDescription\(\s*(?:("(?:\\.|[^"\\])*")|(?:\n(?:\s*"(?:\\.|[^"\\])*"\s*\+?\s*)+\n\s*))\)/,
  );
  if (m) {
    const newRest = rest.replace(m[0], `.setDescription(${quoted})`);
    src = src.slice(0, abs) + newRest;
    fs.writeFileSync(file, src);
    updated++;
    console.log("OK", name, `(${desc.length})`);
    return;
  }

  // Multiline only first string: .setDescription(\n      "....",\n    )
  const m2 = rest.match(
    /^\.setDescription\(\s*\n\s*("(?:\\.|[^"\\])*")\s*,?\s*\n\s*\)/,
  );
  if (m2) {
    const newRest = rest.replace(m2[0], `.setDescription(${quoted})`);
    src = src.slice(0, abs) + newRest;
    fs.writeFileSync(file, src);
    updated++;
    console.log("OK nl", name, `(${desc.length})`);
    return;
  }

  console.log("FAIL", name, path.relative(root, file));
  console.log("  snippet:", rest.slice(0, 140).replace(/\n/g, "\\n"));
  failed++;
}

walk(root);
console.log(`\nDone. updated=${updated} failed=${failed}`);
