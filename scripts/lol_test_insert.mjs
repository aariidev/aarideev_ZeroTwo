import { databaseUrl, maskUrl } from '../lib/db/load-env.mjs';
import mysql from 'mysql2/promise';

async function tryFetch(apiKey, region, name) {
  const base = `https://${region}.api.riotgames.com`;
  const url = `${base}/lol/summoner/v4/summoners/by-name/${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
    const txt = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, text: txt };
    }
    const json = JSON.parse(txt);
    return { ok: true, json };
  } catch (err) {
    return { ok: false, err: err.message };
  }
}

async function main() {
  const apiKey = process.argv[2];
  if (!apiKey) {
    console.error('Usage: node scripts/lol_test_insert.mjs <RIOT_API_KEY> [region] [name]');
    process.exit(1);
  }
  const regionArg = process.argv[3];
  const nameArg = process.argv[4];

  const candidates = [];
  if (regionArg && nameArg) candidates.push({ region: regionArg, name: nameArg });
  // common candidates
  candidates.push({ region: 'kr', name: 'Faker' });
  candidates.push({ region: 'euw1', name: 'Faker' });
  candidates.push({ region: 'na1', name: 'Doublelift' });
  candidates.push({ region: 'euw1', name: 'Rekkles' });
  candidates.push({ region: 'euw1', name: 'TestSummoner' });

  let found = null;
  for (const c of candidates) {
    console.log(`Probing ${c.name} @ ${c.region}...`);
    const r = await tryFetch(apiKey, c.region, c.name);
    if (r.ok) {
      found = { region: c.region, name: c.name, summ: r.json };
      console.log(`Found summoner ${c.name} @ ${c.region}`);
      break;
    } else {
      console.log(`  not ok:`, r.status ?? r.err);
    }
  }

  if (!found) {
    console.error('No summoner found from candidates. Exiting.');
    process.exit(2);
  }

  // Insert into DB
  const url = databaseUrl();
  const conn = await mysql.createConnection({ uri: url });
  try {
    const s = found.summ;
    const [res] = await conn.execute(`INSERT INTO lol_tracked (summoner_id, name, region, discord_user_id, note, last_data, last_fetched_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`, [s.id, s.name, found.region, 'manual-test', 'Prueba vía script con clave proporcionada', JSON.stringify(s)]);
    console.log('Inserted row id:', res.insertId ?? res[0]);

    const [rows] = await conn.query('SELECT id, summoner_id, name, region, discord_user_id, created_at FROM lol_tracked ORDER BY id DESC LIMIT 5');
    console.log('Latest rows:', rows);
  } finally {
    await conn.end();
  }
}

main().catch(err=>{ console.error(err); process.exit(1); });
