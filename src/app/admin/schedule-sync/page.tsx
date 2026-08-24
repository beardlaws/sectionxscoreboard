import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import ScheduleSync from './ScheduleSync'
import PersistentArbiterMappings from './PersistentArbiterMappings'
import SchoolMappingManager from './SchoolMappingManager'

export const revalidate = 0

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function ScheduleSyncPage() {
  const supabase = createClient()
  const adminSupabase = getAdminClient()

  const [
    teamsResult,
    sportsResult,
    seasonsResult,
    teamSeasonsResult,
    teamMappingsResult,
    schoolMappingsResult,
    schoolsResult,
  ] = await Promise.all([
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

    supabase
      .from('team_seasons')
      .select('team_id, season_id, active_for_season'),

    adminSupabase
      .from('arbiter_team_mappings')
      .select('team_id, school_id, schedule_url'),

    adminSupabase
      .from('arbiter_school_mappings')
      .select('school_id, school_url'),

    adminSupabase
      .from('schools')
      .select('id, school_name, arbiter_school_url, arbiter_entity_id, active, is_section_x')
      .eq('active', true)
      .eq('is_section_x', true)
      .order('school_name'),
  ])

  if (teamsResult.error) throw new Error(teamsResult.error.message)
  if (sportsResult.error) throw new Error(sportsResult.error.message)
  if (seasonsResult.error) throw new Error(seasonsResult.error.message)
  if (teamSeasonsResult.error) throw new Error(teamSeasonsResult.error.message)
  if (teamMappingsResult.error) throw new Error(teamMappingsResult.error.message)
  if (schoolMappingsResult.error) throw new Error(schoolMappingsResult.error.message)
  if (schoolsResult.error) throw new Error(schoolsResult.error.message)

  const teams = (teamsResult.data || []).map((team: any) => ({
    ...team,
    school: Array.isArray(team.school)
      ? team.school[0] || null
      : team.school || null,
  }))

  const teamSchoolMap = Object.fromEntries(
    teams.map((team: any) => [team.id, team.school?.id || null])
  )

  return (
    <AdminLayout>
      <PersistentArbiterMappings
        teamMappings={teamMappingsResult.data || []}
        schoolMappings={schoolMappingsResult.data || []}
        teamSchoolMap={teamSchoolMap}
      />
      <SchoolMappingManager
        schools={schoolsResult.data || []}
        teams={teams}
        sports={sportsResult.data || []}
        teamMappings={teamMappingsResult.data || []}
      />
      <ScheduleSync
        teams={teams}
        sports={sportsResult.data || []}
        seasons={seasonsResult.data || []}
        teamSeasons={teamSeasonsResult.data || []}
      />
    </AdminLayout>
  )
}
