import { execFileSync } from 'node:child_process'
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.SUPABASE_MIGRATION_DATABASE_URL
if (!connectionString) throw new Error('Missing SUPABASE_MIGRATION_DATABASE_URL')

const DB_NAME = 'sectionxscoreboard-preview'
const WRANGLER_CONFIG = 'wrangler.jsonc'

// Every source-owned table below is expected to survive the cutover. Cloudflare-
// native tables such as contributor_auth_* and broadcasts are intentionally not
// compared to Supabase because Supabase is not authoritative for those tables.
const TABLES = [
  'schools','sports','seasons','external_opponents','teams','team_seasons','games','import_logs','game_import_sources',
  'submissions','correction_requests','photos','photo_tag_suggestions','photo_athletes',
  'athletes','coaches','roster_entries','team_coaches','site_settings','spotlights','athlete_of_week','weekly_recaps',
  'sponsors','advertise_inquiries','sponsor_impressions','sponsor_viewable_impressions','sponsor_clicks','site_traffic_events',
  'game_period_scores','stat_definitions','game_team_stats','game_athlete_stats',
  'playoff_tournaments','playoff_games',
  'cross_country_meets','cross_country_team_results','cross_country_dual_results','cross_country_individual_results',
  'fan_power_rank_ballots','fan_power_rank_snapshots','fan_top_play_nominations','fan_school_support','fan_school_support_snapshots','fan_game_votes','fan_game_vote_snapshots','athlete_nominations','staff_power_rank_snapshots',
  'contributor_profiles','contributor_game_assignments','contributor_activity','contributor_coverage_requests','contributor_score_updates',
  'fan_follow_preferences','fan_notification_events','fan_notification_deliveries','score_alert_subscriptions',
  'arbiter_team_links','arbiter_game_links','arbiter_sync_runs','arbiter_sync_actions','arbiter_health_checks','arbiter_automation_runs','arbiter_roster_freshness','arbiter_roster_automation_runs','arbiter_school_mappings','arbiter_team_mappings','arbiter_shared_event_ids','admin_exception_resolutions',
]

function d1Rows(sql) {
  const raw = execFileSync('npx', [
    'wrangler', 'd1', 'execute', DB_NAME,
    '--remote', '--config', WRANGLER_CONFIG,
    '--command', sql,
    '--json',
  ], { encoding: 'utf8', env: process.env })

  const payload = JSON.parse(raw)
  const result = Array.isArray(payload) ? payload[0] : payload
  return result?.results || result?.result?.[0]?.results || []
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 30000,
  statement_timeout: 30000,
})

let failed = false

try {
  console.log('[reconcile] Connecting to authoritative Supabase through the read-only migration role...')
  await client.connect()
  const identity = await client.query(`
    SELECT current_user AS current_user,
           current_setting('default_transaction_read_only') AS default_transaction_read_only
  `)
  const info = identity.rows[0]
  if (!String(info.current_user).startsWith('cloudflare_migration_reader')) {
    throw new Error(`Unexpected database user: ${info.current_user}`)
  }
  if (info.default_transaction_read_only !== 'on') {
    throw new Error('Migration reader is not read-only; refusing to reconcile.')
  }

  console.log('\nTABLE'.padEnd(40), 'SUPABASE'.padStart(10), 'D1'.padStart(10), 'RESULT'.padStart(10))
  console.log('-'.repeat(74))

  for (const table of TABLES) {
    const source = await client.query(`SELECT COUNT(*)::bigint AS count FROM public."${table}"`)
    const sourceCount = Number(source.rows[0]?.count || 0)
    const destination = d1Rows(`SELECT COUNT(*) AS count FROM "${table}";`)
    const destinationCount = Number(destination[0]?.count || 0)
    const match = sourceCount === destinationCount
    if (!match) failed = true
    console.log(
      table.padEnd(40),
      String(sourceCount).padStart(10),
      String(destinationCount).padStart(10),
      (match ? 'PASS' : 'MISMATCH').padStart(10),
    )
  }

  const sourceGameFreshness = await client.query(`
    SELECT MAX(updated_at) AS latest_updated_at,
           COUNT(*) FILTER (WHERE result_exempt = true) AS result_exempt_count
    FROM public.games
  `)
  const d1GameFreshness = d1Rows(`
    SELECT MAX(updated_at) AS latest_updated_at,
           SUM(CASE WHEN result_exempt = 1 THEN 1 ELSE 0 END) AS result_exempt_count
    FROM games;
  `)[0] || {}

  const sourceLatest = sourceGameFreshness.rows[0]?.latest_updated_at
    ? new Date(sourceGameFreshness.rows[0].latest_updated_at).toISOString()
    : null
  const d1Latest = d1GameFreshness.latest_updated_at ? new Date(d1GameFreshness.latest_updated_at).toISOString() : null
  const sourceExempt = Number(sourceGameFreshness.rows[0]?.result_exempt_count || 0)
  const d1Exempt = Number(d1GameFreshness.result_exempt_count || 0)

  console.log('\nGame freshness:')
  console.log(`  Supabase latest updated_at: ${sourceLatest || 'none'}`)
  console.log(`  D1 latest updated_at:       ${d1Latest || 'none'}`)
  console.log(`  Supabase result_exempt:     ${sourceExempt}`)
  console.log(`  D1 result_exempt:           ${d1Exempt}`)

  if (sourceLatest !== d1Latest) {
    console.error('  MISMATCH: games.updated_at freshness differs')
    failed = true
  }
  if (sourceExempt !== d1Exempt) {
    console.error('  MISMATCH: result_exempt count differs')
    failed = true
  }

  if (failed) {
    console.error('\n[reconcile] FAIL: D1 is not an exact launch candidate. Run the final sync and reconcile again.')
    process.exitCode = 1
  } else {
    console.log(`\n[reconcile] PASS: ${TABLES.length} source-owned tables plus game operational freshness match D1.`)
  }
} finally {
  await client.end().catch(() => {})
}
