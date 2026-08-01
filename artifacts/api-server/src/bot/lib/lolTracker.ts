import { db } from "@workspace/db";
import { fetch } from "undici";
import { eq } from "drizzle-orm";

export type RiotSummoner = {
  id: string;
  accountId: string;
  puuid: string;
  name: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
};

function riotBaseForRegion(region: string) {
  // region should be platform routing value like na1, euw1, etc.
  return `https://${region}.api.riotgames.com`;
}

export async function fetchSummonerByName(region: string, name: string) {
  const key = process.env.RIOT_API_KEY;
  if (key) {
    // Use official Riot API when API key is available
    const base = riotBaseForRegion(region);
    const url = `${base}/lol/summoner/v4/summoners/by-name/${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      headers: { "X-Riot-Token": key },
    });
    if (!res.ok) {
      const txt = await res.text();
      const err = new Error(`Riot API error ${res.status}: ${txt}`);
      // attach status for caller
      (err as any).status = res.status;
      throw err;
    }
    const json = (await res.json()) as RiotSummoner;
    return json;
  }

  // Fallback: use OP.GG ai.json endpoint (no API key required)
  // Note: OP.GG's JSON shape differs from Riot's; return a best-effort RiotSummoner-like object
  const opggUrl = `https://op.gg/lol/summoners/${region}/${encodeURIComponent(name)}/ai.json`;
  const res = await fetch(opggUrl, { headers: { "User-Agent": "DiscordBot/1.0 (OP.GG fallback)" } });
  if (!res.ok) {
    // If OP.GG has no AI snapshot for this summoner, return a best-effort RiotSummoner so tracking can continue.
    if (res.status === 404) {
      return {
        id: `${region}:${name}`,
        accountId: "",
        puuid: "",
        name: name,
        profileIconId: 0,
        revisionDate: Date.now(),
        summonerLevel: 0,
      } as RiotSummoner;
    }

    const txt = await res.text();
    const err = new Error(`OP.GG fetch error ${res.status}: ${txt}`);
    (err as any).status = res.status;
    throw err;
  }
  const j = (await res.json()) as any;
  // OP.GG's payload may nest data under several keys; try common locations
  const opSumm = j?.player ?? j?.summoner ?? j;
  const summonerId = opSumm?.id ?? `${region}:${name}`;

  const summoner: RiotSummoner = {
    id: String(summonerId),
    accountId: opSumm?.accountId ?? "",
    puuid: opSumm?.puuid ?? "",
    name: opSumm?.name ?? name,
    profileIconId: Number(opSumm?.profileIconId ?? 0),
    revisionDate: Number(opSumm?.revisionDate ?? Date.now()),
    summonerLevel: Number(opSumm?.summonerLevel ?? opSumm?.level ?? 0),
  };

  return summoner;
}

export async function fetchOpggAi(region: string, name: string) {
  const url = `https://op.gg/lol/summoners/${region}/${encodeURIComponent(name)}/ai.json`;
  const res = await fetch(url, { headers: { "User-Agent": "DiscordBot/1.0 (opgg-fetch)" } });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`OP.GG ai.json error ${res.status}: ${txt}`);
    (err as any).status = res.status;
    throw err;
  }
  const json = await res.json();
  return json;
}

// Helper: map platform routing value (e.g. 'na1', 'euw1') to match-v5 continent routing (americas/europe/asia)
function regionToContinent(region: string) {
  const r = region.toLowerCase();
  const americas = ["na1", "br1", "la1", "la2", "oc1"];
  const europe = ["euw1", "eun1", "tr1", "ru"];
  if (americas.includes(r) || r.startsWith("na") || r.startsWith("la") || r === "oc1") return "americas";
  if (europe.includes(r) || r.startsWith("euw") || r.startsWith("eun") || r === "tr1" || r === "ru") return "europe";
  return "asia";
}

export async function fetchRankedBySummonerId(region: string, summonerId: string) {
  const key = process.env.RIOT_API_KEY;
  if (!key) return null;
  const base = riotBaseForRegion(region);
  const url = `${base}/lol/league/v4/entries/by-summoner/${summonerId}`;
  const res = await fetch(url, { headers: { "X-Riot-Token": key } });
  if (!res.ok) return null;
  const arr = (await res.json()) as any[];
  const solo = arr.find((q) => q.queueType === "RANKED_SOLO_5x5") ?? arr[0] ?? null;
  return solo;
}

export async function fetchRecentWinRate(puuid: string, region: string, count = 20) {
  const key = process.env.RIOT_API_KEY;
  if (!key || !puuid) return null;
  const continent = regionToContinent(region);
  const idsRes = await fetch(`https://${continent}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`, {
    headers: { "X-Riot-Token": key },
  });
  if (!idsRes.ok) return null;
  const ids = (await idsRes.json()) as string[];
  let wins = 0;
  let played = 0;
  for (const id of ids) {
    try {
      const mres = await fetch(`https://${continent}.api.riotgames.com/lol/match/v5/matches/${id}`, {
        headers: { "X-Riot-Token": key },
      });
      if (!mres.ok) continue;
      const m = (await mres.json()) as any;
      const part = (m.info?.participants ?? []).find((p: any) => p.puuid === puuid);
      if (part) {
        played++;
        if (part.win) wins++;
      }
    } catch (e) {
      // ignore individual match errors
      continue;
    }
  }
  return { played, wins, winRate: played ? Math.round((wins / played) * 100) : null };
}

// Lightweight wrapper to store lastData in DB (table added in lib/db schema)
export async function upsertTrackedSummoner(row: {
  summonerId: string;
  name: string;
  region: string;
  discordUserId: string;
  note?: string | null;
  lastData?: unknown;
}) {
  const { lolTrackedTable } = await import("@workspace/db");
  const existing = await db
    .select()
    .from(lolTrackedTable)
    .where(eq(lolTrackedTable.summonerId, row.summonerId))
    .limit(1);

  const now = new Date();
  if (existing[0]) {
    await db
      .update(lolTrackedTable)
      .set({
        name: row.name,
        region: row.region,
        discordUserId: row.discordUserId,
        note: row.note ?? existing[0].note,
        lastData: row.lastData ? JSON.stringify(row.lastData) : existing[0].lastData,
        lastFetchedAt: now,
      })
      .where(eq(lolTrackedTable.id, existing[0].id));
    return { updated: true, id: existing[0].id };
  }

  const ids = await db
    .insert(lolTrackedTable)
    .values({
      summonerId: row.summonerId,
      name: row.name,
      region: row.region,
      discordUserId: row.discordUserId,
      note: row.note ?? null,
      lastData: row.lastData ? JSON.stringify(row.lastData) : null,
      lastFetchedAt: now,
    })
    .$returningId();

  return { created: true, id: ids[0]?.id };
}

export async function removeTrackedById(id: number) {
  const { lolTrackedTable } = await import("@workspace/db");
  await db.delete(lolTrackedTable).where(eq(lolTrackedTable.id, id));
}

export async function listTrackedForUser(discordUserId: string) {
  const { lolTrackedTable } = await import("@workspace/db");
  const rows = await db.select().from(lolTrackedTable).where(eq(lolTrackedTable.discordUserId, discordUserId));
  return rows;
}
