import { getCloudflareContext } from '@opennextjs/cloudflare'
import AdminLayout from '@/components/layout/AdminLayout'
import FallOperations from './FallOperations'
import AutomationPanel from './AutomationPanel'
import RosterIntelligence from './RosterIntelligence'
import FollowIntelligence from './FollowIntelligence'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseJson(value: unknown, fallback: any = {}) {
  if (value == null || value === '') return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(String(value)) } catch { return fallback }
}

function isVarsity(level: unknown) {
  const value = String(level || '').toLowerCase()
  return value.includes('varsity') && !value.includes('junior')
}

async function tableExists(db: any, name: string) {
  const row: any = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").bind(name).first()
  return Boolean(row)
}

async function safeAll(db: any, sql: string, binds: any[] = []) {
  try {
    const result = await db.prepare(sql).bind(...binds).all()
    return result.results || []
  } catch (error) {
    console.warn('[fall-operations] optional query failed', error)
    return []
  }
}

function hydrateRun(row: any) {
  return { ...row, summary: parseJson(row?.summary, {}) }
}

function hydrateHealth(row: any) {
  return {
    ...row,
    summary: parseJson(row?.summary, {}),
    changes: parseJson(row?.changes, []),
    quarantines: parseJson(row?.quarantines, []),
  }
}

function placeholders(count: number) { return Array.from({ length: count }, () => '?').join(',') }

export default async function FallOperationsPage() {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

  const [seasons, runRows, rosterRunRows, followRows, healthRows, alertEvents, alertDeliveries] = await Promise.all([
    safeAll(db, "SELECT id,name,season_type,year,is_active FROM seasons WHERE season_type IN ('Fall','Winter','Spring') ORDER BY year DESC"),
    tableExists(db, 'arbiter_automation_runs').then(ok => ok ? safeAll(db, 'SELECT id,season_id,trigger_source,status,summary,started_at,finished_at FROM arbiter_automation_runs ORDER BY started_at DESC LIMIT 12') : []),
    tableExists(db, 'arbiter_roster_automation_runs').then(ok => ok ? safeAll(db, 'SELECT id,season_id,trigger_source,status,summary,started_at,finished_at FROM arbiter_roster_automation_runs ORDER BY started_at DESC LIMIT 12') : []),
    tableExists(db, 'fan_follow_preferences').then(ok => ok ? safeAll(db, 'SELECT id,email,team_id,athlete_id,alert_finals,alert_schedule_changes,alert_live,alert_photos,active,created_at FROM fan_follow_preferences ORDER BY created_at DESC') : []),
    tableExists(db, 'arbiter_health_checks').then(ok => ok ? safeAll(db, 'SELECT id,season_id,status,summary,changes,quarantines,created_at FROM arbiter_health_checks ORDER BY created_at DESC LIMIT 20') : []),
    tableExists(db, 'fan_notification_events').then(ok => ok ? safeAll(db, 'SELECT id,event_type,status,game_id,created_at,processed_at,last_error FROM fan_notification_events ORDER BY created_at DESC LIMIT 40') : []),
    tableExists(db, 'fan_notification_deliveries').then(ok => ok ? safeAll(db, 'SELECT id,event_id,status,provider,provider_id,error,created_at,sent_at FROM fan_notification_deliveries ORDER BY created_at DESC LIMIT 40') : []),
  ])

  const runs = runRows.map(hydrateRun)
  const rosterRuns = rosterRunRows.map(hydrateRun)
  const healthChecks = healthRows.map(hydrateHealth)
  const active = seasons.find((s: any) => Boolean(s.is_active)) || seasons[0] || null
  const activeRuns = runs.filter((r: any) => !active?.id || !r.season_id || r.season_id === active.id)
  const activeRosterRuns = rosterRuns.filter((r: any) => !active?.id || !r.season_id || r.season_id === active.id)
  const activeChecks = healthChecks.filter((r: any) => !active?.id || !r.season_id || r.season_id === active.id)

  // Until Cloudflare scheduled-trigger verification is complete, derive command-center
  // heartbeat state from actual D1 automation history rather than Supabase RPCs.
  const cron = {
    active: activeRuns.length > 0,
    latest_started_at: activeRuns[0]?.started_at || null,
    latest_finished_at: activeRuns[0]?.finished_at || null,
    source: 'd1-run-history',
  }
  const rosterCron = {
    active: activeRosterRuns.length > 0,
    latest_started_at: activeRosterRuns[0]?.started_at || null,
    latest_finished_at: activeRosterRuns[0]?.finished_at || null,
    source: 'd1-run-history',
  }

  let activeRosterPublicationRows: any[] = []
  if (active?.id && await tableExists(db, 'team_seasons')) {
    const teamSeasonRows = await safeAll(db, `
      SELECT ts.team_id,ts.active_for_season,t.team_name,t.level,t.active
      FROM team_seasons ts JOIN teams t ON t.id=ts.team_id
      WHERE ts.season_id=? AND ts.active_for_season=1`, [active.id])

    const freshnessRows = await (await tableExists(db, 'arbiter_roster_freshness'))
      ? safeAll(db, 'SELECT team_id,status,verified,reason,checked_at FROM arbiter_roster_freshness WHERE season_id=?', [active.id])
      : []
    const rosterCountRows = await (await tableExists(db, 'roster_entries'))
      ? safeAll(db, "SELECT team_id,COUNT(*) AS count FROM roster_entries WHERE season_id=? AND active=1 AND source='arbiter' GROUP BY team_id", [active.id])
      : []
    const coachCountRows = await (await tableExists(db, 'team_coaches'))
      ? safeAll(db, "SELECT team_id,COUNT(*) AS count FROM team_coaches WHERE season_id=? AND active=1 AND source='arbiter' GROUP BY team_id", [active.id])
      : []

    const freshnessByTeam = new Map(freshnessRows.map((row: any) => [row.team_id, row]))
    const rosterCounts = new Map(rosterCountRows.map((row: any) => [row.team_id, Number(row.count || 0)]))
    const coachCounts = new Map(coachCountRows.map((row: any) => [row.team_id, Number(row.count || 0)]))

    activeRosterPublicationRows = teamSeasonRows
      .filter((row: any) => Boolean(row.active) && isVarsity(row.level))
      .map((row: any) => {
        const freshness: any = freshnessByTeam.get(row.team_id) || null
        const status = freshness?.status || null
        const verified = Boolean(freshness?.verified)
        return {
          team_id: row.team_id,
          team_name: row.team_name || 'Unknown team',
          season_id: active.id,
          season_name: active.name,
          status,
          verified,
          reason: freshness?.reason || 'Not scanned for current-season Arbiter roster freshness yet.',
          checked_at: freshness?.checked_at || null,
          active_arbiter_roster_entries: rosterCounts.get(row.team_id) || 0,
          active_arbiter_coaches: coachCounts.get(row.team_id) || 0,
          publicly_visible: verified && status === 'current-verified',
        }
      })
  }
  const rosterPublicationSource = 'd1-canonical'

  const scheduleGameIds = new Set<string>()
  for (const run of activeRuns) {
    for (const action of run?.summary?.schedule?.actions || []) if (action?.gameId) scheduleGameIds.add(String(action.gameId))
    for (const action of run?.summary?.scores?.actions || []) if (action?.gameId) scheduleGameIds.add(String(action.gameId))
  }
  const rosterTeamIds = new Set<string>()
  for (const run of activeRosterRuns) {
    for (const action of run?.summary?.actions || []) if (action?.teamId) rosterTeamIds.add(String(action.teamId))
    for (const q of run?.summary?.quarantines || []) if (q?.teamId) rosterTeamIds.add(String(q.teamId))
    for (const f of run?.summary?.failures || []) if (f?.teamId) rosterTeamIds.add(String(f.teamId))
  }

  const followTeamIds = Array.from(new Set(followRows.map((r: any) => r.team_id).filter(Boolean).map(String)))
  const followAthleteIds = Array.from(new Set(followRows.map((r: any) => r.athlete_id).filter(Boolean).map(String)))

  const gameIds = Array.from(scheduleGameIds)
  const teamIds = Array.from(rosterTeamIds)
  const gameRows = gameIds.length ? await safeAll(db, `
    SELECT g.id,g.game_date,ht.team_name AS home_team_name,hs.school_name AS home_school_name,
      at.team_name AS away_team_name,aschool.school_name AS away_school_name
    FROM games g
    LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN schools hs ON hs.id=ht.school_id
    LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN schools aschool ON aschool.id=at.school_id
    WHERE g.id IN (${placeholders(gameIds.length)})`, gameIds) : []

  const labelTeamIds = Array.from(new Set([...teamIds, ...followTeamIds]))
  const labelTeamRows = labelTeamIds.length ? await safeAll(db, `
    SELECT t.id,t.team_name,s.school_name,sp.sport_name,sp.gender
    FROM teams t LEFT JOIN schools s ON s.id=t.school_id LEFT JOIN sports sp ON sp.id=t.sport_id
    WHERE t.id IN (${placeholders(labelTeamIds.length)})`, labelTeamIds) : []

  const athleteRows = followAthleteIds.length && await tableExists(db, 'athletes') ? await safeAll(db, `
    SELECT a.id,a.first_name,a.last_name,s.school_name
    FROM athletes a LEFT JOIN schools s ON s.id=a.school_id
    WHERE a.id IN (${placeholders(followAthleteIds.length)})`, followAthleteIds) : []

  const gameLabels: Record<string, string> = {}
  for (const game of gameRows) {
    const h = game.home_team_name || game.home_school_name || 'Home'
    const a = game.away_team_name || game.away_school_name || 'Away'
    gameLabels[game.id] = `${a} at ${h}${game.game_date ? ` · ${game.game_date}` : ''}`
  }

  const teamLabels: Record<string, string> = {}
  const followTargetLabels: Record<string, string> = {}
  for (const team of labelTeamRows) {
    const sportName = [team.gender, team.sport_name].filter(Boolean).join(' ')
    const label = [team.school_name || team.team_name, sportName].filter(Boolean).join(' · ')
    teamLabels[team.id] = label
    followTargetLabels[`team:${team.id}`] = `Team · ${label}`
  }
  for (const athlete of athleteRows) {
    const name = [athlete.first_name, athlete.last_name].filter(Boolean).join(' ')
    followTargetLabels[`athlete:${athlete.id}`] = `Athlete · ${name}${athlete.school_name ? ` · ${athlete.school_name}` : ''}`
  }

  const enrichedFollowRows = followRows.map((row: any) => ({
    ...row,
    active: Boolean(row.active),
    alert_finals: Boolean(row.alert_finals),
    alert_schedule_changes: Boolean(row.alert_schedule_changes),
    alert_live: Boolean(row.alert_live),
    alert_photos: Boolean(row.alert_photos),
    target_label: row.team_id ? followTargetLabels[`team:${row.team_id}`] : row.athlete_id ? followTargetLabels[`athlete:${row.athlete_id}`] : null,
  }))

  const healthByRunId: Record<string, any> = {}
  for (const check of activeChecks) {
    const runId = check?.summary?.automationRunId
    if (runId && !healthByRunId[runId]) healthByRunId[runId] = check
  }

  const alertSummary = {
    pending: alertEvents.filter((x: any) => x.status === 'pending').length,
    error: alertEvents.filter((x: any) => x.status === 'error').length,
    sent: alertEvents.filter((x: any) => x.status === 'sent').length,
    skipped: alertEvents.filter((x: any) => x.status === 'skipped').length,
    deliveriesSent: alertDeliveries.filter((x: any) => x.status === 'sent').length,
    deliveriesError: alertDeliveries.filter((x: any) => x.status === 'error').length,
    latestEvent: alertEvents[0] || null,
    latestDelivery: alertDeliveries[0] || null,
  }

  return <AdminLayout>
    <div className="space-y-5">
      <FallOperations season={active} />
      <div className="p-4 pt-0 max-w-6xl space-y-4">
        <div className="grid xl:grid-cols-2 gap-4">
          <RosterIntelligence rows={activeRosterPublicationRows} source={rosterPublicationSource} />
          <FollowIntelligence rows={enrichedFollowRows} />
        </div>
        <AutomationPanel runs={activeRuns} cron={cron} rosterRuns={activeRosterRuns} rosterCron={rosterCron} healthByRunId={healthByRunId} gameLabels={gameLabels} teamLabels={teamLabels} alertSummary={alertSummary} />
      </div>
    </div>
  </AdminLayout>
}
