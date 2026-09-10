import { writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL');

const DB_NAME = 'sectionxscoreboard-preview';
const WRANGLER_CONFIG = 'wrangler.jsonc';
const CHUNK_SIZE = 125;

const tables = [
  { name:'playoff_tournaments', columns:['id','sport_id','season_id','class','name','status','created_at'] },
  { name:'playoff_games', columns:['id','tournament_id','round','position','seed_home','seed_away','home_name','away_name','home_score','away_score','status','game_date','game_time','location','created_at','game_id'] },
];

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (value instanceof Date) return `'${value.toISOString().replaceAll("'", "''")}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildUpsert(table,row) {
  const vals = table.columns.map(c=>sqlValue(row[c]));
  const updates = table.columns.filter(c=>c!=='id').map(c=>`\"${c}\"=excluded.\"${c}\"`).join(',');
  return `INSERT INTO \"${table.name}\" (${table.columns.map(c=>`\"${c}\"`).join(',')}) VALUES (${vals.join(',')}) ON CONFLICT(\"id\") DO UPDATE SET ${updates};`;
}

function executeSqlFile(path) {
  execFileSync('npx',['wrangler','d1','execute',DB_NAME,'--remote','--config',WRANGLER_CONFIG,'--file',path,'--yes'],{stdio:'inherit',env:process.env});
}

const client = new Client({ connectionString, ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:15000, query_timeout:45000, statement_timeout:45000 });

try {
  console.log('[D1 playoffs] Connecting to Supabase read-only migration role...');
  await client.connect();
  const identity = await client.query(`select current_user as current_user, current_setting('default_transaction_read_only') as default_transaction_read_only`);
  const info = identity.rows[0];
  if (!String(info.current_user).startsWith('cloudflare_migration_reader')) throw new Error(`Unexpected database user: ${info.current_user}`);
  if (info.default_transaction_read_only !== 'on') throw new Error('Migration reader is not read-only; refusing to continue.');
  await client.query('BEGIN READ ONLY');

  for (const table of tables) {
    const result = await client.query(`SELECT ${table.columns.map(c=>`\"${c}\"`).join(',')} FROM public.\"${table.name}\" ORDER BY \"id\" ASC`);
    console.log(`[D1 playoffs] ${table.name}: ${result.rows.length} rows`);
    for (let i=0;i<result.rows.length;i+=CHUNK_SIZE) {
      const file = `/tmp/sectionx-playoffs-${table.name}-${i}.sql`;
      writeFileSync(file,['PRAGMA foreign_keys = ON;',...result.rows.slice(i,i+CHUNK_SIZE).map(row=>buildUpsert(table,row))].join('\n'),'utf8');
      try { executeSqlFile(file); } finally { try { unlinkSync(file); } catch {} }
    }
  }

  await client.query('ROLLBACK');
  console.log('[D1 playoffs] PASS: copied playoff brackets into preview D1.');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('[D1 playoffs] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(()=>{});
}
