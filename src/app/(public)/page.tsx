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

export const revalidate = 60

const GAME_SELECT = `
  *,
  sport:sports(*),
  home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
  away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
  external_home:external_opponents!games_external_home_opponent_id_fkey(*),
  external_away:external_opponents!games_external_away_opponent_id_fkey(*)
`

async function getHomepageData() {
  const supabase = createClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const sevenDaysAgo = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd')

  const { data: activeSeason } = await supabase
    .from('seasons').select('*').eq('is_active', true).single()

  const [
    { data: todayGames },
    { data: recentGames },
    { data: featuredGame },
    { data: featuredPhoto },
    { data: standings },
    { data: homepageSponsor },
    { data: schools },
    { data: latestShoutout },
  ] = await Promise.all([
    supabase.from('games').select(GAME_SELECT)
      .eq('game_date', today)
      .order('game_time', { ascending: true }),

    supabase.from('games').select(GAME_SELECT)
      .eq('status', 'Final')
      .gte('game_date', sevenDaysAgo)
      .order('game_date', { ascending: false })
      .order('game_time', { ascending: true })
      .limit(100),

    // Featured game - NOW includes external opponents
    supabase.from('games').select(GAME_SELECT)
      .eq('game_of_the_night', true)
      .eq('game_date', today)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase.from('photos').select('*, school:schools(*)')
      .eq('approved', true).eq('featured', true)
      .order('created_at', { ascending: false }).limit(1).single(),

    activeSeason
      ? supabase.from('games').select(`
          *,
          home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
          away_team:teams!games_away_team_id_fkey(*, school:schools(*))
        `).eq('season_id', activeSeason.id).eq('status', 'Final')
      : Promise.resolve({ data: [] }),

    supabase.from('sponsors').select('*')
      .eq('placement', 'homepage').eq('active', true).single(),

    supabase.from('schools').select('*').eq('active', true).order('school_name'),

    supabase.from('shoutouts').select('*').eq('approved', true)
      .order('created_at', { ascending: false }).limit(1).single(),
  ])

  return {
    activeSeason,
    todayGames: todayGames || [],
    recentGames: recentGames || [],
    featuredGame: featuredGame || null,
    featuredPhoto: featuredPhoto || null,
    allStandingsGames: standings || [],
    homepageSponsor: homepageSponsor || null,
    latestShoutout: latestShoutout || null,
    schools: schools || [],
    today,
  }
}

export default async function HomePage() {
  const data = await getHomepageData()
  return (
    <PublicLayout>
      <HomeClient {...data} />
    </PublicLayout>
  )
}
