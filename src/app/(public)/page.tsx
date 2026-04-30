// src/app/(public)/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'
import HomeClient from '@/components/home/HomeClient'
import { format } from 'date-fns'

export const metadata: Metadata = {
  title: 'Section X Scoreboard | North Country High School Sports Scores',
  description: "Tonight's Section X scores, schedules, and standings for North Country high school sports. Baseball, softball, lacrosse, football, basketball, hockey, and more.",
}

export const revalidate = 60 // Revalidate every minute

async function getHomepageData() {
  const supabase = createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  // Active season
  const { data: activeSeason } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .single()

  // Tonight's games
  const { data: todayGames } = await supabase
    .from('games')
    .select(`
      *,
      sport:sports(*),
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(*),
      external_away:external_opponents!games_external_away_opponent_id_fkey(*)
    `)
    .eq('game_date', today)
    .order('game_time', { ascending: true })

  // Recent finals (last 7 days, grouped by date on client)
  const sevenDaysAgo = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd')
  const { data: recentGames } = await supabase
    .from('games')
    .select(`
      *,
      sport:sports(*),
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(*),
      external_away:external_opponents!games_external_away_opponent_id_fkey(*)
    `)
    .eq('status', 'Final')
    .gte('game_date', sevenDaysAgo)
    .order('game_date', { ascending: false })
    .order('game_time', { ascending: true })
    .limit(100)

  // Featured game
  const { data: featuredGame } = await supabase
    .from('games')
    .select(`
      *,
      sport:sports(*),
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*))
    `)
    .eq('game_of_the_night', true)
    .eq('game_date', today)
    .single()

  // Featured photo
  const { data: featuredPhoto } = await supabase
    .from('photos')
    .select('*, school:schools(*)')
    .eq('approved', true)
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Active season sports standings preview
  const { data: standings } = activeSeason
    ? await supabase
        .from('games')
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
          away_team:teams!games_away_team_id_fkey(*, school:schools(*))
        `)
        .eq('season_id', activeSeason.id)
        .eq('status', 'Final')
    : { data: [] }

  // Sponsor
  const { data: homepageSponsor } = await supabase
    .from('sponsors')
    .select('*')
    .eq('placement', 'homepage')
    .eq('active', true)
    .single()

  // Schools for search
  const { data: schools } = await supabase
    .from('schools')
    .select('*')
    .eq('active', true)
    .order('school_name')

  return {
    activeSeason,
    todayGames: todayGames || [],
    recentGames: recentGames || [],
    featuredGame: featuredGame || null,
    featuredPhoto: featuredPhoto || null,
    allStandingsGames: standings || [],
    homepageSponsor: homepageSponsor || null,
    schools: schools || [],
    today,
  }
}

export default async function HomePage() {
  const data = await getHomepageData()

  // Latest shoutout for sidebar
  const { data: latestShoutout } = await supabase
    .from('shoutouts')
    .select('*')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <PublicLayout>
      <HomeClient {...data} />
    </PublicLayout>
  )
}
