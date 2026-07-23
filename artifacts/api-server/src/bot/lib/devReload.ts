/**
 * devReload.ts — Maneja los botones "Reiniciar" / "Cancelar" que envía
 * el watcher externo (scripts/dev-watch.mjs) cuando detecta cambios en el código.
 *
 * El watcher arranca el bot como proceso hijo. Cuando hay una build lista,
 * manda un embed con dos botones al canal DEV_LOG_CHANNEL_ID.
 * Este módulo responde a esos botones:
 *   - dev_reload_confirm  → manda SIGUSR2 al proceso padre (el watcher), que reinicia el bot
 *   - dev_reload_cancel   → descarta la build pendiente
 */
import {
  ButtonInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";

/** IDs de los botones que emite el watcher */
export const DEV_RELOAD_CONFIRM = "dev_reload_confirm";
export const DEV_RELOAD_CANCEL = "dev_reload_cancel";

function isOwner(userId: string): boolean {
  return (process.env.OWNER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
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

  // Solo el owner puede pulsar estos botones
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({
      content: "❌ Solo la desarrolladora puede controlar los reloads.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (customId === DEV_RELOAD_CANCEL) {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff2d6b)
          .setTitle("🚫 Reload Cancelado")
          .setDescription("La build está lista pero el bot **no se reiniciará**.\nPuedes reiniciar manualmente cuando quieras.")
          .setTimestamp(),
      ],
      components: [],
    });
    return true;
  }

  // dev_reload_confirm → avisar al watcher vía SIGUSR2
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle("🔄 Reiniciando bot...")
        .setDescription("Aplicando la nueva build. El bot volverá en unos segundos. 🌸")
        .setTimestamp(),
    ],
    components: [],
  });

  // El watcher escucha SIGUSR2 en el proceso padre
  // process.ppid solo está disponible en Node 16+
  const parentPid = process.ppid;
  if (parentPid && parentPid !== 1) {
    process.kill(parentPid, "SIGUSR2");
  } else {
    // Fallback: reiniciar el propio proceso (solo si no hay watcher)
    setTimeout(() => process.exit(0), 500);
  }

  return true;
}
