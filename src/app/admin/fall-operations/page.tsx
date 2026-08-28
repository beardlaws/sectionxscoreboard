import AdminLayout from '@/components/layout/AdminLayout'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import FallOperations from './FallOperations'
import AutomationPanel from './AutomationPanel'
import RosterIntelligence from './RosterIntelligence'
import FollowIntelligence from './FollowIntelligence'

export const revalidate = 0

function joined<T = any>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null
}

export default async function FallOperationsPage() {
  const supabase = createClient()
  const admin = createAdminClient()

  const [
    { data: seasons, error },
    { data: runs },
    { data: cronRows },
    { data: rosterRuns },
    { data: rosterCronRows },
    { data: rosterPublicationRows },
    { data: followRows },
    { data: healthChecks },
    { data: alertEvents },
    { data: alertDeliveries },
  ] = await Promise.all([
    supabase.from('seasons').select('id,name,season_type,year,is_active').in('season_type', ['Fall', 'Winter', 'Spring']).order('year', { ascending: false }),
    admin.from('arbiter_automation_runs').select('id,season_id,trigger_source,status,summary,started_at,finished_at').order('started_at', { ascending: false }).limit(12),
    admin.rpc('sectionx_arbiter_cron_status'),
    admin.from('arbiter_roster_automation_runs').select('id,season_id,trigger_source,status,summary,started_at,finished_at').order('started_at', { ascending: false }).limit(12),
    admin.rpc('sectionx_roster_cron_status'),
    admin.from('arbiter_roster_publication_status_admin').select('team_id,team_name,season_id,season_name,status,verified,reason,checked_at,active_arbiter_roster_entries,active_arbiter_coaches,publicly_visible'),
    admin.from('fan_follow_preferences').select('team_id,athlete_id,alert_finals,alert_schedule_changes,alert_live,alert_photos,active,created_at'),
    admin.from('arbiter_health_checks').select('id,season_id,status,summary,changes,quarantines,created_at').order('created_at', { ascending: false }).limit(20),
    admin.from('fan_notification_events').select('id,event_type,status,game_id,created_at,processed_at,last_error').order('created_at', { ascending: false }).limit(40),
    admin.from('fan_notification_deliveries').select('id,event_id,status,provider,provider_id,error,created_at,sent_at').order('created_at', { ascending: false }).limit(40),
  ])

  if (error) throw new Error(error.message)

  const active = (seasons || []).find((s: any) => s.is_active) || (seasons || [])[0] || null
  const activeRuns = (runs || []).filter((r: any) => !active?.id || !r.season_id || r.season_id === active.id)
  const activeRosterRuns = (rosterRuns || []).filter((r: any) => !active?.id || !r.season_id || r.season_id === active.id)
  const activeChecks = (healthChecks || []).filter((r: any) => !active?.id || !r.season_id || r.season_id === active.id)
  const activeRosterPublicationRows = (rosterPublicationRows || []).filter((r: any) => !active?.id || r.season_id === active.id)
  const cron = Array.isArray(cronRows) ? cronRows[0] || null : cronRows || null
  const rosterCron = Array.isArray(rosterCronRows) ? rosterCronRows[0] || null : rosterCronRows || null

  const scheduleGameIds = new Set<string>()
  for (const run of activeRuns) {
    for (const action of run?.summary?.schedule?.actions || []) if (action?.gameId) scheduleGameIds.add(action.gameId)
    for (const action of run?.summary?.scores?.actions || []) if (action?.gameId) scheduleGameIds.add(action.gameId)
  }
  const rosterTeamIds = new Set<string>()
  for (const run of activeRosterRuns) {
    for (const action of run?.summary?.actions || []) if (action?.teamId) rosterTeamIds.add(action.teamId)
    for (const q of run?.summary?.quarantines || []) if (q?.teamId) rosterTeamIds.add(q.teamId)
    for (const f of run?.summary?.failures || []) if (f?.teamId) rosterTeamIds.add(f.teamId)
  }

  const [{ data: gameRows }, { data: teamRows }] = await Promise.all([
    scheduleGameIds.size
      ? admin.from('games').select('id,game_date,home_team:teams!games_home_team_id_fkey(team_name,school:schools(school_name)),away_team:teams!games_away_team_id_fkey(team_name,school:schools(school_name))').in('id', Array.from(scheduleGameIds))
      : Promise.resolve({ data: [] } as any),
    rosterTeamIds.size
      ? admin.from('teams').select('id,team_name,school:schools(school_name),sport:sports(sport_name,gender)').in('id', Array.from(rosterTeamIds))
      : Promise.resolve({ data: [] } as any),
  ])

  const gameLabels: Record<string, string> = {}
  for (const game of gameRows || []) {
    const home = joined<any>(game.home_team), away = joined<any>(game.away_team)
    const homeSchool = joined<any>(home?.school), awaySchool = joined<any>(away?.school)
    const h = home?.team_name || homeSchool?.school_name || 'Home'
    const a = away?.team_name || awaySchool?.school_name || 'Away'
    gameLabels[game.id] = `${a} at ${h}${game.game_date ? ` · ${game.game_date}` : ''}`
  }

  const teamLabels: Record<string, string> = {}
  for (const team of teamRows || []) {
    const school = joined<any>(team.school), sport = joined<any>(team.sport)
    const sportName = [sport?.gender, sport?.sport_name].filter(Boolean).join(' ')
    teamLabels[team.id] = [school?.school_name || team.team_name, sportName].filter(Boolean).join(' · ')
  }

  const healthByRunId: Record<string, any> = {}
  for (const check of activeChecks) {
    const runId = check?.summary?.automationRunId
    if (runId && !healthByRunId[runId]) healthByRunId[runId] = check
  }

  const alertSummary = {
    pending: (alertEvents || []).filter((x: any) => x.status === 'pending').length,
    error: (alertEvents || []).filter((x: any) => x.status === 'error').length,
    sent: (alertEvents || []).filter((x: any) => x.status === 'sent').length,
    skipped: (alertEvents || []).filter((x: any) => x.status === 'skipped').length,
    deliveriesSent: (alertDeliveries || []).filter((x: any) => x.status === 'sent').length,
    deliveriesError: (alertDeliveries || []).filter((x: any) => x.status === 'error').length,
    latestEvent: (alertEvents || [])[0] || null,
    latestDelivery: (alertDeliveries || [])[0] || null,
  }

  return <AdminLayout>
    <div className="space-y-5">
      <FallOperations season={active} />
      <div className="p-4 pt-0 max-w-6xl space-y-4">
        <div className="grid xl:grid-cols-2 gap-4">
          <RosterIntelligence rows={activeRosterPublicationRows} />
          <FollowIntelligence rows={followRows || []} />
        </div>
        <AutomationPanel runs={activeRuns} cron={cron} rosterRuns={activeRosterRuns} rosterCron={rosterCron} healthByRunId={healthByRunId} gameLabels={gameLabels} teamLabels={teamLabels} alertSummary={alertSummary} />
      </div>
    </div>
  </AdminLayout>
}
