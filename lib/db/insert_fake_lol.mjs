import mysql from 'mysql2/promise';
import { databaseUrl, maskUrl } from './load-env.mjs';

async function main(){
  const url = databaseUrl();
  const conn = await mysql.createConnection({ uri: url });
  try{
    const [res] = await conn.execute(`INSERT INTO lol_tracked (summoner_id, name, region, discord_user_id, note, last_data, last_fetched_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`, ['fake-12345', 'TestSummoner', 'euw1', 'manual-test', 'Inserción de prueba (simulada)', JSON.stringify({ simulated: true })]);
    console.log('Inserted id:', res.insertId ?? res[0]?.insertId);
    const [rows] = await conn.query('SELECT id, summoner_id, name, region, discord_user_id, created_at FROM lol_tracked ORDER BY id DESC LIMIT 5');
    console.log('Latest rows:', rows);
  } finally{
    await conn.end();
  }
}

main().catch(err=>{ console.error(err); process.exit(1); });
