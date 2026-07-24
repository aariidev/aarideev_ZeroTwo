/**
 * Botones del watcher (scripts/dev-watch.mjs):
 *   dev_reload_confirm → reiniciar
 *   dev_reload_cancel  → posponer
 */
import {
  ButtonInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { BOT_VERSION } from "./version.js";

export const DEV_RELOAD_CONFIRM = "dev_reload_confirm";
export const DEV_RELOAD_CANCEL = "dev_reload_cancel";

const PINK = 0xff2d6b;
const GREEN = 0x22c55e;
const AMBER = 0xf59e0b;
const PURPLE = 0xa78bfa;
const SLATE = 0x64748b;

function isOwner(userId: string): boolean {
  return (process.env.OWNER_IDS ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

function bar(pct: number, len = 10): string {
  const f = Math.round((Math.min(100, Math.max(0, pct)) / 100) * len);
  return "█".repeat(f) + "░".repeat(Math.max(0, len - f));
}

export async function handleDevReloadButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const { customId } = interaction;
  if (
    customId !== DEV_RELOAD_CONFIRM &&
    customId !== DEV_RELOAD_CANCEL
  ) {
    return false;
  }

  if (!isOwner(interaction.user.id)) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(PINK)
          .setTitle("🚫 Acceso denegado")
          .setDescription(
            "Solo la **desarrolladora** (`OWNER_IDS`) puede controlar los reloads del watcher.",
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const botIcon = interaction.client.user?.displayAvatarURL({ size: 64 });

  const messageId = interaction.message?.id ?? null;
  const channelId = interaction.channelId ?? null;

  if (customId === DEV_RELOAD_CANCEL) {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(SLATE)
          .setAuthor({
            name: "Zero Two · Dev Watcher",
            iconURL: botIcon,
          })
          .setTitle("⏳ Reload pospuesto")
          .setDescription(
            [
              "La build **sigue compilada** en disco, pero el bot **no se reinició**.",
              "",
              "Sigue editando con calma. Cuando guardes de nuevo, te avisaré otra vez. 🌸",
              "",
              "> Tip: también puedes reiniciar el proceso a mano si lo prefieres.",
            ].join("\n"),
          )
          .addFields({
            name: "👤 Por",
            value: `<@${interaction.user.id}>`,
            inline: true,
          })
          .setFooter({
            text: `Zero Two ${BOT_VERSION} · deferred`,
            iconURL: botIcon,
          })
          .setTimestamp(),
      ],
      components: [],
    });
    if (typeof process.send === "function") {
      process.send({
        type: "dev_reload_cancel",
        messageId,
        channelId,
      });
    }
    return true;
  }

  // confirm — primero actualizamos el embed (interaction), luego avisamos al watcher
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(PURPLE)
        .setAuthor({
          name: "Zero Two · Dev Watcher",
          iconURL: botIcon,
        })
        .setTitle("🔄 Reiniciando el núcleo…")
        .setDescription(
          [
            "Aplicando la nueva build. El proceso se reciclará en un momento.",
            "",
            `\`[${bar(55)}]\` *hot reload en curso*`,
            "",
            "El watcher actualizará este mensaje a **ONLINE** al terminar. ✨",
          ].join("\n"),
        )
        .addFields({
          name: "👤 Confirmado por",
          value: `<@${interaction.user.id}>`,
          inline: true,
        })
        .setFooter({
          text: `Zero Two ${BOT_VERSION} · restarting`,
          iconURL: botIcon,
        })
        .setTimestamp(),
    ],
    components: [],
  });

  // IPC al watcher (incluye messageId para que actualice este mismo embed a ONLINE)
  if (typeof process.send === "function") {
    const sent = process.send({
      type: "dev_reload_confirm",
      messageId,
      channelId,
    });
    // process.send puede ser sync false en buffer lleno; forzar un tick
    if (sent === false) {
      await new Promise<void>((resolve) => {
        process.once("drain", () => resolve());
        setTimeout(resolve, 200);
      });
    }
    return true;
  }

  const parentPid = process.ppid;
  const canSignalParent =
    parentPid && parentPid !== 1 && process.platform !== "win32";
  if (canSignalParent) {
    try {
      process.kill(parentPid, "SIGUSR2");
      return true;
    } catch {
      /* fall through */
    }
  }

  // Fallback: salir y confiar en un supervisor externo
  setTimeout(() => process.exit(0), 500);

  return true;
}
