import {
  SlashCommandBuilder,
  EmbedBuilder,
  Client,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../types.js";

const DD_CHAMPION_ICON_BASE = "https://ddragon.leagueoflegends.com/cdn/latest/img/champion";
const DD_CHAMPION_SPLASH_BASE = "https://ddragon.leagueoflegends.com/cdn/img/champion/splash";
const DD_PROFILE_ICON_BASE = "https://ddragon.leagueoflegends.com/cdn/latest/img/profileicon";

function normalizeChampionName(champion: any) {
  const raw = champion?.championName ?? champion?.id ?? champion?.name ?? champion?.key;
  if (!raw) return null;
  return String(raw)
    .replace(/\s+/g, "")
    .replace(/&/g, "And")
    .replace(/['.\/:\-]/g, "")
    .replace(/[^A-Za-z0-9]/g, "");
}

function championIconUrl(champion: any) {
  const name = normalizeChampionName(champion);
  return name ? `${DD_CHAMPION_ICON_BASE}/${name}.png` : null;
}

function championSplashUrl(champion: any) {
  const name = normalizeChampionName(champion);
  return name ? `${DD_CHAMPION_SPLASH_BASE}/${name}_0.jpg` : null;
}

function champSummaryLine(champion: any) {
  const name = champion?.name ?? champion?.championName ?? champion?.key ?? "Unknown";
  const wins = Number(champion?.wins ?? champion?.w ?? 0);
  const losses = Number(champion?.losses ?? champion?.l ?? 0);
  const games = wins + losses;
  const winRate = games ? Math.round((wins / games) * 100) : null;
  const iconUrl = championIconUrl(champion);
  const label = iconUrl ? `[${name}](${iconUrl})` : String(name);
  return `${label} — ${wins}W/${losses}L${winRate != null ? ` (${winRate}% WR)` : ""}`;
}

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

          const profileIconUrl = summ.profileIconId ? `${DD_PROFILE_ICON_BASE}/${summ.profileIconId}.png` : undefined;
          const emb = new EmbedBuilder()
            .setColor(0x00e5ff)
            .setTitle("Summoner trackeado")
            .setDescription(`**${summ.name}** (${region})\nNivel ${summ.summonerLevel}`)
            .setThumbnail(profileIconUrl ?? null)
            .addFields(
              { name: "Summoner ID", value: `\`${summ.id}\``, inline: true },
              { name: "Nivel", value: `${summ.summonerLevel}`, inline: true },
              { name: "Región", value: region.toUpperCase(), inline: true },
            )
            .setFooter({ text: `Zero Two · LOL Tracker` })
            .setTimestamp();
          if (note) {
            emb.addFields({ name: "Nota", value: note, inline: false });
          }

          await interaction.editReply({ embeds: [emb] });
        } catch (err: any) {
          await interaction.editReply({ content: `Error obteniendo summoner: ${err.message}` });
        }
      } else if (sub === "remove") {
        const id = interaction.options.getInteger("id", true);
        await interaction.deferReply({ ephemeral: true });
        const { lolTrackedTable } = (await import("@workspace/db")) as any;
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

          // Attempt to gather Riot-based ranked + recent match stats if API key is available.
          let ranked: any = null;
          let recent: any = null;
          let opgg: any = null;
          try {
            const lib = await import("../../lib/lolTracker.js");
            if (process.env.RIOT_API_KEY) {
              try {
                ranked = await lib.fetchRankedBySummonerId(region, summ.id);
              } catch (_) {
                ranked = null;
              }
              try {
                recent = summ.puuid ? await lib.fetchRecentWinRate(summ.puuid, region, 20) : null;
              } catch (_) {
                recent = null;
              }
              // still try OP.GG for top-champions/enriched data if available
              try {
                opgg = await lib.fetchOpggAi(region, name);
              } catch (_) {
                opgg = null;
              }
            } else {
              // No Riot key: fall back to OP.GG only
              try {
                opgg = await lib.fetchOpggAi(region, name);
              } catch (_) {
                opgg = null;
              }
            }
          } catch (_) {
            // ignore any helper failures
          }

          const profileIconUrl = summ.profileIconId ? `${DD_PROFILE_ICON_BASE}/${summ.profileIconId}.png` : undefined;
          const opggUrl = `https://op.gg/lol/summoners/${region}/${encodeURIComponent(name)}`;
          const emb = new EmbedBuilder()
            .setColor(0x22c55e)
            .setTitle(`${summ.name} — ${region.toUpperCase()}`)
            .setAuthor({ name: "Zero Two · LOL Tracker", iconURL: profileIconUrl ?? undefined, url: opggUrl })
            .setThumbnail(profileIconUrl ?? null)
            .setDescription(`Nivel ${summ.summonerLevel}`);
 
          // Basic IDs
          emb.addFields({ name: "Summoner ID", value: `\`${summ.id}\``, inline: true });
          emb.addFields({ name: "Account ID", value: summ.accountId ? `\`${summ.accountId}\`` : "N/A", inline: true });
          emb.addFields({ name: "Region", value: region.toUpperCase(), inline: true });
 
          // Rank / LP / Record using Riot API when present, otherwise OP.GG fallback.
          let rankLabel = "N/A";
          let recordLabel = "N/A";
          if (ranked) {
            rankLabel = `${ranked.tier ?? ""} ${ranked.rank ?? ""}`.trim() || "N/A";
            recordLabel = `${ranked.leaguePoints ?? 0} LP — ${ranked.wins ?? 0}W/${ranked.losses ?? 0}L`;
          } else if (opgg) {
            const queue = opgg?.ranked?.solo ?? opgg?.profile ?? opgg?.queue?.solo ?? null;
            const wins = opgg?.profile?.wins ?? opgg?.recent?.wins ?? null;
            const losses = opgg?.profile?.losses ?? opgg?.recent?.losses ?? null;
            rankLabel = queue ? `${queue.tier ?? queue.rank ?? queue}` : "N/A";
            if (queue?.lp != null) {
              recordLabel = `${queue.lp} LP — ${queue.wins ?? wins ?? 0}W/${queue.losses ?? losses ?? 0}L`;
            } else if (wins != null && losses != null) {
              recordLabel = `${wins}W/${losses}L`;
            }
          }
          emb.addFields({ name: "Rank", value: rankLabel, inline: true });
          emb.addFields({ name: "LP / Record", value: recordLabel, inline: true });
 
          if (recent && recent.played) {
            emb.addFields({ name: `Últimas ${recent.played}`, value: `${recent.wins}W/${recent.played - recent.wins}L — ${recent.winRate}% winrate`, inline: true });
          }
 
          if (opgg) {
            const champs = opgg?.champions ?? opgg?.topChampions ?? null;
            if (Array.isArray(champs) && champs.length) {
              const topChamps = champs.slice(0, 4).map(champSummaryLine);
              emb.addFields({ name: "Top champs", value: topChamps.join("\n"), inline: false });
              const splash = championSplashUrl(champs[0]);
              if (splash) emb.setImage(splash);
            }
            emb.addFields({ name: "OP.GG", value: opggUrl, inline: false });
          }
 
          emb.setFooter({ text: "Datos reales de Riot / OP.GG" });
          emb.setTimestamp();
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
