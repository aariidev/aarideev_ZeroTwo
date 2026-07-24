import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types.js";
import {
  getEconomy,
  addBalance,
  getInventory,
  addItem,
} from "../../lib/economy.js";
import { db, economyTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { assetImage } from "../../lib/helpAssets.js";

// ── Owner guard ───────────────────────────────────────────────────────────────
function isOwner(userId: string): boolean {
  const ids = (process.env.OWNER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

function withDevImage(embed: EmbedBuilder) {
  const img = assetImage("dev");
  if (img.url && img.file) {
    embed.setImage(img.url);
    return { embed, files: [img.file] as const };
  }
  // Fallback so we notice missing assets in logs
  console.warn(
    "[dev] assetImage('dev') not found — check assets/help/dev.jpg",
  );
  return { embed, files: [] as const };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dev")
    .setDescription(
      "🔧 Panel de desarrollador — gestión de economía [OWNER ONLY]",
    )
    .addSubcommand((sub) =>
      sub
        .setName("give")
        .setDescription("💰 Dar fichas a un usuario")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Usuario objetivo").setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("cantidad")
            .setDescription("Fichas a dar")
            .setRequired(true)
            .setMinValue(1),
        )
        .addStringOption((o) =>
          o
            .setName("guild_id")
            .setDescription("Guild ID (vacío = guild actual)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("take")
        .setDescription("💸 Quitar fichas a un usuario")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Usuario objetivo").setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("cantidad")
            .setDescription("Fichas a quitar")
            .setRequired(true)
            .setMinValue(1),
        )
        .addStringOption((o) =>
          o
            .setName("guild_id")
            .setDescription("Guild ID (vacío = guild actual)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("🎯 Establecer el saldo exacto de un usuario")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Usuario objetivo").setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("cantidad")
            .setDescription("Nuevo saldo")
            .setRequired(true)
            .setMinValue(0),
        )
        .addStringOption((o) =>
          o
            .setName("guild_id")
            .setDescription("Guild ID (vacío = guild actual)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("🔄 Resetear economía completa de un usuario")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Usuario objetivo").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("guild_id")
            .setDescription("Guild ID (vacío = guild actual)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("📊 Ver estadísticas completas de economía de un usuario")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Usuario objetivo").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("guild_id")
            .setDescription("Guild ID (vacío = guild actual)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("additem")
        .setDescription("🎒 Añadir un ítem al inventario de un usuario")
        .addUserOption((o) =>
          o.setName("usuario").setDescription("Usuario objetivo").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("item")
            .setDescription("ID del ítem")
            .setRequired(true)
            .addChoices(
              { name: "🎰 Multiplicador ×2", value: "multiplier" },
              { name: "🛡 Seguro de Apuesta", value: "insurance" },
              { name: "🪙 Bolsa de Fichas", value: "chip_pouch" },
              { name: "🎁 Caja de Fichas", value: "chip_box" },
              { name: "🍬 Caja de Dulces", value: "candy_box" },
              { name: "🥈 Cofre de Plata", value: "silver_chest" },
              { name: "🎲 Dado del Apostador", value: "gamblers_dice" },
              { name: "💜 Caja Neón", value: "neon_crate" },
              { name: "💎 Cofre Élite", value: "elite_chest" },
              { name: "🏆 Cofre de Oro", value: "gold_chest" },
              { name: "🎫 Ticket Jackpot", value: "jackpot_ticket" },
              { name: "🧪 Caja Laboratorio (beta)", value: "beta_crate" },
              { name: "🔬 Multi ×2 Beta", value: "multiplier_beta" },
              { name: "🧬 Seguro Total Beta", value: "insurance_full" },
              { name: "📦 Bóveda Beta", value: "beta_vault" },
              { name: "🩹 Protocolo Pity (beta)", value: "pity_protocol" },
              { name: "🐛 Debug Chips (dev)", value: "debug_chips" },
              { name: "👑 Bóveda del Core (dev)", value: "dev_vault" },
              { name: "💗 Corazón Darling (dev)", value: "darling_heart" },
              { name: "⚙️ Multi ×2 Dev", value: "dev_multiplier" },
              { name: "📜 Fragmento de Código (dev)", value: "source_code" },
            ),
        )
        .addIntegerOption((o) =>
          o
            .setName("cantidad")
            .setDescription("Cantidad (por defecto 1)")
            .setRequired(false)
            .setMinValue(1),
        )
        .addStringOption((o) =>
          o
            .setName("guild_id")
            .setDescription("Guild ID (vacío = guild actual)")
            .setRequired(false),
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    if (!isOwner(interaction.user.id)) {
      const denied = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setTitle("🚫 Acceso Denegado")
        .setDescription(
          "Este comando es exclusivo para la desarrolladora del bot.\n\nSi eres el owner, configura `OWNER_IDS` con tu Discord User ID.",
        )
        .setFooter({ text: `Tu ID: ${interaction.user.id}` });
      const { embed, files } = withDevImage(denied);
      await interaction.reply({
        embeds: [embed],
        files,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser("usuario", true);
    const guildId =
      interaction.options.getString("guild_id") ??
      interaction.guild?.id ??
      "";
    const botIcon = client.user?.displayAvatarURL();

    if (!guildId) {
      const e = new EmbedBuilder()
        .setColor(0xff2d6b)
        .setDescription(
          "❌ No se pudo determinar el Guild ID. Ejecútalo en un servidor o pasa el guild_id manualmente.",
        );
      const { embed, files } = withDevImage(e);
      await interaction.reply({
        embeds: [embed],
        files,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // ── give ──────────────────────────────────────────────────────────────────
    if (sub === "give") {
      const amount = interaction.options.getInteger("cantidad", true);
      const newBalance = await addBalance(guildId, target.id, amount);

      const { embed, files } = withDevImage(
        new EmbedBuilder()
          .setColor(0x00ff9f)
          .setAuthor({ name: "ZeroTwo Dev · Give", iconURL: botIcon })
          .setTitle("💰 Fichas Entregadas")
          .addFields(
            { name: "👤 Usuario", value: `${target}`, inline: true },
            {
              name: "💸 Cantidad añadida",
              value: `+\`${amount.toLocaleString()}\``,
              inline: true,
            },
            {
              name: "🏦 Nuevo saldo",
              value: `\`${newBalance.toLocaleString()}\` fichas`,
              inline: true,
            },
            { name: "🔑 Guild ID", value: `\`${guildId}\``, inline: false },
          )
          .setTimestamp(),
      );
      await interaction.editReply({ embeds: [embed], files });
      return;
    }

    // ── take ──────────────────────────────────────────────────────────────────
    if (sub === "take") {
      const amount = interaction.options.getInteger("cantidad", true);
      const eco = await getEconomy(guildId, target.id);

      const deducted = Math.min(amount, eco.balance);
      const newBalance = eco.balance - deducted;

      await db
        .update(economyTable)
        .set({ balance: newBalance })
        .where(
          and(
            eq(economyTable.guildId, guildId),
            eq(economyTable.userId, target.id),
          ),
        );

      const { embed, files } = withDevImage(
        new EmbedBuilder()
          .setColor(0xff9900)
          .setAuthor({ name: "ZeroTwo Dev · Take", iconURL: botIcon })
          .setTitle("💸 Fichas Retiradas")
          .addFields(
            { name: "👤 Usuario", value: `${target}`, inline: true },
            {
              name: "🔻 Cantidad retirada",
              value: `-\`${deducted.toLocaleString()}\``,
              inline: true,
            },
            {
              name: "🏦 Nuevo saldo",
              value: `\`${newBalance.toLocaleString()}\` fichas`,
              inline: true,
            },
          )
          .setTimestamp(),
      );
      await interaction.editReply({ embeds: [embed], files });
      return;
    }

    // ── set ───────────────────────────────────────────────────────────────────
    if (sub === "set") {
      const amount = interaction.options.getInteger("cantidad", true);
      const eco = await getEconomy(guildId, target.id);

      await db
        .update(economyTable)
        .set({ balance: amount })
        .where(
          and(
            eq(economyTable.guildId, guildId),
            eq(economyTable.userId, target.id),
          ),
        );

      const { embed, files } = withDevImage(
        new EmbedBuilder()
          .setColor(0xec4899)
          .setAuthor({ name: "ZeroTwo Dev · Set Balance", iconURL: botIcon })
          .setTitle("🎯 Saldo Establecido")
          .addFields(
            { name: "👤 Usuario", value: `${target}`, inline: true },
            {
              name: "📉 Saldo anterior",
              value: `\`${eco.balance.toLocaleString()}\``,
              inline: true,
            },
            {
              name: "📈 Nuevo saldo",
              value: `\`${amount.toLocaleString()}\``,
              inline: true,
            },
          )
          .setTimestamp(),
      );
      await interaction.editReply({ embeds: [embed], files });
      return;
    }

    // ── reset ─────────────────────────────────────────────────────────────────
    if (sub === "reset") {
      await db
        .update(economyTable)
        .set({
          balance: 500,
          totalEarned: 0,
          totalLost: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          streak: 0,
          lastDaily: null,
        })
        .where(
          and(
            eq(economyTable.guildId, guildId),
            eq(economyTable.userId, target.id),
          ),
        );

      const { embed, files } = withDevImage(
        new EmbedBuilder()
          .setColor(0xff2d6b)
          .setAuthor({ name: "ZeroTwo Dev · Reset", iconURL: botIcon })
          .setTitle("🔄 Economía Reseteada")
          .setDescription(
            `La cuenta de ${target} ha sido reseteada a **500 fichas** (saldo inicial).`,
          )
          .setTimestamp(),
      );
      await interaction.editReply({ embeds: [embed], files });
      return;
    }

    // ── info ──────────────────────────────────────────────────────────────────
    if (sub === "info") {
      const eco = await getEconomy(guildId, target.id);
      const inv = await getInventory(guildId, target.id);

      const invText =
        inv.length > 0
          ? inv.map((r) => `\`${r.itemId}\` × ${r.quantity}`).join("\n")
          : "*Inventario vacío*";

      const winRate =
        eco.gamesPlayed > 0
          ? ((eco.gamesWon / eco.gamesPlayed) * 100).toFixed(1)
          : "—";

      const { embed, files } = withDevImage(
        new EmbedBuilder()
          .setColor(0xec4899)
          .setAuthor({ name: "ZeroTwo Dev · User Info", iconURL: botIcon })
          .setTitle(`📊 ${target.username} — Economía`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            {
              name: "💰 Saldo",
              value: `\`${eco.balance.toLocaleString()}\` fichas`,
              inline: true,
            },
            {
              name: "📈 Total Ganado",
              value: `\`${eco.totalEarned.toLocaleString()}\``,
              inline: true,
            },
            {
              name: "📉 Total Perdido",
              value: `\`${eco.totalLost.toLocaleString()}\``,
              inline: true,
            },
            {
              name: "🃏 Partidas",
              value: `\`${eco.gamesPlayed}\` jugadas · \`${eco.gamesWon}\` ganadas`,
              inline: true,
            },
            { name: "🎯 Win Rate", value: `\`${winRate}%\``, inline: true },
            {
              name: "🔥 Racha",
              value: `\`${eco.streak}\` victorias`,
              inline: true,
            },
            {
              name: "📅 Último Daily",
              value: eco.lastDaily
                ? `<t:${Math.floor(eco.lastDaily.getTime() / 1000)}:R>`
                : "*Nunca*",
              inline: true,
            },
            { name: "🔑 Guild ID", value: `\`${guildId}\``, inline: true },
            { name: "🆔 User ID", value: `\`${target.id}\``, inline: true },
            { name: "🎒 Inventario", value: invText, inline: false },
          )
          .setTimestamp(),
      );
      await interaction.editReply({ embeds: [embed], files });
      return;
    }

    // ── additem ───────────────────────────────────────────────────────────────
    if (sub === "additem") {
      const itemId = interaction.options.getString("item", true);
      const qty = interaction.options.getInteger("cantidad") ?? 1;

      await addItem(guildId, target.id, itemId, qty);

      const { embed, files } = withDevImage(
        new EmbedBuilder()
          .setColor(0xffd700)
          .setAuthor({ name: "ZeroTwo Dev · Add Item", iconURL: botIcon })
          .setTitle("🎒 Ítem Añadido")
          .addFields(
            { name: "👤 Usuario", value: `${target}`, inline: true },
            {
              name: "🎁 Ítem",
              value: `\`${itemId}\` × ${qty}`,
              inline: true,
            },
          )
          .setTimestamp(),
      );
      await interaction.editReply({ embeds: [embed], files });
      return;
    }
  },
};

export default command;
