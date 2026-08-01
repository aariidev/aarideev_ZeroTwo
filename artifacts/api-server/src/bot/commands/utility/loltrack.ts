import {
  SlashCommandBuilder,
  EmbedBuilder,
  Client,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("loltrack")
    .setDescription("🔍 Trackear cuentas de League of Legends para notificaciones/consulta")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Añadir un summoner para trackear")
        .addStringOption((o) => o.setName("region").setDescription("Región (e.g. na1, euw1)").setRequired(true))
        .addStringOption((o) => o.setName("name").setDescription("Nombre del summoner").setRequired(true))
        .addStringOption((o) => o.setName("note").setDescription("Nota opcional")),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Eliminar un summoner trackeado por su id")
        .addIntegerOption((o) => o.setName("id").setDescription("ID de tracking").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("list")
        .setDescription("Listar summoners trackeados por el usuario"),
    )
    .addSubcommand((s) =>
      s
        .setName("info")
        .setDescription("Obtener info en vivo de un summoner (consulta Riot API)")
        .addStringOption((o) => o.setName("region").setDescription("Región (e.g. na1)").setRequired(true))
        .addStringOption((o) => o.setName("name").setDescription("Nombre del summoner").setRequired(true)),
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction, client: Client) {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === "add") {
        const region = interaction.options.getString("region", true);
        const name = interaction.options.getString("name", true);
        const note = interaction.options.getString("note") ?? null;

        await interaction.deferReply({ ephemeral: true });
        const { fetchSummonerByName, upsertTrackedSummoner } = await import("../../lib/lolTracker.js");
        try {
          const summ = await fetchSummonerByName(region, name);
          const res = await upsertTrackedSummoner({
            summonerId: summ.id,
            name: summ.name,
            region,
            discordUserId: interaction.user.id,
            note,
            lastData: summ,
          });

          const emb = new EmbedBuilder()
            .setColor(0x00e5ff)
            .setTitle("Summoner trackeado")
            .setDescription(`**${summ.name}** (${region})`) 
            .addFields(
              { name: "SummonerID", value: `
\\
\\`${summ.id}\``, inline: false },
            )
            .setFooter({ text: `Zero Two · LOL Tracker` });

          await interaction.editReply({ embeds: [emb] });
        } catch (err: any) {
          await interaction.editReply({ content: `Error obteniendo summoner: ${err.message}` });
        }
      } else if (sub === "remove") {
        const id = interaction.options.getInteger("id", true);
        await interaction.deferReply({ ephemeral: true });
        const { lolTrackedTable } = await import("@workspace/db");
        const { removeTrackedById } = await import("../../lib/lolTracker.js");
        await removeTrackedById(id as number);
        await interaction.editReply({ content: `✅ Tracking con id ${id} eliminado.` });
      } else if (sub === "list") {
        await interaction.deferReply({ ephemeral: true });
        const { listTrackedForUser } = await import("../../lib/lolTracker.js");
        const rows = await listTrackedForUser(interaction.user.id);
        if (!rows.length) {
          await interaction.editReply({ content: "No tienes summoners trackeados." });
          return;
        }
        const emb = new EmbedBuilder().setTitle("Summoners trackeados").setColor(0xff2d6b);
        for (const r of rows) {
          emb.addFields({ name: `#${r.id} — ${r.name} (${r.region})`, value: `Nota: ${r.note ?? "-"}\nÚltimo fetch: ${r.lastFetchedAt ?? "-"}` });
        }
        await interaction.editReply({ embeds: [emb] });
      } else if (sub === "info") {
        const region = interaction.options.getString("region", true);
        const name = interaction.options.getString("name", true);
        await interaction.deferReply({ ephemeral: true });
        const { fetchSummonerByName } = await import("../../lib/lolTracker.js");
        try {
          const summ = await fetchSummonerByName(region, name);
          const emb = new EmbedBuilder()
            .setTitle(`${summ.name} — ${region}`)
            .setColor(0x22c55e)
            .addFields(
              { name: "Summoner ID", value: `
\\
\\`${summ.id}\``, inline: true },
              { name: "Account ID", value: `
\\
\\`${summ.accountId}\``, inline: true },
              { name: "PUUID", value: `
\\
\\`${summ.puuid}\``, inline: false },
              { name: "Nivel", value: `
\\
\\`${summ.summonerLevel}\``, inline: true },
            )
            .setTimestamp();
          await interaction.editReply({ embeds: [emb] });
        } catch (err: any) {
          await interaction.editReply({ content: `Error al consultar Riot API: ${err.message}` });
        }
      }
    } catch (err) {
      console.error(err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Error interno al procesar el comando.", ephemeral: true });
      } else if (interaction.deferred) {
        await interaction.editReply({ content: "Error interno al procesar el comando." });
      }
    }
  },
};

export default command;
