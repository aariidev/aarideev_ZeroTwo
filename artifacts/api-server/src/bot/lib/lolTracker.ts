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
  if (!key) throw new Error("RIOT_API_KEY not set in environment");
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
