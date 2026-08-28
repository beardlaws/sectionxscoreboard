import AdminLayout from '@/components/layout/AdminLayout'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import FallOperations from './FallOperations'
import AutomationPanel from './AutomationPanel'
import RosterIntelligence from './RosterIntelligence'
import FollowIntelligence from './FollowIntelligence'

export const revalidate = 0

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
  ] = await Promise.all([
    supabase.from('seasons').select('id,name,season_type,year,is_active').in('season_type', ['Fall', 'Winter', 'Spring']).order('year', { ascending: false }),
    admin.from('arbiter_automation_runs').select('id,season_id,trigger_source,status,summary,started_at,finished_at').order('started_at', { ascending: false }).limit(12),
    admin.rpc('sectionx_arbiter_cron_status'),
    admin.from('arbiter_roster_automation_runs').select('id,season_id,trigger_source,status,summary,started_at,finished_at').order('started_at', { ascending: false }).limit(12),
    admin.rpc('sectionx_roster_cron_status'),
    admin.from('arbiter_roster_publication_audit').select('team_name,freshness_status,verified,arbiter_roster_count,arbiter_coach_count,arbiter_roster_public,reason,checked_at'),
    admin.from('fan_follow_preferences').select('team_id,athlete_id,alert_finals,alert_schedule_changes,alert_live,alert_photos,active,created_at'),
  ])

  if (error) throw new Error(error.message)

  const active = (seasons || []).find((s: any) => s.is_active) || (seasons || [])[0] || null
  const activeRuns = (runs || []).filter((r: any) => !active?.id || !r.season_id || r.season_id === active.id)
  const activeRosterRuns = (rosterRuns || []).filter((r: any) => !active?.id || !r.season_id || r.season_id === active.id)
  const cron = Array.isArray(cronRows) ? cronRows[0] || null : cronRows || null
  const rosterCron = Array.isArray(rosterCronRows) ? rosterCronRows[0] || null : rosterCronRows || null

  return <AdminLayout>
    <div className="space-y-5">
      <FallOperations season={active} />
      <div className="p-4 pt-0 max-w-6xl space-y-4">
        <div className="grid xl:grid-cols-2 gap-4">
          <RosterIntelligence rows={rosterPublicationRows || []} />
          <FollowIntelligence rows={followRows || []} />
        </div>
        <AutomationPanel runs={activeRuns} cron={cron} rosterRuns={activeRosterRuns} rosterCron={rosterCron} />
      </div>
    </div>
  </AdminLayout>
}
