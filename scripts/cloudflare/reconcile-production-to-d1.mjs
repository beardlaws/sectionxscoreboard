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

function d1Count(sql) {
  const row = d1Rows(sql)[0] || {}
  return Number(row.count || 0)
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 30000,
  statement_timeout: 30000,
})

let failed = false
function gate(label, pass, detail='') {
  console.log(`  ${pass ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`)
  if (!pass) failed = true
}

try {
  console.log('[reconcile] Connecting to authoritative Supabase through the read-only migration role...')
  await client.connect()
  const identity = await client.query(`
    SELECT current_user AS current_user,
           current_setting('default_transaction_read_only') AS default_transaction_read_only
  `)
  const info = identity.rows[0]
  if (!String(info.current_user).startsWith('cloudflare_migration_reader')) throw new Error(`Unexpected database user: ${info.current_user}`)
  if (info.default_transaction_read_only !== 'on') throw new Error('Migration reader is not read-only; refusing to reconcile.')

  console.log('\nTABLE'.padEnd(40), 'SUPABASE'.padStart(10), 'D1'.padStart(10), 'RESULT'.padStart(10))
  console.log('-'.repeat(74))
  for (const table of TABLES) {
    const source = await client.query(`SELECT COUNT(*)::bigint AS count FROM public."${table}"`)
    const sourceCount = Number(source.rows[0]?.count || 0)
    const destinationCount = d1Count(`SELECT COUNT(*) AS count FROM "${table}";`)
    const match = sourceCount === destinationCount
    if (!match) failed = true
    console.log(table.padEnd(40), String(sourceCount).padStart(10), String(destinationCount).padStart(10), (match ? 'PASS' : 'MISMATCH').padStart(10))
  }

  const sourceGameFreshness = await client.query(`
    SELECT MAX(updated_at) AS latest_updated_at,
           COUNT(*) FILTER (WHERE result_exempt = true) AS result_exempt_count,
           COUNT(*) FILTER (WHERE import_id IS NOT NULL) AS import_link_count
    FROM public.games
  `)
  const d1GameFreshness = d1Rows(`
    SELECT MAX(updated_at) AS latest_updated_at,
           SUM(CASE WHEN result_exempt = 1 THEN 1 ELSE 0 END) AS result_exempt_count,
           SUM(CASE WHEN import_id IS NOT NULL THEN 1 ELSE 0 END) AS import_link_count
    FROM games;
  `)[0] || {}

  const sourceLatest = sourceGameFreshness.rows[0]?.latest_updated_at ? new Date(sourceGameFreshness.rows[0].latest_updated_at).toISOString() : null
  const d1Latest = d1GameFreshness.latest_updated_at ? new Date(d1GameFreshness.latest_updated_at).toISOString() : null
  const sourceExempt = Number(sourceGameFreshness.rows[0]?.result_exempt_count || 0)
  const d1Exempt = Number(d1GameFreshness.result_exempt_count || 0)
  const sourceImportLinks = Number(sourceGameFreshness.rows[0]?.import_link_count || 0)
  const d1ImportLinks = Number(d1GameFreshness.import_link_count || 0)

  console.log('\nGame operational parity:')
  gate('games.updated_at freshness', sourceLatest === d1Latest, `source=${sourceLatest || 'none'} d1=${d1Latest || 'none'}`)
  gate('result_exempt count', sourceExempt === d1Exempt, `source=${sourceExempt} d1=${d1Exempt}`)
  gate('games.import_id links', sourceImportLinks === d1ImportLinks, `source=${sourceImportLinks} d1=${d1ImportLinks}`)

  const sourceMedia = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM public.photos) AS photos,
      (SELECT COUNT(*) FROM public.schools WHERE logo_url IS NOT NULL AND btrim(logo_url) <> '') AS logos
  `)
  const sourcePhotos = Number(sourceMedia.rows[0]?.photos || 0)
  const sourceLogos = Number(sourceMedia.rows[0]?.logos || 0)
  const d1R2Photos = d1Count("SELECT COUNT(*) AS count FROM photos WHERE storage_provider='r2' AND storage_key IS NOT NULL AND photo_url LIKE '/media/photos/%';")
  const d1LegacyPhotoUrls = d1Count("SELECT COUNT(*) AS count FROM photos WHERE photo_url LIKE 'http://%' OR photo_url LIKE 'https://%';")
  const d1R2Logos = d1Count("SELECT COUNT(*) AS count FROM schools WHERE logo_url LIKE '/media/photos/logos/%';")

  console.log('\nMedia pointer parity:')
  gate('all photo rows point to R2', d1R2Photos === sourcePhotos, `source photos=${sourcePhotos} d1 r2 photos=${d1R2Photos}`)
  gate('no legacy absolute photo URLs remain', d1LegacyPhotoUrls === 0, `legacy urls=${d1LegacyPhotoUrls}`)
  gate('all referenced school logos point to R2', d1R2Logos === sourceLogos, `source logos=${sourceLogos} d1 r2 logos=${d1R2Logos}`)

  const orphanChecks = [
    ['games -> sports', `SELECT COUNT(*) AS count FROM games g LEFT JOIN sports s ON s.id=g.sport_id WHERE g.sport_id IS NOT NULL AND s.id IS NULL;`],
    ['games -> seasons', `SELECT COUNT(*) AS count FROM games g LEFT JOIN seasons s ON s.id=g.season_id WHERE g.season_id IS NOT NULL AND s.id IS NULL;`],
    ['games -> home teams', `SELECT COUNT(*) AS count FROM games g LEFT JOIN teams t ON t.id=g.home_team_id WHERE g.home_team_id IS NOT NULL AND t.id IS NULL;`],
    ['games -> away teams', `SELECT COUNT(*) AS count FROM games g LEFT JOIN teams t ON t.id=g.away_team_id WHERE g.away_team_id IS NOT NULL AND t.id IS NULL;`],
    ['rosters -> athletes', `SELECT COUNT(*) AS count FROM roster_entries r LEFT JOIN athletes a ON a.id=r.athlete_id WHERE a.id IS NULL;`],
    ['rosters -> teams', `SELECT COUNT(*) AS count FROM roster_entries r LEFT JOIN teams t ON t.id=r.team_id WHERE t.id IS NULL;`],
    ['photos -> games', `SELECT COUNT(*) AS count FROM photos p LEFT JOIN games g ON g.id=p.game_id WHERE p.game_id IS NOT NULL AND g.id IS NULL;`],
    ['arbiter links -> games', `SELECT COUNT(*) AS count FROM arbiter_game_links a LEFT JOIN games g ON g.id=a.game_id WHERE a.game_id IS NOT NULL AND g.id IS NULL;`],
    ['game import sources -> games', `SELECT COUNT(*) AS count FROM game_import_sources i LEFT JOIN games g ON g.id=i.game_id WHERE i.game_id IS NOT NULL AND g.id IS NULL;`],
    ['contributor assignments -> games', `SELECT COUNT(*) AS count FROM contributor_game_assignments a LEFT JOIN games g ON g.id=a.game_id WHERE g.id IS NULL;`],
  ]

  console.log('\nRelational integrity:')
  for (const [label, sql] of orphanChecks) {
    const count = d1Count(sql)
    gate(label, count === 0, `orphans=${count}`)
  }

  if (failed) {
    console.error('\n[reconcile] FAIL: D1 is not an exact launch candidate. Run the final sync and reconcile again.')
    process.exitCode = 1
  } else {
    console.log(`\n[reconcile] PASS: ${TABLES.length} source-owned tables, game state, R2 pointers and relational integrity are launch-ready.`)
  }
} finally {
  await client.end().catch(() => {})
}
