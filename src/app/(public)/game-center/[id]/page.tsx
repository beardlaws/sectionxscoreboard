import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import PublicLayout from '@/components/layout/PublicLayout'
import SchoolLogo from '@/components/SchoolLogo'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 60

type PageProps = { params: { id: string } }

type StatRow = {
  team_side: 'home' | 'away'
  value_numeric: number | null
  value_text: string | null
  stat_definition: {
    id: string
    stat_key: string
    label: string
    category: string | null
    unit: string | null
    sort_order: number | null
  } | null
}

type AthleteStatRow = {
  athlete_id: string
  team_id: string | null
  value_numeric: number | null
  value_text: string | null
  verified: boolean | null
  athlete: { id: string; display_name: string; slug: string | null } | null
  stat_definition: {
    id: string
    stat_key: string
    label: string
    category: string | null
    unit: string | null
    sort_order: number | null
  } | null
}

function gameTimeLabel(value: string | null) {
  if (!value) return 'Time TBA'
  const [hourRaw, minuteRaw] = value.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`
}

function valueLabel(valueNumeric: number | null, valueText: string | null, unit?: string | null) {
  const base = valueText ?? (valueNumeric !== null ? String(valueNumeric) : '—')
  return unit && base !== '—' ? `${base}${unit}` : base
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createClient()
  const { data: game } = await supabase
    .from('games')
    .select(`
      game_date, home_score, away_score, status,
      sport:sports(sport_name),
      home_team:teams!games_home_team_id_fkey(school:schools(school_name)),
      away_team:teams!games_away_team_id_fkey(school:schools(school_name)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(name),
      external_away:external_opponents!games_external_away_opponent_id_fkey(name)
    `)
    .eq('id', params.id)
    .single()

  if (!game) return { title: 'Game Center' }
  const row: any = game
  const home = row.home_team?.school?.school_name || row.external_home?.name || 'Home'
  const away = row.away_team?.school?.school_name || row.external_away?.name || 'Away'
  const sport = row.sport?.sport_name || 'Section X Sports'
  const date = format(parseISO(`${row.game_date}T12:00:00`), 'M/d/yyyy')
  const finalText = row.status === 'Final' ? ` Final: ${away} ${row.away_score}, ${home} ${row.home_score}.` : ''
  return {
    title: `${away} at ${home} | Game Center`,
    description: `${sport} Game Center for ${away} at ${home} on ${date}.${finalText}`,
  }
}

export default async function GameCenterPage({ params }: PageProps) {
  const supabase = createClient()
  const { data: gameData, error } = await supabase
    .from('games')
    .select(`
      *,
      sport:sports(*),
      season:seasons(*),
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(*),
      external_away:external_opponents!games_external_away_opponent_id_fkey(*)
    `)
    .eq('id', params.id)
    .single()

  if (!gameData || error) notFound()
  const game: any = gameData
  const homeTeam = game.home_team
  const awayTeam = game.away_team
  const homeSchool = homeTeam?.school || null
  const awaySchool = awayTeam?.school || null
  const homeName = homeSchool?.school_name || game.external_home?.name || 'TBD'
  const awayName = awaySchool?.school_name || game.external_away?.name || 'TBD'
  const isFinal = game.status === 'Final'
  const isLive = game.status === 'Live'
  const homeWins = isFinal && game.home_score != null && game.away_score != null && game.home_score > game.away_score
  const awayWins = isFinal && game.home_score != null && game.away_score != null && game.away_score > game.home_score

  const [photosRes, periodsRes, teamStatsRes, athleteStatsRes] = await Promise.all([
    supabase.from('photos').select('*').eq('game_id', game.id).eq('approved', true).order('featured', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('game_period_scores').select('*').eq('game_id', game.id).order('period_number'),
    supabase.from('game_team_stats').select(`team_side, value_numeric, value_text, stat_definition:stat_definitions(id, stat_key, label, category, unit, sort_order)`).eq('game_id', game.id),
    supabase.from('game_athlete_stats').select(`athlete_id, team_id, value_numeric, value_text, verified, athlete:athletes(id, display_name, slug), stat_definition:stat_definitions(id, stat_key, label, category, unit, sort_order)`).eq('game_id', game.id),
  ])

  const photos = photosRes.data || []
  const periods = periodsRes.data || []
  const teamStats = (teamStatsRes.data || []) as unknown as StatRow[]
  const athleteStats = (athleteStatsRes.data || []) as unknown as AthleteStatRow[]

  async function recordFor(teamId: string | null) {
    if (!teamId || !game.season_id || !game.sport_id) return null
    const { data } = await supabase
      .from('games')
      .select('home_team_id, away_team_id, home_score, away_score, status')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('season_id', game.season_id)
      .eq('sport_id', game.sport_id)
      .eq('status', 'Final')
    if (!data) return null
    let w = 0, l = 0, t = 0
    const lowerWins = String(game.sport?.sport_name || '').toLowerCase().includes('golf')
    for (const row of data) {
      if (row.home_score == null || row.away_score == null) continue
      const mine = row.home_team_id === teamId ? row.home_score : row.away_score
      const opp = row.home_team_id === teamId ? row.away_score : row.home_score
      if (mine === opp) t += 1
      else if (lowerWins ? mine < opp : mine > opp) w += 1
      else l += 1
    }
    return `${w}-${l}${t ? `-${t}` : ''}`
  }

  async function nextGame(teamId: string | null) {
    if (!teamId) return null
    const { data } = await supabase
      .from('games')
      .select(`
        id, game_date, game_time, home_team_id, away_team_id,
        home_team:teams!games_home_team_id_fkey(school:schools(school_name)),
        away_team:teams!games_away_team_id_fkey(school:schools(school_name)),
        external_home:external_opponents!games_external_home_opponent_id_fkey(name),
        external_away:external_opponents!games_external_away_opponent_id_fkey(name)
      `)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .gte('game_date', game.game_date)
      .neq('id', game.id)
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true })
      .limit(1)
      .maybeSingle()
    return data as any
  }

  const [homeRecord, awayRecord, homeNext, awayNext] = await Promise.all([
    recordFor(homeTeam?.id || null),
    recordFor(awayTeam?.id || null),
    nextGame(homeTeam?.id || null),
    nextGame(awayTeam?.id || null),
  ])

  const periodNumbers = Array.from(new Set(periods.map((p: any) => p.period_number))).sort((a: number, b: number) => a - b)
  const periodLabel = (n: number) => periods.find((p: any) => p.period_number === n && p.period_label)?.period_label || String(n)
  const scoreFor = (side: 'home' | 'away', n: number) => periods.find((p: any) => p.team_side === side && p.period_number === n)?.score ?? '—'

  const statDefs = Array.from(new Map(teamStats.filter(s => s.stat_definition).map(s => [s.stat_definition!.id, s.stat_definition!])).values())
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const teamStatValue = (side: 'home' | 'away', defId: string) => teamStats.find(s => s.team_side === side && s.stat_definition?.id === defId)

  const athleteMap = new Map<string, { athlete: AthleteStatRow['athlete']; teamId: string | null; verified: boolean; stats: Map<string, AthleteStatRow> }>()
  for (const row of athleteStats) {
    if (!row.athlete || !row.stat_definition) continue
    const current = athleteMap.get(row.athlete_id) || { athlete: row.athlete, teamId: row.team_id, verified: true, stats: new Map<string, AthleteStatRow>() }
    current.verified = current.verified && Boolean(row.verified)
    current.stats.set(row.stat_definition.id, row)
    athleteMap.set(row.athlete_id, current)
  }
  const athleteDefs = Array.from(new Map(athleteStats.filter(s => s.stat_definition).map(s => [s.stat_definition!.id, s.stat_definition!])).values())
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const athletesByTeam = (teamId: string | null) => Array.from(athleteMap.values()).filter(a => a.teamId === teamId)

  const nextOpponent = (next: any, teamId: string | null) => {
    if (!next || !teamId) return null
    const isHome = next.home_team_id === teamId
    const opponent = isHome
      ? next.away_team?.school?.school_name || next.external_away?.name || 'TBD'
      : next.home_team?.school?.school_name || next.external_home?.name || 'TBD'
    return { opponent, prefix: isHome ? 'vs' : 'at' }
  }
  const homeNextOpponent = nextOpponent(homeNext, homeTeam?.id || null)
  const awayNextOpponent = nextOpponent(awayNext, awayTeam?.id || null)
  const dataLevel = athleteStats.length ? 4 : teamStats.length ? 3 : periods.length ? 2 : 1

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/scores" className="hover:text-white">Scores</Link>
            <span>/</span>
            <span>{game.sport?.sport_name || 'Sport'}</span>
            <span>/</span>
            <span>{format(parseISO(`${game.game_date}T12:00:00`), 'MMM d, yyyy')}</span>
          </div>
          <Link href={`/games/${game.id}`} className="hover:text-white">Classic game view</Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/10" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))' }}>
          <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap border-b border-white/10">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Game Center</div>
              <div className="text-sm text-slate-300 mt-1">
                {game.sport?.sport_name} · {format(parseISO(`${game.game_date}T12:00:00`), 'EEEE, MMMM d, yyyy')} · {gameTimeLabel(game.game_time)}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${isLive ? 'bg-red-500/20 text-red-300' : isFinal ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'}`}>{game.status}</span>
              {game.verification_status === 'Official' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/5 text-slate-300 border border-white/10">Verified</span>}
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/5 text-slate-400 border border-white/10">Data Level {dataLevel}/4</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center px-4 sm:px-8 py-8">
            <div className="text-center flex flex-col items-center min-w-0">
              <SchoolLogo school={awaySchool} size="xl" />
              <Link href={awaySchool ? `/schools/${awaySchool.slug}` : '#'} className={`mt-3 text-lg sm:text-2xl font-black leading-tight hover:text-blue-300 ${isFinal && !awayWins ? 'text-slate-400' : 'text-white'}`} style={{ fontFamily: 'var(--font-display)' }}>{awayName}</Link>
              <div className="text-xs text-slate-500 mt-1">AWAY{awayRecord ? ` · ${awayRecord}` : ''}</div>
            </div>

            <div className="text-center px-2 sm:px-5">
              {(isFinal || isLive) ? (
                <div className="flex items-center gap-3 sm:gap-5">
                  <span className={`text-5xl sm:text-7xl font-black tabular-nums ${awayWins ? 'text-white' : 'text-slate-500'}`}>{game.away_score ?? '—'}</span>
                  <span className="text-slate-700 text-2xl">-</span>
                  <span className={`text-5xl sm:text-7xl font-black tabular-nums ${homeWins ? 'text-white' : 'text-slate-500'}`}>{game.home_score ?? '—'}</span>
                </div>
              ) : (
                <div><div className="text-3xl sm:text-5xl font-black text-white">{gameTimeLabel(game.game_time)}</div><div className="text-xs text-slate-500 uppercase tracking-widest mt-2">Scheduled</div></div>
              )}
            </div>

            <div className="text-center flex flex-col items-center min-w-0">
              <SchoolLogo school={homeSchool} size="xl" />
              <Link href={homeSchool ? `/schools/${homeSchool.slug}` : '#'} className={`mt-3 text-lg sm:text-2xl font-black leading-tight hover:text-blue-300 ${isFinal && !homeWins ? 'text-slate-400' : 'text-white'}`} style={{ fontFamily: 'var(--font-display)' }}>{homeName}</Link>
              <div className="text-xs text-slate-500 mt-1">HOME{homeRecord ? ` · ${homeRecord}` : ''}</div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-px bg-white/10 border-t border-white/10">
            <div className="bg-[#0b0f17] px-4 py-3"><div className="text-[10px] uppercase tracking-widest text-slate-600">Location</div><div className="text-sm text-slate-300 mt-1">{game.location || 'TBA'}</div></div>
            <div className="bg-[#0b0f17] px-4 py-3"><div className="text-[10px] uppercase tracking-widest text-slate-600">Season</div><div className="text-sm text-slate-300 mt-1">{game.season?.name || 'Current Season'}</div></div>
            <div className="bg-[#0b0f17] px-4 py-3"><div className="text-[10px] uppercase tracking-widest text-slate-600">Event</div><div className="text-sm text-slate-300 mt-1">{game.event_name || (game.is_playoff ? game.playoff_round || 'Playoffs' : 'Regular Season')}</div></div>
          </div>
        </section>

        {periodNumbers.length > 0 && (
          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10"><h2 className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Scoring</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead><tr className="text-slate-500 border-b border-white/10"><th className="text-left px-5 py-3">Team</th>{periodNumbers.map(n => <th key={n} className="px-3 py-3 text-center">{periodLabel(n)}</th>)}<th className="px-5 py-3 text-center">Total</th></tr></thead>
                <tbody>
                  <tr className="border-b border-white/5"><td className="px-5 py-3 font-bold text-slate-200">{awayName}</td>{periodNumbers.map(n => <td key={n} className="px-3 py-3 text-center tabular-nums text-slate-300">{scoreFor('away', n)}</td>)}<td className="px-5 py-3 text-center font-black text-white">{game.away_score ?? '—'}</td></tr>
                  <tr><td className="px-5 py-3 font-bold text-slate-200">{homeName}</td>{periodNumbers.map(n => <td key={n} className="px-3 py-3 text-center tabular-nums text-slate-300">{scoreFor('home', n)}</td>)}<td className="px-5 py-3 text-center font-black text-white">{game.home_score ?? '—'}</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {statDefs.length > 0 && (
          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10"><h2 className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Team Stats</h2><p className="text-xs text-slate-500 mt-1">Only stats reported for this game are shown.</p></div>
            <div className="divide-y divide-white/5">
              {statDefs.map(def => {
                const away = teamStatValue('away', def.id)
                const home = teamStatValue('home', def.id)
                return <div key={def.id} className="grid grid-cols-[1fr_1.5fr_1fr] items-center gap-3 px-5 py-3"><div className="text-left text-lg font-black tabular-nums text-white">{away ? valueLabel(away.value_numeric, away.value_text, def.unit) : '—'}</div><div className="text-center text-xs uppercase tracking-wide text-slate-500">{def.label}</div><div className="text-right text-lg font-black tabular-nums text-white">{home ? valueLabel(home.value_numeric, home.value_text, def.unit) : '—'}</div></div>
              })}
            </div>
          </section>
        )}

        {athleteDefs.length > 0 && athleteMap.size > 0 && (
          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10"><h2 className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Player Stats</h2><p className="text-xs text-slate-500 mt-1">Athletes become clickable career pages when a profile slug is available.</p></div>
            {[{ id: awayTeam?.id || null, name: awayName }, { id: homeTeam?.id || null, name: homeName }].map(team => {
              const rows = athletesByTeam(team.id)
              if (!rows.length) return null
              return <div key={team.name} className="border-b last:border-b-0 border-white/10"><div className="px-5 py-3 bg-white/[0.025] text-sm font-black text-slate-200">{team.name}</div><div className="overflow-x-auto"><table className="w-full text-sm min-w-[620px]"><thead><tr className="text-slate-600"><th className="text-left px-5 py-2">Player</th>{athleteDefs.map(def => <th key={def.id} className="px-3 py-2 text-center">{def.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.athlete?.id} className="border-t border-white/5"><td className="px-5 py-3 font-semibold">{row.athlete?.slug ? <Link href={`/athletes/${row.athlete.slug}`} className="text-white hover:text-blue-300">{row.athlete.display_name}</Link> : <span className="text-slate-200">{row.athlete?.display_name}</span>}{row.verified && <span className="ml-2 text-[10px] text-emerald-400">VERIFIED</span>}</td>{athleteDefs.map(def => { const stat = row.stats.get(def.id); return <td key={def.id} className="px-3 py-3 text-center tabular-nums text-slate-300">{stat ? valueLabel(stat.value_numeric, stat.value_text, def.unit) : '—'}</td> })}</tr>)}</tbody></table></div></div>
            })}
          </section>
        )}

        {game.recap && (
          <section className="card p-5"><div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 mb-3">Game Recap</div><p className="text-slate-200 leading-relaxed whitespace-pre-line">{game.recap}</p>{game.recap_author && <p className="text-xs text-slate-600 mt-3">By {game.recap_author}</p>}</section>
        )}

        <section className="card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap border-b border-white/10"><div><h2 className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Photos From This Game</h2><p className="text-xs text-slate-500 mt-1">Help build the permanent Section X sports archive.</p></div><Link href={`/submit-photo?game=${game.id}`} className="px-4 py-2 rounded-lg text-sm font-black bg-blue-600 hover:bg-blue-500 text-white">Add Photos</Link></div>
          {photos.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-3 gap-1 p-1">{photos.slice(0, 12).map((photo: any) => <div key={photo.id} className="relative aspect-[4/3] overflow-hidden bg-black"><img src={photo.photo_url} alt={photo.caption || `${awayName} at ${homeName}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />{photo.photographer_credit_name && <div className="absolute inset-x-0 bottom-0 p-2 pt-8 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-white/80">Photo: {photo.photographer_credit_name}</div>}</div>)}</div> : <div className="p-8 text-center"><div className="text-3xl mb-2">📸</div><div className="font-bold text-slate-300">No approved photos yet</div><div className="text-xs text-slate-600 mt-1">Be the first to add photos from this matchup.</div></div>}
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          {[{ team: awayTeam, school: awaySchool, name: awayName, next: awayNext, opp: awayNextOpponent }, { team: homeTeam, school: homeSchool, name: homeName, next: homeNext, opp: homeNextOpponent }].map(item => (
            <div key={item.name} className="card p-5"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">What's Next</div><div className="flex items-center gap-3 mt-3"><SchoolLogo school={item.school} size="md" /><div className="min-w-0"><div className="font-black text-white truncate">{item.name}</div>{item.next && item.opp ? <div className="text-sm text-slate-400 mt-1">{format(parseISO(`${item.next.game_date}T12:00:00`), 'EEE, MMM d')} · {gameTimeLabel(item.next.game_time)} · {item.opp.prefix} {item.opp.opponent}</div> : <div className="text-sm text-slate-600 mt-1">No upcoming game listed.</div>}</div></div>{item.next && <Link href={`/game-center/${item.next.id}`} className="inline-block mt-4 text-xs font-bold text-blue-400 hover:text-blue-300">Open next Game Center →</Link>}{item.team?.slug && <Link href={`/teams/${item.team.slug}`} className="inline-block mt-4 ml-4 text-xs font-bold text-slate-500 hover:text-slate-300">Team page →</Link>}</div>
          ))}
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          <Link href={`/submit-photo?game=${game.id}`} className="card p-4 hover:border-blue-500/50 transition-colors"><div className="text-xs font-black text-white">Submit Photos</div><div className="text-xs text-slate-600 mt-1">Add to this game's archive.</div></Link>
          <Link href={`/standings/${game.sport?.slug || ''}`} className="card p-4 hover:border-blue-500/50 transition-colors"><div className="text-xs font-black text-white">Standings</div><div className="text-xs text-slate-600 mt-1">See where both teams stand.</div></Link>
          <Link href={`/games/${game.id}`} className="card p-4 hover:border-blue-500/50 transition-colors"><div className="text-xs font-black text-white">Report a Correction</div><div className="text-xs text-slate-600 mt-1">Use the existing game correction tool.</div></Link>
        </section>
      </div>
    </PublicLayout>
  )
}
