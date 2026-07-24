/**
 * /presence — preview de la rich presence de Zero Two.
 * Muestra el modo actual, stats y la cola de slices.
 * Botón para forzar el siguiente slice (solo dueños del bot).
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getPresencePreview,
  stepPresence,
  forcePresenceUpdate,
  type PresencePreview,
} from "../../lib/presence.js";

const PINK = 0xff2d6b;
const COLLECTOR_MS = 60_000;

function isOwner(userId: string): boolean {
  return (process.env.OWNER_IDS ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

function statusEmoji(status: string): string {
  switch (status) {
    case "online":
      return "🟢";
    case "idle":
      return "🟡";
    case "dnd":
      return "🔴";
    default:
      return "⚪";
  }
}

function buildEmbed(client: Client, preview: PresencePreview): EmbedBuilder {
  const { stats, slices, mode, intervalSec, rotationLength } = preview;
  const modeLabel =
    mode === "music"
      ? "🎵 **Modo música** — casi solo now playing"
      : "💤 **Modo reposo** — rotación completa Darling";

  const nowLine = stats.nowPlayingTitle
    ? stats.musicPaused
      ? `⏸ \`${stats.nowPlayingTitle}\`${stats.nowPlayingGuild ? ` · ${stats.nowPlayingGuild}` : ""}`
      : `▶️ \`${stats.nowPlayingTitle}\`${stats.nowPlayingGuild ? ` · ${stats.nowPlayingGuild}` : ""}`
    : mode === "music"
      ? "Sesión activa (sin título en caché)"
      : "Nada sonando ahora";

  const lines = slices.map((s) => {
    const mark = s.isCurrent ? "▶" : "·";
    const state = s.state ? `\n   └ _${s.state}_` : "";
    return `${mark} **${s.index}.** [${s.typeLabel}] ${statusEmoji(s.status)} ${s.name}${state}`;
  });

  // Discord field value max 1024
  let body = lines.join("\n");
  if (body.length > 1000) {
    body = `${body.slice(0, 997)}…`;
  }

  const embed = new EmbedBuilder()
    .setColor(PINK)
    .setAuthor({
      name: `Rich Presence // Zero Two ${stats.version}`,
      iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
    .setTitle("🎮 Preview de mi estado")
    .setDescription(
      [
        modeLabel,
        `Intervalo **${intervalSec}s** · rotación expandida **${rotationLength}** pasos · **${slices.length}** slices únicos`,
        "",
        `**Now playing:** ${nowLine}`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "📊 Stats en caché",
        value: [
          `📡 **${stats.guilds}** servidores · 👥 **${stats.users.toLocaleString("es-ES")}** usuarios`,
          `🎵 **${stats.musicSessions}** sesiones · 🎫 **${stats.openTickets}** tickets`,
          `⏱ up **${stats.uptime}**${stats.ping != null ? ` · WS **${stats.ping}** ms` : ""}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🌀 Cola de slices",
        value: body || "_sin slices_",
        inline: false,
      },
    )
    .setFooter({
      text: "▶ = slice actual · «Siguiente» solo owners · se actualiza sola en rotación",
    })
    .setTimestamp();

  return embed;
}

function controlRow(owner: boolean): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("presence_step")
      .setLabel("Siguiente slice")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!owner),
    new ButtonBuilder()
      .setCustomId("presence_refresh")
      .setLabel("Refrescar")
      .setEmoji("🔄")
      .setStyle(ButtonStyle.Secondary),
  );
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("presence")
    .setDescription("🎮 Preview de la rich presence rotativa de Zero Two"),

  cooldown: 8,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    // Asegura stats frescas de música antes del preview
    try {
      const { musicManager } = await import("../../music/manager.js");
      const { setMusicPresenceFromSnapshot } = await import(
        "../../lib/presence.js"
      );
      setMusicPresenceFromSnapshot(
        client,
        musicManager.presenceSnapshot(client),
      );
    } catch {
      /* optional */
    }

    const owner = isOwner(interaction.user.id);
    let preview = getPresencePreview(client);

    const msg = await interaction.reply({
      embeds: [buildEmbed(client, preview)],
      components: [controlRow(owner)],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_MS,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      try {
        if (i.customId === "presence_step") {
          if (!isOwner(i.user.id)) {
            await i.reply({
              content:
                "Solo los owners del bot pueden forzar el siguiente slice, Darling.",
              ephemeral: true,
            });
            return;
          }
          preview = stepPresence(client);
          await i.update({
            embeds: [buildEmbed(client, preview)],
            components: [controlRow(true)],
          });
          return;
        }

        if (i.customId === "presence_refresh") {
          try {
            const { musicManager } = await import("../../music/manager.js");
            const { setMusicPresenceFromSnapshot } = await import(
              "../../lib/presence.js"
            );
            setMusicPresenceFromSnapshot(
              client,
              musicManager.presenceSnapshot(client),
            );
          } catch {
            /* */
          }
          forcePresenceUpdate(client);
          preview = getPresencePreview(client);
          await i.update({
            embeds: [buildEmbed(client, preview)],
            components: [controlRow(isOwner(i.user.id))],
          });
        }
      } catch {
        /* interaction expired */
      }
    });

    collector.on("end", async () => {
      try {
        await msg.edit({ components: [] });
      } catch {
        /* */
      }
    });
  },
};

export default command;
