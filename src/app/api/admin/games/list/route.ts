import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

    const start = req.nextUrl.searchParams.get('start')
    const end = req.nextUrl.searchParams.get('end')
    const status = req.nextUrl.searchParams.get('status')
    const sportId = req.nextUrl.searchParams.get('sportId')
    const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit')) || 200))

    const where: string[] = ['1=1']
    const binds: any[] = []
    if (start) { where.push('g.game_date >= ?'); binds.push(start) }
    if (end) { where.push('g.game_date <= ?'); binds.push(end) }
    if (status) { where.push('g.status = ?'); binds.push(status) }
    if (sportId) { where.push('g.sport_id = ?'); binds.push(sportId) }

    const result = await db.prepare(`
      SELECT g.*,
        s.sport_name,
        ht.team_name AS home_team_name, hs.school_name AS home_school_name,
        at.team_name AS away_team_name, aws.school_name AS away_school_name,
        eh.name AS external_home_name, ea.name AS external_away_name
      FROM games g
      LEFT JOIN sports s ON s.id=g.sport_id
      LEFT JOIN teams ht ON ht.id=g.home_team_id
      LEFT JOIN schools hs ON hs.id=ht.school_id
      LEFT JOIN teams at ON at.id=g.away_team_id
      LEFT JOIN schools aws ON aws.id=at.school_id
      LEFT JOIN external_opponents eh ON eh.id=g.external_home_opponent_id
      LEFT JOIN external_opponents ea ON ea.id=g.external_away_opponent_id
      WHERE ${where.join(' AND ')}
      ORDER BY g.game_date DESC, g.game_time DESC
      LIMIT ?
    `).bind(...binds, limit).all()

    const games = (result.results || []).map((r: any) => ({
      ...r,
      sport: r.sport_id ? { sport_name: r.sport_name } : null,
      home_team: r.home_team_id ? { team_name: r.home_team_name, school: r.home_school_name ? { school_name: r.home_school_name } : null } : null,
      away_team: r.away_team_id ? { team_name: r.away_team_name, school: r.away_school_name ? { school_name: r.away_school_name } : null } : null,
      external_home: r.external_home_opponent_id ? { name: r.external_home_name } : null,
      external_away: r.external_away_opponent_id ? { name: r.external_away_name } : null,
      league_designation_override: Boolean(r.league_designation_override),
      schedule_override: Boolean(r.schedule_override),
    }))

    const [sportsResult, teamsResult] = await Promise.all([
      db.prepare('SELECT id,sport_name,gender FROM sports ORDER BY sport_name').all(),
      db.prepare(`SELECT t.id,t.sport_id,t.team_name,sc.school_name FROM teams t LEFT JOIN schools sc ON sc.id=t.school_id WHERE t.active=1 ORDER BY t.team_name`).all(),
    ])
    const sports = sportsResult.results || []
    const teams = (teamsResult.results || []).map((r: any) => ({ id:r.id, sport_id:r.sport_id, team_name:r.team_name, school:r.school_name ? { school_name:r.school_name } : null }))

    return NextResponse.json({ ok:true, games, sports, teams })
  } catch (error: any) {
    console.error('[admin/games/list]', error)
    return NextResponse.json({ ok:false, error:error?.message || 'Could not load games' }, { status:500 })
  }
}
