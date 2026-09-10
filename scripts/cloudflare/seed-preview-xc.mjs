import { writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL');

const DB_NAME = 'sectionxscoreboard-preview';
const WRANGLER_CONFIG = 'wrangler.jsonc';
const CHUNK_SIZE = 150;

const tables = [
  {
    name: 'cross_country_meets',
    columns: ['id','season_id','meet_name','meet_date','meet_time','location','meet_type','status','notes','source','source_event_key','source_payload','created_at','updated_at'],
    booleans: new Set()
  },
  {
    name: 'cross_country_team_results',
    columns: ['id','meet_id','sport_id','team_id','external_opponent_id','team_score','finish_place','is_section_x','created_at'],
    booleans: new Set(['is_section_x'])
  },
  {
    name: 'cross_country_dual_results',
    columns: ['id','meet_id','sport_id','team_a_id','team_b_id','team_a_score','team_b_score','outcome_a','source','notes','created_at','updated_at'],
    booleans: new Set()
  }
];

function sqlValue(value, isBoolean = false) {
  if (value === null || value === undefined) return 'NULL';
  if (isBoolean) return value ? '1' : '0';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return `'${value.toISOString().replaceAll("'", "''")}'`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildUpsert(table, row) {
  const values = table.columns.map((column) => sqlValue(row[column], table.booleans.has(column)));
  const updates = table.columns.filter((column) => column !== 'id')
    .map((column) => `\"${column}\"=excluded.\"${column}\"`).join(',');
  return `INSERT INTO \"${table.name}\" (${table.columns.map((column) => `\"${column}\"`).join(',')}) VALUES (${values.join(',')}) ON CONFLICT(id) DO UPDATE SET ${updates};`;
}

function executeSqlFile(path) {
  execFileSync('npx', ['wrangler','d1','execute',DB_NAME,'--remote','--config',WRANGLER_CONFIG,'--file',path,'--yes'], { stdio: 'inherit', env: process.env });
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 30000,
  statement_timeout: 30000,
});

try {
  console.log('[XC seed] Connecting with temporary read-only migration role...');
  await client.connect();
  const identity = await client.query(`SELECT current_user AS current_user, current_setting('default_transaction_read_only') AS default_transaction_read_only`);
  const info = identity.rows[0];
  if (!String(info.current_user).startsWith('cloudflare_migration_reader')) throw new Error(`Unexpected database user: ${info.current_user}`);
  if (info.default_transaction_read_only !== 'on') throw new Error('Migration reader is not read-only; refusing to seed.');
  await client.query('BEGIN READ ONLY');

  for (const table of tables) {
    const select = table.columns.map((column) => `\"${column}\"`).join(',');
    const result = await client.query(`SELECT ${select} FROM public.\"${table.name}\" ORDER BY id ASC`);
    console.log(`[XC seed] ${table.name}: fetched ${result.rows.length} rows`);
    for (let i = 0; i < result.rows.length; i += CHUNK_SIZE) {
      const file = `/tmp/sectionx-${table.name}-${i}.sql`;
      writeFileSync(file, ['PRAGMA foreign_keys = ON;', ...result.rows.slice(i, i + CHUNK_SIZE).map((row) => buildUpsert(table, row))].join('\n'), 'utf8');
      try { executeSqlFile(file); } finally { try { unlinkSync(file); } catch {} }
      console.log(`[XC seed] ${table.name}: copied ${Math.min(i + CHUNK_SIZE, result.rows.length)}/${result.rows.length}`);
    }
  }

  await client.query('ROLLBACK');
  console.log('[XC seed] PASS: source stayed read-only; preview D1 updated.');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('[XC seed] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
