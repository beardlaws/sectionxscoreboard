import { notFound } from 'next/navigation'
import AdminLayout from '@/components/layout/AdminLayout'
import { createClient } from '@/lib/supabase/server'
import GameCenterEditor from './GameCenterEditor'

export const dynamic = 'force-dynamic'

type PageProps = { params: { id: string } }

export default async function AdminGameCenterPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: game, error } = await supabase
    .from('games')
    .select(`
      id, game_date, game_time, status, home_score, away_score, sport_id, season_id,
      home_team_id, away_team_id, recap, recap_author, source,
      sport:sports(id, sport_name, gender),
      season:seasons(id, name),
      home_team:teams!games_home_team_id_fkey(id, team_name, school:schools(id, school_name, logo_url, primary_color)),
      away_team:teams!games_away_team_id_fkey(id, team_name, school:schools(id, school_name, logo_url, primary_color)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(name),
      external_away:external_opponents!games_external_away_opponent_id_fkey(name)
    `)
    .eq('id', params.id)
    .single()

  if (error || !game) notFound()

  const [periodsRes, teamStatsRes, athleteStatsRes, statDefsRes, homeRosterRes, awayRosterRes] = await Promise.all([
    supabase.from('game_period_scores').select('*').eq('game_id', params.id).order('period_number'),
    supabase.from('game_team_stats').select('*').eq('game_id', params.id),
    supabase.from('game_athlete_stats').select('*').eq('game_id', params.id),
    supabase.from('stat_definitions').select('*').eq('sport_id', game.sport_id).eq('active', true).order('sort_order'),
    game.home_team_id
      ? supabase.from('roster_entries').select('athlete_id, jersey_number, position, athlete:athletes(id, display_name, slug)').eq('team_id', game.home_team_id).eq('season_id', game.season_id).eq('active', true).order('jersey_number')
      : Promise.resolve({ data: [] as any[] }),
    game.away_team_id
      ? supabase.from('roster_entries').select('athlete_id, jersey_number, position, athlete:athletes(id, display_name, slug)').eq('team_id', game.away_team_id).eq('season_id', game.season_id).eq('active', true).order('jersey_number')
      : Promise.resolve({ data: [] as any[] }),
  ])

  return (
    <AdminLayout>
      <GameCenterEditor
        game={game as any}
        periods={(periodsRes.data || []) as any[]}
        teamStats={(teamStatsRes.data || []) as any[]}
        athleteStats={(athleteStatsRes.data || []) as any[]}
        statDefinitions={(statDefsRes.data || []) as any[]}
        homeRoster={(homeRosterRes.data || []) as any[]}
        awayRoster={(awayRosterRes.data || []) as any[]}
      />
    </AdminLayout>
  )
}
