import { db } from "@workspace/db";
import fetch from "node-fetch";

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
    const txt = await res.text();
    const err = new Error(`OP.GG fetch error ${res.status}: ${txt}`);
    (err as any).status = res.status;
    throw err;
  }
  const j = await res.json();
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
    .where(lolTrackedTable.summonerId.eq(row.summonerId))
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
      .where(lolTrackedTable.id.eq(existing[0].id));
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
  await db.delete(lolTrackedTable).where(lolTrackedTable.id.eq(id));
}

export async function listTrackedForUser(discordUserId: string) {
  const { lolTrackedTable } = await import("@workspace/db");
  const rows = await db.select().from(lolTrackedTable).where(lolTrackedTable.discordUserId.eq(discordUserId));
  return rows;
}
