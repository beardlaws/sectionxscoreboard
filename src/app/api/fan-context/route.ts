import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic='force-dynamic'

function isLiveStatus(status: unknown) {
  const key = String(status || '').trim().toLowerCase()
  return key === 'live' || key === 'in progress'
}

export async function GET(req: NextRequest) {
  try {
    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

    const teamSlug = req.nextUrl.searchParams.get('teamSlug')?.trim()
    const gameId = req.nextUrl.searchParams.get('gameId')?.trim()

    if (teamSlug) {
      const data:any = await db.prepare(`
        SELECT t.id,t.team_name,t.slug,s.school_name,sp.sport_name,sp.gender
        FROM teams t
        LEFT JOIN schools s ON s.id=t.school_id
        LEFT JOIN sports sp ON sp.id=t.sport_id
        WHERE t.slug=?
        LIMIT 1
      `).bind(teamSlug).first()
      if (!data) return NextResponse.json({ error: 'Team not found.' }, { status: 404 })
      return NextResponse.json({
        type: 'team',
        team: {
          id: data.id,
          name: data.team_name,
          schoolName: data.school_name || null,
          sportName: data.sport_name || null,
          gender: data.gender || null,
        },
      })
    }

    if (gameId) {
      const data:any = await db.prepare(`
        SELECT g.id,g.status,g.contest_type,
          ht.id AS home_team_id,ht.team_name AS home_team_name,hs.school_name AS home_school_name,
          at.id AS away_team_id,at.team_name AS away_team_name,aschool.school_name AS away_school_name
        FROM games g
        LEFT JOIN teams ht ON ht.id=g.home_team_id
        LEFT JOIN schools hs ON hs.id=ht.school_id
        LEFT JOIN teams at ON at.id=g.away_team_id
        LEFT JOIN schools aschool ON aschool.id=at.school_id
        WHERE g.id=?
        LIMIT 1
      `).bind(gameId).first()
      if (!data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
      const scrimmage = String(data.contest_type || '').toLowerCase() === 'scrimmage'
      return NextResponse.json({
        type: 'game',
        game: { id: data.id, status: data.status || 'Scheduled', live: !scrimmage && isLiveStatus(data.status) },
        homeTeam: data.home_team_id ? { id: data.home_team_id, name: data.home_team_name || data.home_school_name || 'Home team' } : null,
        awayTeam: data.away_team_id ? { id: data.away_team_id, name: data.away_team_name || data.away_school_name || 'Away team' } : null,
      })
    }

    return NextResponse.json({ error: 'Provide teamSlug or gameId.' }, { status: 400 })
  } catch (e:any) {
    console.error('[fan-context]',e)
    return NextResponse.json({ error: 'Could not load fan context.' }, { status: 500 })
  }
}
