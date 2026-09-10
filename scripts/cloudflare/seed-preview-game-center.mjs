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
  { name:'game_period_scores', columns:['id','game_id','team_side','period_number','period_label','score','created_at','updated_at'], booleans:new Set() },
  { name:'stat_definitions', columns:['id','sport_id','stat_key','label','category','value_type','scope','unit','lower_is_better','sort_order','active','created_at'], booleans:new Set(['lower_is_better','active']) },
  { name:'game_team_stats', columns:['id','game_id','team_side','stat_definition_id','value_numeric','value_text','source_type','source_name','verified','created_at','updated_at'], booleans:new Set(['verified']) },
  { name:'game_athlete_stats', columns:['id','game_id','athlete_id','team_id','stat_definition_id','value_numeric','value_text','source_type','source_name','verified','created_at','updated_at'], booleans:new Set(['verified']) },
  { name:'photo_athletes', columns:['photo_id','athlete_id','created_at'], booleans:new Set(), key:'photo_id,athlete_id' },
];

function sqlValue(value, isBoolean=false) {
  if (value === null || value === undefined) return 'NULL';
  if (isBoolean) return value ? '1' : '0';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return `'${value.toISOString().replaceAll("'", "''")}'`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildUpsert(table,row) {
  const vals = table.columns.map(c=>sqlValue(row[c], table.booleans.has(c)));
  const conflictCols = (table.key || 'id').split(',');
  const updates = table.columns.filter(c=>!conflictCols.includes(c)).map(c=>`\"${c}\"=excluded.\"${c}\"`).join(',');
  const conflict = conflictCols.map(c=>`\"${c}\"`).join(',');
  return `INSERT INTO \"${table.name}\" (${table.columns.map(c=>`\"${c}\"`).join(',')}) VALUES (${vals.join(',')}) ON CONFLICT(${conflict}) DO UPDATE SET ${updates};`;
}

function executeSqlFile(path) {
  execFileSync('npx',['wrangler','d1','execute',DB_NAME,'--remote','--config',WRANGLER_CONFIG,'--file',path,'--yes'],{stdio:'inherit',env:process.env});
}

const client = new Client({ connectionString, ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:15000, query_timeout:45000, statement_timeout:45000 });

try {
  console.log('[D1 game center] Connecting to Supabase read-only migration role...');
  await client.connect();
  const identity = await client.query(`select current_user as current_user, current_setting('default_transaction_read_only') as default_transaction_read_only`);
  const info = identity.rows[0];
  if (!String(info.current_user).startsWith('cloudflare_migration_reader')) throw new Error(`Unexpected database user: ${info.current_user}`);
  if (info.default_transaction_read_only !== 'on') throw new Error('Migration reader is not read-only; refusing to continue.');
  await client.query('BEGIN READ ONLY');

  for (const table of tables) {
    const select = table.columns.map(c=>`\"${c}\"`).join(',');
    const order = (table.key || 'id').split(',').map(c=>`\"${c}\"`).join(',');
    const result = await client.query(`SELECT ${select} FROM public.\"${table.name}\" ORDER BY ${order} ASC`);
    console.log(`[D1 game center] ${table.name}: ${result.rows.length} rows`);
    for (let i=0;i<result.rows.length;i+=CHUNK_SIZE) {
      const file = `/tmp/sectionx-game-center-${table.name}-${i}.sql`;
      writeFileSync(file,['PRAGMA foreign_keys = ON;',...result.rows.slice(i,i+CHUNK_SIZE).map(row=>buildUpsert(table,row))].join('\n'),'utf8');
      try { executeSqlFile(file); } finally { try { unlinkSync(file); } catch {} }
    }
  }

  await client.query('ROLLBACK');
  console.log('[D1 game center] PASS: copied public Game Center data into preview D1.');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('[D1 game center] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(()=>{});
}
