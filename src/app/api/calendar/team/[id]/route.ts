import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function joined<T = any>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null
}
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
  const supabase = createClient()
  const { data: team } = await supabase.from('teams').select('id,team_name,slug').eq('id', params.id).maybeSingle()
  if (!team) return new NextResponse('Team not found', { status: 404 })

  const { data: season } = await supabase.from('seasons').select('id,name').eq('is_active', true).limit(1).maybeSingle()
  let query = supabase.from('games').select(`id,game_date,game_time,status,location,home_score,away_score,home_team_id,away_team_id,home_team:teams!games_home_team_id_fkey(team_name,school:schools(school_name)),away_team:teams!games_away_team_id_fkey(team_name,school:schools(school_name)),external_home:external_opponents!games_external_home_opponent_id_fkey(name),external_away:external_opponents!games_external_away_opponent_id_fkey(name)`).or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`).order('game_date').order('game_time')
  if (season?.id) query = query.eq('season_id', season.id)
  const { data: games } = await query

  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Section X Scoreboard//Team Calendar//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(team.team_name)}${season?.name ? ` - ${esc(season.name)}` : ''}`,
    'X-WR-TIMEZONE:America/New_York',
  ]

  for (const game of games || []) {
    const home = joined<any>((game as any).home_team), away = joined<any>((game as any).away_team)
    const hs = joined<any>(home?.school), as = joined<any>(away?.school)
    const eh = joined<any>((game as any).external_home), ea = joined<any>((game as any).external_away)
    const homeName = short(home?.team_name || hs?.school_name || eh?.name || 'TBD')
    const awayName = short(away?.team_name || as?.school_name || ea?.name || 'TBD')
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
}
