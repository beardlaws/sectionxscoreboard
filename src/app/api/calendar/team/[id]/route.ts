import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

function esc(value: unknown) {
  return String(value ?? '').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')
}
function short(value: string) {
  return value.replace(' Central High School','').replace(' Central School','').replace(' High School','').replace(' School','')
}
function dt(date: string, time: string | null) {
  if (!time) return `${date.replace(/-/g,'')}`
  const [h='00',m='00',s='00'] = time.split(':')
  return `${date.replace(/-/g,'')}T${h.padStart(2,'0')}${m.padStart(2,'0')}${s.padStart(2,'0')}`
}
function addHours(date: string, time: string | null, hours: number) {
  if (!time) return null
  const [h='00',m='00',s='00'] = time.split(':')
  const d = new Date(`${date}T${h}:${m}:${s}`)
  d.setHours(d.getHours() + hours)
  const pad=(n:number)=>String(n).padStart(2,'0')
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

    const team:any = await db.prepare('SELECT id,team_name,slug FROM teams WHERE id=? LIMIT 1').bind(params.id).first()
    if (!team) return new NextResponse('Team not found', { status: 404 })

    const season:any = await db.prepare('SELECT id,name FROM seasons WHERE is_active=1 LIMIT 1').first()
    let sql = `
      SELECT g.id,g.game_date,g.game_time,g.status,g.location,g.home_score,g.away_score,g.home_team_id,g.away_team_id,
             ht.team_name AS home_team_name, hs.school_name AS home_school_name,
             at.team_name AS away_team_name, aws.school_name AS away_school_name,
             eh.name AS external_home_name, ea.name AS external_away_name
      FROM games g
      LEFT JOIN teams ht ON ht.id=g.home_team_id
      LEFT JOIN schools hs ON hs.id=ht.school_id
      LEFT JOIN teams at ON at.id=g.away_team_id
      LEFT JOIN schools aws ON aws.id=at.school_id
      LEFT JOIN external_opponents eh ON eh.id=g.external_home_opponent_id
      LEFT JOIN external_opponents ea ON ea.id=g.external_away_opponent_id
      WHERE (g.home_team_id=? OR g.away_team_id=?)
    `
    const binds:any[] = [team.id,team.id]
    if (season?.id) { sql += ' AND g.season_id=?'; binds.push(season.id) }
    sql += ' ORDER BY g.game_date ASC,g.game_time ASC'
    const result = await db.prepare(sql).bind(...binds).all()
    const games:any[] = result.results || []

    const lines = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Section X Scoreboard//Team Calendar//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(team.team_name)}${season?.name ? ` - ${esc(season.name)}` : ''}`,
      'X-WR-TIMEZONE:America/New_York',
    ]

    for (const game of games) {
      const homeName = short(game.home_school_name || game.home_team_name || game.external_home_name || 'TBD')
      const awayName = short(game.away_school_name || game.away_team_name || game.external_away_name || 'TBD')
      const allDay = !game.game_time
      const start = dt(game.game_date, game.game_time)
      const end = addHours(game.game_date, game.game_time, 2)
      const final = String(game.status || '').toLowerCase() === 'final'
      const score = final && game.away_score != null && game.home_score != null ? ` · Final ${awayName} ${game.away_score}, ${homeName} ${game.home_score}` : ''
      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${game.id}@sectionxscoreboard.com`)
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`)
      if (allDay) lines.push(`DTSTART;VALUE=DATE:${start}`)
      else {
        lines.push(`DTSTART;TZID=America/New_York:${start}`)
        if (end) lines.push(`DTEND;TZID=America/New_York:${end}`)
      }
      lines.push(`SUMMARY:${esc(`${awayName} at ${homeName}${score}`)}`)
      if (game.location) lines.push(`LOCATION:${esc(game.location)}`)
      lines.push(`DESCRIPTION:${esc(`Section X Game Center: https://sectionxscoreboard.com/game-center/${game.id}`)}`)
      lines.push(`URL:https://sectionxscoreboard.com/game-center/${game.id}`)
      if (['canceled','cancelled'].includes(String(game.status||'').toLowerCase())) lines.push('STATUS:CANCELLED')
      lines.push('END:VEVENT')
    }
    lines.push('END:VCALENDAR')

    return new NextResponse(lines.join('\r\n') + '\r\n', {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': `inline; filename="${team.slug || 'section-x-team'}.ics"`,
        'cache-control': 'public, max-age=300',
      },
    })
  } catch (error) {
    console.error('[team-calendar]', error)
    return new NextResponse('Calendar unavailable', { status: 500 })
  }
}
