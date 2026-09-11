import { writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL
if (!connectionString) throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL')

const DB = 'sectionxscoreboard-preview'
const CFG = 'wrangler.jsonc'
const CHUNK = 200

// Tables that were easy to overlook because they are operational/history data
// rather than the core scoreboard graph. These must survive the cutover too.
const tables = [
  { name:'import_logs', key:['id'], columns:['id','import_type','raw_input','rows_parsed','rows_approved','rows_rejected','status','imported_by','created_at'], bool:[] },
  { name:'game_import_sources', key:['id'], columns:['id','game_id','team_id','season_id','sport_id','source','imported_at','source_status','source_game_time','source_location','source_contest_type','source_notes'], bool:[] },
  { name:'submissions', key:['id'], columns:['id','submitter_name','submitter_email','sport_name','home_team_name','away_team_name','home_score','away_score','game_date','notes','status','reviewed_by','created_at'], bool:[] },
  { name:'correction_requests', key:['id'], columns:['id','game_id','submitter_name','submitter_email','correction_text','status','created_at'], bool:[] },
  { name:'advertise_inquiries', key:['id'], columns:['id','business_name','contact_name','email','phone','package_interest','school_interest','sport_interest','message','reviewed','created_at'], bool:['reviewed'] },
  { name:'score_alert_subscriptions', key:['id'], columns:['id','email','school_id','all_section_x','confirmed','created_at'], bool:['all_section_x','confirmed'] },
  { name:'photo_tag_suggestions', key:['id'], columns:['id','photo_id','athlete_id','contributor_id','source_type','status','created_at','reviewed_at','reviewed_by'], bool:[] },
  { name:'admin_exception_resolutions', key:['id'], columns:['id','season_id','arbiter_game_id','game_id','exception_bucket','resolution','note','evidence_fingerprint','evidence','active','created_at','updated_at'], bool:['active'] },
  { name:'staff_power_rank_snapshots', key:['id'], columns:['id','week_start','sport_id','group_type','group_value','rankings','published','created_at','updated_at'], bool:['published'] },
  { name:'sponsor_impressions', key:['id'], columns:['id','sponsor_id','page_path','placement_type','created_at'], bool:[] },
  { name:'sponsor_viewable_impressions', key:['id'], columns:['id','sponsor_id','page_path','placement_type','created_at'], bool:[] },
  { name:'sponsor_clicks', key:['id'], columns:['id','sponsor_id','page_path','placement_type','created_at'], bool:[] },
  { name:'site_traffic_events', key:['id'], columns:['id','occurred_at','event_name','path','page_title','referrer','referrer_host','session_id','visitor_id','user_agent','is_admin','is_bot','landing_path','source','medium','campaign','device_type'], bool:['is_admin','is_bot'] },
]

function val(v, isBoolean=false) {
  if (v === null || v === undefined) return 'NULL'
  if (isBoolean) return v ? '1' : '0'
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  if (v instanceof Date) return `'${v.toISOString().replaceAll("'", "''")}'`
  if (typeof v === 'object') return `'${JSON.stringify(v).replaceAll("'", "''")}'`
  return `'${String(v).replaceAll("'", "''")}'`
}

function upsert(table, row) {
  const values = table.columns.map(c => val(row[c], table.bool.includes(c)))
  const updates = table.columns
    .filter(c => !table.key.includes(c))
    .map(c => `"${c}"=excluded."${c}"`)
    .join(',')
  return `INSERT INTO "${table.name}" (${table.columns.map(c => `"${c}"`).join(',')}) VALUES (${values.join(',')}) ON CONFLICT (${table.key.map(c => `"${c}"`).join(',')}) DO UPDATE SET ${updates};`
}

function execute(file) {
  execFileSync('npx', ['wrangler','d1','execute',DB,'--remote','--config',CFG,'--file',file,'--yes'], { stdio:'inherit', env:process.env })
}

const client = new Client({
  connectionString,
  ssl:{ rejectUnauthorized:false },
  connectionTimeoutMillis:15000,
  query_timeout:60000,
  statement_timeout:60000,
})

try {
  console.log('[D1 operational state] Connecting with guarded read-only migration role...')
  await client.connect()
  const identity = (await client.query("SELECT current_user,current_setting('default_transaction_read_only') AS read_only")).rows[0]
  if (!String(identity.current_user).startsWith('cloudflare_migration_reader') || identity.read_only !== 'on') {
    throw new Error('Refusing operational-state seed without guarded read-only migration role')
  }
  await client.query('BEGIN READ ONLY')

  for (const table of tables) {
    const result = await client.query(`SELECT ${table.columns.map(c => `"${c}"`).join(',')} FROM public."${table.name}" ORDER BY ${table.key.map(c => `"${c}"`).join(',')}`)
    console.log(`[D1 operational state] ${table.name}: ${result.rows.length} rows`)
    for (let i=0; i<result.rows.length; i+=CHUNK) {
      const file = `/tmp/sx-operational-${table.name}-${i}.sql`
      writeFileSync(file, ['PRAGMA foreign_keys = ON;', ...result.rows.slice(i,i+CHUNK).map(r => upsert(table,r))].join('\n'), 'utf8')
      try { execute(file) } finally { try { unlinkSync(file) } catch {} }
    }
  }

  await client.query('ROLLBACK')
  console.log('[D1 operational state] PASS: operational/history state copied; source remained read-only.')
} catch (error) {
  try { await client.query('ROLLBACK') } catch {}
  console.error('[D1 operational state] FAILED:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end().catch(()=>{})
}
