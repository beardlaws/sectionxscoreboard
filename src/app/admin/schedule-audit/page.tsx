// src/app/admin/schedule-audit/page.tsx

import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import ScheduleAudit from './ScheduleAudit'

export const revalidate = 0

export default async function ScheduleAuditPage() {
  const supabase = createClient()

  const [
    { data: teams },
    { data: sports },
    { data: seasons },
    { data: games },
    { data: importSources },
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

    supabase
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
  ])

  return (
    <AdminLayout>
      <ScheduleAudit
        teams={teams || []}
        sports={sports || []}
        seasons={seasons || []}
        games={games || []}
        importSources={
          importSources || []
        }
      />
    </AdminLayout>
  )
}
