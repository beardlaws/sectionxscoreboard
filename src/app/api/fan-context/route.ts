import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function joined<T = any>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function isLiveStatus(status: unknown) {
  const key = String(status || '').trim().toLowerCase()
  return key === 'live' || key === 'in progress'
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const teamSlug = req.nextUrl.searchParams.get('teamSlug')?.trim()
  const gameId = req.nextUrl.searchParams.get('gameId')?.trim()

  if (teamSlug) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, team_name, slug, school:schools(school_name), sport:sports(sport_name, gender)')
      .eq('slug', teamSlug)
      .maybeSingle()

    if (error) return NextResponse.json({ error: 'Could not load team.' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Team not found.' }, { status: 404 })

    const school = joined<any>((data as any).school)
    const sport = joined<any>((data as any).sport)
    return NextResponse.json({
      type: 'team',
      team: {
        id: data.id,
        name: data.team_name,
        schoolName: school?.school_name || null,
        sportName: sport?.sport_name || null,
        gender: sport?.gender || null,
      },
    })
  }

  if (gameId) {
    const { data, error } = await supabase
      .from('games')
      .select(`
        id, status, contest_type,
        home_team:teams!games_home_team_id_fkey(id, team_name, school:schools(school_name)),
        away_team:teams!games_away_team_id_fkey(id, team_name, school:schools(school_name))
      `)
      .eq('id', gameId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: 'Could not load game.' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })

    const home = joined<any>((data as any).home_team)
    const away = joined<any>((data as any).away_team)
    const homeSchool = joined<any>(home?.school)
    const awaySchool = joined<any>(away?.school)
    const scrimmage = String((data as any).contest_type || '').toLowerCase() === 'scrimmage'

    return NextResponse.json({
      type: 'game',
      game: {
        id: data.id,
        status: data.status || 'Scheduled',
        live: !scrimmage && isLiveStatus(data.status),
      },
      homeTeam: home ? { id: home.id, name: home.team_name || homeSchool?.school_name || 'Home team' } : null,
      awayTeam: away ? { id: away.id, name: away.team_name || awaySchool?.school_name || 'Away team' } : null,
    })
  }

  return NextResponse.json({ error: 'Provide teamSlug or gameId.' }, { status: 400 })
}
