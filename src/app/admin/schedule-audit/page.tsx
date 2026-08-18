// src/app/admin/schedule-audit/page.tsx

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import ScheduleAudit from './ScheduleAudit'

export const revalidate = 0

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function ScheduleAuditPage() {
  const supabase = createClient()
  const adminSupabase = getAdminClient()

  const [
    { data: rawTeams },
    { data: sports },
    { data: seasons },
    { data: games },
    { data: importSources },
    { data: teamSeasons },
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
          alias,
          slug,
          primary_color
        )
      `),

    supabase
      .from('sports')
      .select('*')
      .order('sport_name'),

    supabase
      .from('seasons')
      .select('*')
      .order('year', {
        ascending: false,
      }),

    supabase
      .from('games')
      .select(`
        id,
        season_id,
        sport_id,
        home_team_id,
        away_team_id,
        external_home_opponent_id,
        external_away_opponent_id,
        game_date,
        game_time,
        location,
        status,
        parser_confidence,
        game_number
      `),

    /*
      Import tracking is admin-only infrastructure,
      so read it with the server-side secret client.
    */
    adminSupabase
      .from('game_import_sources')
      .select(`
        id,
        game_id,
        team_id,
        season_id,
        sport_id,
        source,
        imported_at
      `),

    /*
      Team Seasons tells us whether a team actually
      participates in a specific season.

      Example:
      Salmon River Football still exists historically,
      but active_for_season = false for Fall 2026.
    */
    supabase
      .from('team_seasons')
      .select(`
        id,
        team_id,
        season_id,
        active_for_season,
        class,
        division
      `),
  ])

  /*
    Supabase may type the joined school relation as
    an array. Normalize it to one school or null.
  */
  const teams =
    (rawTeams || []).map((team: any) => {
      const school = Array.isArray(team.school)
        ? team.school[0] || null
        : team.school || null

      return {
        id: team.id,
        team_name: team.team_name,
        sport_id: team.sport_id,
        level: team.level,
        active: team.active,
        school,
      }
    })

  return (
    <AdminLayout>
      <ScheduleAudit
        teams={teams}
        sports={sports || []}
        seasons={seasons || []}
        games={games || []}
        importSources={importSources || []}
        teamSeasons={teamSeasons || []}
      />
    </AdminLayout>
  )
}
