// src/app/(public)/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'
import HomeClient from '@/components/home/HomeClient'
import { format } from 'date-fns'

export const metadata: Metadata = {
  description: 'Section X scores, schedules, standings, results, schools, and stories for Northern New York high school sports.',
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
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const yesterday = format(new Date(now.getTime() - 86400000), 'yyyy-MM-dd')
  const tomorrow = format(new Date(now.getTime() + 86400000), 'yyyy-MM-dd')
  const fourteenDaysOut = format(new Date(now.getTime() + 14 * 86400000), 'yyyy-MM-dd')
  const sevenDaysAgo = format(new Date(now.getTime() - 7 * 86400000), 'yyyy-MM-dd')

  const { data: activeSeason } = await supabase
    .from('seasons').select('*').eq('is_active', true).single()

  const [
    { data: yesterdayGames },
    { data: todayGames },
    { data: tomorrowGames },
    { data: upcomingGames },
    { data: recentGames },
    { data: featuredGame },
    { data: homepageSponsor },
    { data: schools },
    { data: featuredSpotlight },
    { data: featuredAthlete },
    { data: allSpotlights },
    { data: featuredPhoto },
  ] = await Promise.all([
    supabase.from('games').select(GAME_SELECT)
      .eq('game_date', yesterday).order('game_time', { ascending: true }),
    supabase.from('games').select(GAME_SELECT)
      .eq('game_date', today).order('game_time', { ascending: true }),
    supabase.from('games').select(GAME_SELECT)
      .eq('game_date', tomorrow).order('game_time', { ascending: true }),
    supabase.from('games').select(GAME_SELECT)
      .gt('game_date', today).lte('game_date', fourteenDaysOut)
      .order('game_date', { ascending: true }).order('game_time', { ascending: true }).limit(160),
    supabase.from('games').select(GAME_SELECT)
      .eq('status', 'Final').gte('game_date', sevenDaysAgo)
      .order('game_date', { ascending: false })
      .order('game_time', { ascending: false }).limit(80),
    supabase.from('games').select(GAME_SELECT)
      .eq('game_of_the_night', true).eq('game_date', today)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('sponsors').select('*')
      .eq('placement_type', 'homepage').eq('active', true)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('schools').select('*')
      .eq('active', true).eq('is_section_x', true).order('school_name'),
    supabase.from('spotlights').select('*')
      .eq('published', true).eq('featured', true)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('athlete_of_week')
      .select('*, school:schools(id, school_name, slug, primary_color, logo_url)')
      .eq('published', true).order('week_of', { ascending: false })
      .limit(1).maybeSingle(),
    supabase.from('spotlights').select('id, title, body, author, created_at, sport_name')
      .eq('published', true).order('created_at', { ascending: false }).limit(6),
    supabase.from('photos').select('*, school:schools(id, school_name, slug, primary_color, logo_url)')
      .eq('approved', true).order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  return {
    activeSeason: activeSeason || null,
    yesterdayGames: yesterdayGames || [],
    todayGames: todayGames || [],
    tomorrowGames: tomorrowGames || [],
    upcomingGames: upcomingGames || [],
    recentGames: recentGames || [],
    featuredGame: featuredGame || null,
    homepageSponsor: homepageSponsor || null,
    schools: schools || [],
    today,
    featuredSpotlight: featuredSpotlight || null,
    featuredAthlete: featuredAthlete || null,
    allSpotlights: allSpotlights || [],
    featuredPhoto: featuredPhoto || null,
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
