import { writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const DB_NAME = 'sectionxscoreboard-preview';
const WRANGLER_CONFIG = 'wrangler.jsonc';
const PAGE_SIZE = 1000;
const CHUNK_SIZE = 200;

const tables = [
  {
    name: 'schools',
    columns: ['id','school_name','mascot','city','county','primary_color','secondary_color','alias','slug','active','created_at'],
    booleans: new Set(['active'])
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
    columns: ['id','team_id','season_id','class','division','active_for_season','display_team_name','is_coop','coop_schools','notes'],
    booleans: new Set(['active_for_season','is_coop'])
  },
  {
    name: 'games',
    columns: ['id','season_id','sport_id','home_team_id','away_team_id','external_home_opponent_id','external_away_opponent_id','game_date','game_time','location','home_score','away_score','status','verification_status','source','notes','featured','game_of_the_night','rescheduled_date','doubleheader_group_id','game_number','event_name','neutral_site','import_id','parser_confidence','created_at','updated_at'],
    booleans: new Set(['featured','game_of_the_night','neutral_site'])
  }
];

function sqlValue(value, isBoolean = false) {
  if (value === null || value === undefined) return 'NULL';
  if (isBoolean) return value ? '1' : '0';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function fetchAll(table) {
  const rows = [];
  let from = 0;
  const select = table.columns.join(',');

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const url = `${SUPABASE_URL}/rest/v1/${table.name}?select=${encodeURIComponent(select)}&order=id.asc`;
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        range: `${from}-${to}`,
        'range-unit': 'items',
        accept: 'application/json'
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase read failed for ${table.name}: ${response.status} ${body.slice(0, 500)}`);
    }

    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function buildUpsert(table, row) {
  const cols = table.columns;
  const values = cols.map((column) => sqlValue(row[column], table.booleans.has(column)));
  const updates = cols.filter((column) => column !== 'id').map((column) => `\"${column}\"=excluded.\"${column}\"`).join(',');
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

for (const table of tables) {
  const rows = await fetchAll(table);
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

console.log('[D1 seed] Core copy complete. Verifying row counts in D1...');
const countSql = tables.map((table) => `SELECT '${table.name}' AS table_name, COUNT(*) AS row_count FROM \"${table.name}\"`).join(' UNION ALL ') + ';';
execFileSync('npx', [
  'wrangler', 'd1', 'execute', DB_NAME,
  '--remote', '--config', WRANGLER_CONFIG,
  '--command', countSql
], { stdio: 'inherit', env: process.env });
