// src/app/(public)/scores/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'
import ScoresClient from './ScoresClient'
import { format } from 'date-fns'

export const metadata: Metadata = {
  title: 'Scores',
  description: 'Section X high school sports scores and results by date.',
}

export const revalidate = 60

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: { date?: string; sport?: string }
}) {
  const supabase = createClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const selectedDate = searchParams.date || today

  const { data: games } = await supabase
    .from('games')
    .select(`
      *,
      sport:sports(*),
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(*),
      external_away:external_opponents!games_external_away_opponent_id_fkey(*)
    `)
    .eq('game_date', selectedDate)
    .order('game_time', { ascending: true })

  const { data: sports } = await supabase
    .from('sports')
    .select('*')
    .eq('active_public', true)
    .order('sport_name')

  // Get date range with games
  const { data: gameDates } = await supabase
    .from('games')
    .select('game_date')
    .gte('game_date', format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd'))
    .lte('game_date', format(new Date(Date.now() + 14 * 86400000), 'yyyy-MM-dd'))

  const datesWithGames = [...new Set((gameDates || []).map(g => g.game_date))].sort()

  return (
    <PublicLayout>
      <ScoresClient
        games={games || []}
        sports={sports || []}
        selectedDate={selectedDate}
        today={today}
        datesWithGames={datesWithGames}
      />
    </PublicLayout>
  )
}
