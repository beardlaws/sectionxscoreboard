// src/app/admin/roster-audit/page.tsx

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import RosterAudit from './RosterAudit'

export const revalidate = 0

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function RosterAuditPage() {
  const supabase = createClient()
  const adminSupabase = getAdminClient()

  const [
    { data: schools, error: schoolsError },
    { data: rawTeams, error: teamsError },
    { data: sports, error: sportsError },
    { data: seasons, error: seasonsError },
    { data: teamSeasons, error: teamSeasonsError },
    { data: rosterEntries, error: rosterError },
    { data: coachEntries, error: coachError },
  ] = await Promise.all([
    supabase
      .from('schools')
      .select(`
        id,
        school_name,
        slug,
        alias,
        active,
        arbiter_entity_id,
        arbiter_school_url
      `)
      .eq('active', true)
      .order('school_name'),

    supabase
      .from('teams')
      .select(`
        id,
        school_id,
        sport_id,
        team_name,
        slug,
        level,
        active
      `)
      .eq('active', true)
      .order('team_name'),

    supabase
      .from('sports')
      .select(`
        id,
        sport_name,
        gender,
        season_type,
        slug
      `)
      .order('sport_name'),

    supabase
      .from('seasons')
      .select(`
        id,
        name,
        season_type,
        year,
        is_active
      `)
      .order('year', { ascending: false }),

    supabase
      .from('team_seasons')
      .select(`
        id,
        team_id,
        season_id,
        active_for_season,
        division,
        class
      `),

    adminSupabase
      .from('roster_entries')
      .select(`
        id,
        team_id,
        season_id,
        athlete_id,
        active,
        imported_at,
        source
      `)
      .eq('active', true),

    adminSupabase
      .from('team_coaches')
      .select(`
        id,
        team_id,
        season_id,
        coach_id,
        active,
        imported_at,
        source
      `)
      .eq('active', true),
  ])

  const errors = [
    schoolsError,
    teamsError,
    sportsError,
    seasonsError,
    teamSeasonsError,
    rosterError,
    coachError,
  ].filter(Boolean)

  if (errors.length > 0) {
    throw new Error(
      errors.map((error: any) => error.message).join(' | ')
    )
  }

  return (
    <AdminLayout>
      <RosterAudit
        schools={schools || []}
        teams={rawTeams || []}
        sports={sports || []}
        seasons={seasons || []}
        teamSeasons={teamSeasons || []}
        rosterEntries={rosterEntries || []}
        coachEntries={coachEntries || []}
      />
    </AdminLayout>
  )
}
