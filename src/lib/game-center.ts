import type { SupabaseClient } from '@supabase/supabase-js'

export async function getGameCenterData(supabase: SupabaseClient, gameId: string) {
  const [periods, teamStats, athleteStats] = await Promise.all([
    supabase.from('game_period_scores').select('*').eq('game_id', gameId).order('period_number'),
    supabase.from('game_team_stats').select('*, stat_definition:stat_definitions(label, unit, sort_order)').eq('game_id', gameId),
    supabase.from('game_athlete_stats').select('*, athlete:athletes(display_name, slug), stat_definition:stat_definitions(label, unit, sort_order)').eq('game_id', gameId),
  ])

  return {
    periodScores: periods.data || [],
    teamStats: teamStats.data || [],
    athleteStats: athleteStats.data || [],
  }
}
