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
  { name:'sponsors', columns:['id','business_name','contact_name','contact_email','website_url','logo_url','tagline','placement','active','created_at','placement_type','school_id','sport_id','price_monthly','start_date','end_date','contact_phone','notes','show_on_scores'], booleans:new Set(['active','show_on_scores']) },
  { name:'athletes', columns:['id','school_id','first_name','last_name','display_name','slug','source','source_key','source_url','active','created_at','updated_at'], booleans:new Set(['active']) },
  { name:'coaches', columns:['id','school_id','first_name','last_name','display_name','slug','source','source_key','source_url','active','created_at','updated_at'], booleans:new Set(['active']) },
  { name:'roster_entries', columns:['id','athlete_id','team_id','season_id','jersey_number','class_year','position','height','captain','source','source_url','active','imported_at','created_at','updated_at'], booleans:new Set(['captain','active']) },
  { name:'team_coaches', columns:['id','coach_id','team_id','season_id','title','source','source_url','active','imported_at','created_at','updated_at'], booleans:new Set(['active']) },
  { name:'photos', columns:['id','submitter_name','submitter_email','photographer_credit_name','school_id','team_id','game_id','sport_id','caption','photo_url','permission_confirmed','approved','featured','created_at','contributor_id','contributor_user_id','tag_reviewed'], booleans:new Set(['permission_confirmed','approved','featured','tag_reviewed']) },
  { name:'shoutouts', columns:['id','submitter_name','submitter_email','school_id','team_id','game_id','athlete_name','shoutout_type','description','approved','featured','created_at'], booleans:new Set(['approved','featured']) },
  { name:'site_settings', columns:['key','value','description','updated_at'], booleans:new Set(), key:'key' },
  { name:'spotlights', columns:['id','title','body','author','school_slug','sport_name','published','featured','created_at','updated_at'], booleans:new Set(['published','featured']) },
  { name:'athlete_of_week', columns:['id','athlete_name','school_id','sport_name','grade','stats','body','photo_url','week_of','published','created_at','updated_at'], booleans:new Set(['published']) },
  { name:'weekly_recaps', columns:['id','title','slug','summary','published_date','season_label','week_label','facebook_url','facebook_embed_url','youtube_url','thumbnail_url','sponsor_id','published','featured','created_at','updated_at'], booleans:new Set(['published','featured']) },
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
  const key = table.key || 'id';
  const vals = table.columns.map(c=>sqlValue(row[c], table.booleans.has(c)));
  const updates = table.columns.filter(c=>c!==key).map(c=>`\"${c}\"=excluded.\"${c}\"`).join(',');
  return `INSERT INTO \"${table.name}\" (${table.columns.map(c=>`\"${c}\"`).join(',')}) VALUES (${vals.join(',')}) ON CONFLICT(\"${key}\") DO UPDATE SET ${updates};`;
}

function executeSqlFile(path) {
  execFileSync('npx',['wrangler','d1','execute',DB_NAME,'--remote','--config',WRANGLER_CONFIG,'--file',path,'--yes'],{stdio:'inherit',env:process.env});
}

const client = new Client({ connectionString, ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:15000, query_timeout:45000, statement_timeout:45000 });

try {
  console.log('[D1 public content] Connecting to Supabase read-only migration role...');
  await client.connect();
  const identity = await client.query(`select current_user as current_user, current_setting('default_transaction_read_only') as default_transaction_read_only`);
  const info = identity.rows[0];
  if (!String(info.current_user).startsWith('cloudflare_migration_reader')) throw new Error(`Unexpected database user: ${info.current_user}`);
  if (info.default_transaction_read_only !== 'on') throw new Error('Migration reader is not read-only; refusing to continue.');
  await client.query('BEGIN READ ONLY');

  for (const table of tables) {
    const select = table.columns.map(c=>`\"${c}\"`).join(',');
    const key = table.key || 'id';
    const result = await client.query(`SELECT ${select} FROM public.\"${table.name}\" ORDER BY \"${key}\" ASC`);
    console.log(`[D1 public content] ${table.name}: ${result.rows.length} rows`);
    for (let i=0;i<result.rows.length;i+=CHUNK_SIZE) {
      const file = `/tmp/sectionx-public-${table.name}-${i}.sql`;
      writeFileSync(file,['PRAGMA foreign_keys = ON;',...result.rows.slice(i,i+CHUNK_SIZE).map(row=>buildUpsert(table,row))].join('\n'),'utf8');
      try { executeSqlFile(file); } finally { try { unlinkSync(file); } catch {} }
    }
  }

  await client.query('ROLLBACK');
  console.log('[D1 public content] PASS: copied public/editorial/roster content into preview D1.');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('[D1 public content] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(()=>{});
}
