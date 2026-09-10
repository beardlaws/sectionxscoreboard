import { writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL');
}

const DB_NAME = 'sectionxscoreboard-preview';
const WRANGLER_CONFIG = 'wrangler.jsonc';
const CHUNK_SIZE = 150;

const tables = [
  {
    name: 'schools',
    columns: ['id','school_name','mascot','city','county','primary_color','secondary_color','alias','slug','active','logo_url','is_section_x','created_at'],
    booleans: new Set(['active','is_section_x'])
  },
  {
    name: 'sports',
    columns: ['id','sport_name','gender','season_type','homepage_priority','active_public','slug','created_at'],
    booleans: new Set(['active_public'])
  },
  {
    name: 'seasons',
    columns: ['id','name','year','season_type','is_active','start_date','end_date','created_at'],
    booleans: new Set(['is_active'])
  },
  {
    name: 'external_opponents',
    columns: ['id','name','slug','city','state','section','is_section_x','created_at'],
    booleans: new Set(['is_section_x'])
  },
  {
    name: 'teams',
    columns: ['id','school_id','sport_id','team_name','slug','level','active','created_at'],
    booleans: new Set(['active'])
  },
  {
    name: 'team_seasons',
    columns: ['id','team_id','season_id','class','division','active_for_season','display_team_name','is_coop','coop_schools','notes','btm_override'],
    booleans: new Set(['active_for_season','is_coop'])
  },
  {
    name: 'games',
    // import_id is intentionally omitted because import_logs is not part of the core copy yet.
    columns: ['id','season_id','sport_id','home_team_id','away_team_id','external_home_opponent_id','external_away_opponent_id','game_date','game_time','location','home_score','away_score','status','verification_status','source','notes','featured','game_of_the_night','rescheduled_date','doubleheader_group_id','game_number','event_name','neutral_site','contest_type','parser_confidence','created_at','updated_at'],
    booleans: new Set(['featured','game_of_the_night','neutral_site'])
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
  const cols = table.columns;
  const values = cols.map((column) => sqlValue(row[column], table.booleans.has(column)));
  const updates = cols
    .filter((column) => column !== 'id')
    .map((column) => `\"${column}\"=excluded.\"${column}\"`)
    .join(',');

  return `INSERT INTO \"${table.name}\" (${cols.map((column) => `\"${column}\"`).join(',')}) VALUES (${values.join(',')}) ON CONFLICT(id) DO UPDATE SET ${updates};`;
}

function executeSqlFile(path) {
  execFileSync('npx', [
    'wrangler', 'd1', 'execute', DB_NAME,
    '--remote', '--config', WRANGLER_CONFIG,
    '--file', path,
    '--yes'
  ], { stdio: 'inherit', env: process.env });
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 30000,
  statement_timeout: 30000,
});

try {
  console.log('[D1 seed] Connecting to Supabase with temporary read-only migration role...');
  await client.connect();

  const identity = await client.query(`
    SELECT
      current_user AS current_user,
      current_setting('default_transaction_read_only') AS default_transaction_read_only;
  `);

  const info = identity.rows[0];
  if (!String(info.current_user).startsWith('cloudflare_migration_reader')) {
    throw new Error(`Unexpected database user: ${info.current_user}`);
  }
  if (info.default_transaction_read_only !== 'on') {
    throw new Error('Migration reader is not default_transaction_read_only=on; refusing to seed.');
  }

  console.log(`[D1 seed] Source user=${info.current_user}; read_only=${info.default_transaction_read_only}`);
  await client.query('BEGIN READ ONLY');

  for (const table of tables) {
    const select = table.columns.map((column) => `\"${column}\"`).join(',');
    const result = await client.query(`SELECT ${select} FROM public.\"${table.name}\" ORDER BY id ASC`);
    const rows = result.rows;
    console.log(`[D1 seed] ${table.name}: fetched ${rows.length} rows from Supabase`);

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const file = `/tmp/sectionx-${table.name}-${i}.sql`;
      const sql = [
        'PRAGMA foreign_keys = ON;',
        ...chunk.map((row) => buildUpsert(table, row))
      ].join('\n');

      writeFileSync(file, sql, 'utf8');
      try {
        executeSqlFile(file);
      } finally {
        try { unlinkSync(file); } catch {}
      }

      console.log(`[D1 seed] ${table.name}: copied ${Math.min(i + CHUNK_SIZE, rows.length)}/${rows.length}`);
    }
  }

  await client.query('ROLLBACK');
  console.log('[D1 seed] PASS: production was read-only; writes were limited to preview D1.');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('[D1 seed] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
