import mysql from 'mysql2/promise';
import { databaseUrl, maskUrl } from '../lib/db/load-env.mjs';

async function main(){
  const url = databaseUrl();
  const conn = await mysql.createConnection({ uri: url });
  console.log('Connected to', maskUrl(url));
  try{
    const [createRows] = await conn.query('SHOW CREATE TABLE lol_tracked');
    console.log('SHOW CREATE TABLE lol_tracked:');
    console.log(createRows[0]);

    const [countRows] = await conn.query('SELECT COUNT(*) as cnt FROM lol_tracked');
    console.log('COUNT:', countRows[0]);
  } finally{
    await conn.end();
  }
}

main().catch(err=>{ console.error(err); process.exit(1); });
