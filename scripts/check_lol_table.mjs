import { pool } from "../lib/db/src/index.js";

async function main(){
  const conn = await pool.getConnection();
  try{
    const [createRows] = await conn.query("SHOW CREATE TABLE lol_tracked");
    console.log('SHOW CREATE TABLE result:');
    console.log(JSON.stringify(createRows, null, 2));

    const [countRows] = await conn.query("SELECT COUNT(*) as cnt FROM lol_tracked");
    console.log('COUNT:', JSON.stringify(countRows, null, 2));
  } finally{
    conn.release();
  }
}

main().catch(err=>{ console.error(err); process.exit(1); });
