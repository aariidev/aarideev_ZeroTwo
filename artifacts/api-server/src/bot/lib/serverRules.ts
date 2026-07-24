/**
 * Plantillas de reglas del servidor (ES / EN) — estilo Zero Two.
 * Contenido adaptado de Yumi (reglases / rulesen).
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
} from "discord.js";
import { BOT_VERSION } from "./version.js";

const PINK = 0xff2d6b;

export const RULES_ES = {
  title: "📖 Reglas generales del servidor",
  description: [
    "**🔞 ➜ 1. No se permite contenido NSFW**",
    "> No se permitirá ningún tipo de contenido NSFW: imágenes, links, vídeos, audios o hablar sobre ello. **BAN permanente**. La incitación también se sanciona.",
    "",
    "**🙌 ➜ 2. Respetar a los miembros**",
    "> Respeta a todos sin excepción. Si insultas de broma, no te pases. Generar conflictos está prohibido.",
    "",
    "**🔗 ➜ 3. Prohibido enviar links maliciosos**",
    "> Prohibido enviar links con virus, malware o phishing.",
    "",
    "**🔕 ➜ 4. Sonidos extraños en voz**",
    "> Prohibido gritos, gemidos u otros sonidos molestos en canales de voz.",
    "",
    "**🏴 ➜ 5. Comportamiento tóxico**",
    "> El comportamiento tóxico está estrictamente prohibido.",
    "",
    "**❌ ➜ 6. No SPAM, FLOOD ni RAID**",
    "> No se tolerará flood, spam o raid (incluye MDs).",
    "",
    "**❌ ➜ 7. No pedir roles**",
    "> No pidas roles ni hagas menciones masivas innecesarias.",
    "",
    "**👽 ➜ 8. Publicidad de YouTube**",
    "> Publica tu vídeo/canal solo en el canal de spam/publicidad si existe.",
    "",
    "**❌ ➜ 9. No cuestionar las reglas**",
    "> Las reglas existen para mantener el servidor estable y en orden.",
    "",
    "**🔢 ➜ 10. No usar multicuentas**",
    "> Las multicuentas descubiertas serán expulsadas. No se toleran para beneficio propio.",
    "",
    "**🏴 ➜ 11. No suplantar identidad**",
    "> No te hagas pasar por otra persona ni uses nombres/avatares inapropiados.",
    "",
    "**❌ ➜ 12. No hagas spoilers**",
    "> No hagas spoilers solo por molestar (se permiten temas con **3+ meses** de antigüedad).",
    "",
    "**❓ ➜ Dentro y fuera de la comunidad**",
    "> Estas normas también aplican en mensajes directos (MDs) relacionados con el server.",
    "",
    "**❓ ➜ ¿Qué pasa si incumplo una regla?**",
    "> Tendrá el castigo correspondiente (warn, mute, kick o ban) según la gravedad.",
    "",
    "**❓ ➜ ¿Qué hago si alguien incumple?**",
    "> Ábrele un ticket de soporte o avisa al staff. También puedes reportar a Discord.",
  ].join("\n"),
};

export const RULES_EN = {
  title: "📖 Server rules (English)",
  description: [
    "**🔞 ➜ 1. No NSFW content**",
    "> No NSFW content allowed: images, links, videos, audio, or even talking about it. **Permanent BAN**. Inciting this content is also punished.",
    "",
    "**🙌 ➜ 2. Respect server members**",
    "> Respect everyone. If you insult as a joke, don't overdo it. Generating conflict is prohibited.",
    "",
    "**🔗 ➜ 3. Malicious links**",
    "> Do not send links with viruses, malware, or phishing.",
    "",
    "**🔕 ➜ 4. Strange sounds in voice**",
    "> No screaming, moaning, or disruptive sounds in voice channels.",
    "",
    "**🏴 ➜ 5. Toxic behavior**",
    "> Toxic behavior is strictly prohibited.",
    "",
    "**❌ ➜ 6. No SPAM, FLOOD or RAID**",
    "> Flood, spam and raids are not tolerated (including DMs).",
    "",
    "**❌ ➜ 7. Do not ask for roles**",
    "> Do not beg for roles or mass-mention people.",
    "",
    "**👽 ➜ 8. YouTube advertising**",
    "> Post your channel/video only in the spam/promo channel if one exists.",
    "",
    "**❌ ➜ 9. Do not question the rules**",
    "> Rules exist to keep the server stable and fair.",
    "",
    "**🔢 ➜ 10. No multi-accounts**",
    "> Multi-accounts will be removed. We do not allow them for personal gain.",
    "",
    "**🏴 ➜ 11. No impersonation**",
    "> Do not impersonate anyone or use inappropriate names/avatars.",
    "",
    "**❌ ➜ 12. No spoilers**",
    "> Do not spoil series/games/movies just to annoy (topics **3+ months** old are fine).",
    "",
    "**❓ ➜ Inside and outside the community**",
    "> These rules also apply to DMs related to this server.",
    "",
    "**❓ ➜ What if I break a rule?**",
    "> You will receive the matching punishment (warn, mute, kick, or ban).",
    "",
    "**❓ ➜ What if someone else breaks the rules?**",
    "> Open a support ticket or notify staff. You may also report to Discord.",
  ].join("\n"),
};

export function buildRulesEmbed(
  client: Client,
  lang: "es" | "en",
  guildName?: string | null,
): EmbedBuilder {
  const pack = lang === "en" ? RULES_EN : RULES_ES;
  const bot = client.user;
  return new EmbedBuilder()
    .setColor(PINK)
    .setAuthor({
      name:
        lang === "en"
          ? "Zero Two · Server rules"
          : "Zero Two · Reglas del servidor",
      iconURL: bot?.displayAvatarURL({ size: 64 }) ?? undefined,
    })
    .setTitle(pack.title)
    .setDescription(pack.description.slice(0, 4090))
    .setThumbnail(bot?.displayAvatarURL({ size: 256 }) ?? null)
    .setFooter({
      text: guildName
        ? `${guildName} · Zero Two ${BOT_VERSION}`
        : `Zero Two ${BOT_VERSION}`,
      iconURL: bot?.displayAvatarURL({ size: 32 }) ?? undefined,
    })
    .setTimestamp();
}

export function rulesLinkRow(lang: "es" | "en") {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel(lang === "en" ? "Discord Terms" : "Términos de Discord")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.com/terms")
      .setEmoji("✔️"),
    new ButtonBuilder()
      .setLabel(lang === "en" ? "Discord Privacy" : "Privacidad de Discord")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.com/privacy")
      .setEmoji("🔒"),
    new ButtonBuilder()
      .setLabel(lang === "en" ? "Discord Guidelines" : "Directrices de Discord")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.com/guidelines")
      .setEmoji("📜"),
  );
}
