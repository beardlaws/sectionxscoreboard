import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import ScheduleSync from './ScheduleSync'

export const revalidate = 0

export default async function ScheduleSyncPage() {
  const supabase = createClient()

  const [teamsResult, sportsResult, seasonsResult] = await Promise.all([
    supabase
      .from('teams')
      .select(`
        id,
        team_name,
        sport_id,
        level,
        active,
        school:schools(
          id,
          school_name,
          slug,
          alias
        )
      `)
      .order('team_name'),

    supabase
      .from('sports')
      .select('id, sport_name, gender, season_type, active_public, slug, homepage_priority')
      .order('sport_name'),

    supabase
      .from('seasons')
      .select('*')
      .order('year', { ascending: false }),
  ])

  if (teamsResult.error) throw new Error(teamsResult.error.message)
  if (sportsResult.error) throw new Error(sportsResult.error.message)
  if (seasonsResult.error) throw new Error(seasonsResult.error.message)

  const teams = (teamsResult.data || []).map((team: any) => ({
    ...team,
    school: Array.isArray(team.school) ? team.school[0] || null : team.school || null,
  }))

  return (
    <AdminLayout>
      <ScheduleSync
        teams={teams}
        sports={sportsResult.data || []}
        seasons={seasonsResult.data || []}
      />
    </AdminLayout>
  )
}
