/**
 * /ship — compatibilidad romántica (o caótica) entre dos usuarios.
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import { assetImage } from "../../lib/helpAssets.js";
import { BOT_VERSION } from "../../lib/version.js";

const PINK = 0xff2d6b;

function shipPercent(idA: string, idB: string): number {
  // Deterministic + a tiny daily salt so the % can feel “alive” across days
  const [x, y] = idA < idB ? [idA, idB] : [idB, idA];
  let h = 2166136261;
  const day = Math.floor(Date.now() / 86_400_000);
  const s = `${x}:${y}:${day}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 101;
}

function shipName(a: string, b: string): string {
  const left = a.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, "") || a;
  const right = b.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, "") || b;
  const mid = Math.max(2, Math.ceil(left.length / 2));
  const mid2 = Math.max(2, Math.floor(right.length / 2));
  const name = (left.slice(0, mid) + right.slice(right.length - mid2)).slice(
    0,
    24,
  );
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function bar(pct: number, len = 12): string {
  const filled = Math.round((pct / 100) * len);
  return "💖".repeat(Math.max(0, filled)) + "🖤".repeat(Math.max(0, len - filled));
}

function tier(pct: number): {
  title: string;
  emoji: string;
  color: number;
  comment: string;
} {
  if (pct >= 95) {
    return {
      title: "Almas enlazadas",
      emoji: "💍",
      color: 0xffd700,
      comment:
        "Esto ya no es ship… es contrato de por vida en el Franxx. Qué asco de ternura.",
    };
  }
  if (pct >= 80) {
    return {
      title: "Química de infarto",
      emoji: "🔥",
      color: PINK,
      comment:
        "El nexo brilla en rosa. Casi me da envidia… casi.",
    };
  }
  if (pct >= 60) {
    return {
      title: "Buena vibra",
      emoji: "💗",
      color: 0xf472b6,
      comment:
        "Hay chispa. Una cita, una canción y un poco de caos y ya estáis perdidos.",
    };
  }
  if (pct >= 40) {
    return {
      title: "Amigos… por ahora",
      emoji: "🤝",
      color: 0xa78bfa,
      comment:
        "Podría funcionar, o podría ser el drama de la semana. Diversión asegurada.",
    };
  }
  if (pct >= 20) {
    return {
      title: "Zona de riesgo",
      emoji: "⚡",
      color: 0xf59e0b,
      comment:
        "Compatibilidad baja. Si insistís, que sea por el plot twist.",
    };
  }
  return {
    title: "Enemigos naturales",
    emoji: "💥",
    color: 0x64748b,
    comment:
      "El algoritmo dice no. El destino dice huir. Yo digo… entretenimiento total.",
  };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("💘 Compatibilidad entre dos personas + ship name")
    .addUserOption((o) =>
      o
        .setName("usuario1")
        .setDescription("Primera persona (por defecto: tú)")
        .setRequired(false),
    )
    .addUserOption((o) =>
      o
        .setName("usuario2")
        .setDescription("Segunda persona (requerida si no hay otra mención)")
        .setRequired(false),
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    let u1 = interaction.options.getUser("usuario1");
    let u2 = interaction.options.getUser("usuario2");

    // /ship @alguien → ship contigo
    if (u1 && !u2) {
      u2 = u1;
      u1 = interaction.user;
    } else if (!u1 && u2) {
      u1 = interaction.user;
    } else if (!u1 && !u2) {
      await interaction.reply({
        content:
          "❌ Menciona al menos a **una** persona.\nEjemplos: `/ship usuario2:@crush` o `/ship usuario1:@a usuario2:@b`",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!u1 || !u2) {
      await interaction.reply({
        content: "❌ Faltan usuarios para el ship.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (u1.id === u2.id) {
      await interaction.reply({
        content:
          "❌ ¿Shipearte contigo mismo? Ego nivel Zero Two… pero no. Elige a otra persona.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const pct = shipPercent(u1.id, u2.id);
    const t = tier(pct);
    const name = shipName(u1.username, u2.username);
    const img = assetImage("fun");

    const embed = new EmbedBuilder()
      .setColor(t.color)
      .setAuthor({
        name: "Zero Two · Love Calculator",
        iconURL: client.user?.displayAvatarURL() ?? undefined,
      })
      .setTitle(`${t.emoji} ${t.title} · ${pct}%`)
      .setDescription(
        [
          `${u1}  💕  ${u2}`,
          "",
          `**Ship name:** \`${name}\``,
          "",
          bar(pct),
          `\`${pct}%\` de compatibilidad hoy`,
          "",
          `💬 *"${t.comment}"*`,
        ].join("\n"),
      )
      .setThumbnail(u1.displayAvatarURL({ size: 256 }))
      .setFooter({
        text: `Zero Two ${BOT_VERSION} · El % cambia un poco cada día`,
        iconURL: u2.displayAvatarURL({ size: 64 }),
      })
      .setTimestamp();

    if (img.url) embed.setImage(img.url);

    await interaction.reply({
      embeds: [embed],
      files: img.file ? [img.file] : undefined,
    });
  },
};

export default command;
