// src/app/admin/schedule-audit/page.tsx

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import ScheduleAudit from './ScheduleAudit'

export const revalidate = 0

const PAGE_SIZE = 1000

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function fetchAllTeams(supabase: any) {
  const rows: any[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
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
      `)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Could not load teams: ${error.message}`)
    }

    const page = data || []
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return rows
}

async function fetchAllGames(supabase: any) {
  const rows: any[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
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
      `)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Could not load games: ${error.message}`)
    }

    const page = data || []
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return rows
}

async function fetchAllImportSources(adminSupabase: any) {
  const rows: any[] = []
  let from = 0

  while (true) {
    const { data, error } = await adminSupabase
      .from('game_import_sources')
      .select(`
        id,
        game_id,
        team_id,
        season_id,
        sport_id,
        source,
        imported_at
      `)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(
        `Could not load import sources: ${error.message}`
      )
    }

    const page = data || []
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return rows
}

async function fetchAllTeamSeasons(supabase: any) {
  const rows: any[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('team_seasons')
      .select(`
        id,
        team_id,
        season_id,
        active_for_season,
        class,
        division
      `)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw new Error(
        `Could not load team seasons: ${error.message}`
      )
    }

    const page = data || []
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return rows
}

export default async function ScheduleAuditPage() {
  const supabase = createClient()
  const adminSupabase = getAdminClient()

  /*
    IMPORTANT:
    Supabase limits SELECT results to a maximum number of rows
    (commonly 1,000). Schedule Audit needs the complete dataset,
    otherwise teams later in the result set appear to have partial
    schedules even though their public team pages are correct.

    These helpers paginate until every row has been loaded.
  */
  const [
    rawTeams,
    sportsResult,
    seasonsResult,
    games,
    importSources,
    teamSeasons,
  ] = await Promise.all([
    fetchAllTeams(supabase),

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

    fetchAllGames(supabase),

    fetchAllImportSources(adminSupabase),

    fetchAllTeamSeasons(supabase),
  ])

  if (sportsResult.error) {
    throw new Error(
      `Could not load sports: ${sportsResult.error.message}`
    )
  }

  if (seasonsResult.error) {
    throw new Error(
      `Could not load seasons: ${seasonsResult.error.message}`
    )
  }

  /*
    Supabase may type the joined school relation as an array.
    Normalize it to one school or null.
  */
  const teams = (rawTeams || []).map((team: any) => {
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
        sports={sportsResult.data || []}
        seasons={seasonsResult.data || []}
        games={games}
        importSources={importSources}
        teamSeasons={teamSeasons}
      />
    </AdminLayout>
  )
}
