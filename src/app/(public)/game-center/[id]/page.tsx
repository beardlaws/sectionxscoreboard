import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import PublicLayout from '@/components/layout/PublicLayout'
import SchoolLogo from '@/components/SchoolLogo'
import { createClient } from '@/lib/supabase/server'
import { calculateStandings } from '@/lib/standings'
import GameCenterActions from './GameCenterActions'

export const revalidate = 60

type PageProps = { params: { id: string } }

type GameCard = {
  id: string
  game_date: string
  game_time: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
  home_team_id: string | null
  away_team_id: string | null
  location?: string | null
  sport?: any
  home_team?: any
  away_team?: any
  external_home?: any
  external_away?: any
}

function joined<T = any>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function shortName(value: string) {
  return value
    .replace(' Central High School', '')
    .replace(' Central School', '')
    .replace(' High School', '')
    .replace(' School', '')
}

function timeLabel(value: string | null) {
  if (!value) return 'Time TBA'
  const [hRaw, mRaw] = value.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw)
  if (Number.isNaN(h) || Number.isNaN(m)) return value
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function dateLabel(value: string) {
  return format(parseISO(`${value}T12:00:00`), 'EEE, MMM d')
}

function longDate(value: string) {
  return format(parseISO(`${value}T12:00:00`), 'EEEE, MMMM d, yyyy')
}

function statusKey(game: any) {
  return String(game?.status || 'Scheduled').trim().toLowerCase()
}

function isFinal(game: any) {
  return statusKey(game) === 'final'
}

function isLive(game: any) {
  return ['live', 'in progress'].includes(statusKey(game))
}

function isPostponed(game: any) {
  return statusKey(game) === 'postponed'
}

function isCanceled(game: any) {
  return ['canceled', 'cancelled'].includes(statusKey(game))
}

function statusText(game: any) {
  if (isFinal(game)) return 'Final'
  if (isLive(game)) return 'Live'
  if (isPostponed(game)) return 'Postponed'
  if (isCanceled(game)) return 'Canceled'
  return 'Scheduled'
}

function statusTone(game: any) {
  if (isLive(game)) return 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200'
  if (isFinal(game)) return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
  if (isPostponed(game)) return 'border-orange-400/25 bg-orange-400/10 text-orange-300'
  if (isCanceled(game)) return 'border-red-400/25 bg-red-400/10 text-red-300'
  return 'border-blue-400/25 bg-blue-400/10 text-blue-300'
}

function teamName(game: any, side: 'home' | 'away') {
  const team = joined<any>(game?.[`${side}_team`])
  const school = joined<any>(team?.school)
  const external = joined<any>(game?.[`external_${side}`])
  return school?.school_name || external?.name || external?.opponent_name || 'TBD'
}

function statValue(row: any) {
  if (!row) return '—'
  const value = row.value_text ?? row.value_numeric
  if (value == null) return '—'
  return `${value}${row.stat_definition?.unit || ''}`
}

function recordLabel(row: any) {
  if (!row) return null
  return `${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ''}`
}

function leagueRecordLabel(row: any) {
  if (!row) return null
  return `${row.league_wins}-${row.league_losses}${row.league_ties ? `-${row.league_ties}` : ''}`
}

function gameResultFor(game: any, teamId: string | null) {
  if (!teamId || !isFinal(game) || game.home_score == null || game.away_score == null) return null
  const mine = game.home_team_id === teamId ? game.home_score : game.away_score
  const opp = game.home_team_id === teamId ? game.away_score : game.home_score
  if (mine === opp) return 'T'
  return mine > opp ? 'W' : 'L'
}

function MatchupMini({ game, currentId }: { game: GameCard; currentId?: string }) {
  const away = shortName(teamName(game, 'away'))
  const home = shortName(teamName(game, 'home'))
  const final = isFinal(game)
  const live = isLive(game)
  return (
    <Link
      href={`/game-center/${game.id}`}
      className={`block rounded-2xl border p-4 transition-colors hover:border-yellow-300/30 hover:bg-white/[0.04] ${currentId === game.id ? 'border-yellow-300/25 bg-yellow-300/[0.05]' : 'border-white/[0.07] bg-white/[0.025]'}`}
    >
      <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.13em]">
        <span className="text-white/35">{dateLabel(game.game_date)} · {timeLabel(game.game_time)}</span>
        <span className={live ? 'text-yellow-300' : final ? 'text-emerald-400' : isPostponed(game) ? 'text-orange-300' : isCanceled(game) ? 'text-red-300' : 'text-blue-300'}>{statusText(game)}</span>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3"><span className="truncate font-bold text-white/75">{away}</span><span className="font-black tabular-nums text-white">{final || live ? game.away_score ?? '—' : ''}</span></div>
        <div className="flex items-center justify-between gap-3"><span className="truncate font-bold text-white/75">{home}</span><span className="font-black tabular-nums text-white">{final || live ? game.home_score ?? '—' : ''}</span></div>
      </div>
    </Link>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('games')
    .select(`
      id, game_date, game_time, status, home_score, away_score,
      sport:sports(sport_name),
      home_team:teams!games_home_team_id_fkey(school:schools(school_name)),
      away_team:teams!games_away_team_id_fkey(school:schools(school_name)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(name),
      external_away:external_opponents!games_external_away_opponent_id_fkey(name)
    `)
    .eq('id', params.id)
    .single()

  if (!data) return { title: 'Game Center | Section X Scoreboard' }
  const game: any = data
  const home = teamName(game, 'home')
  const away = teamName(game, 'away')
  const score = isFinal(game) && game.away_score != null && game.home_score != null
    ? `${away} ${game.away_score}, ${home} ${game.home_score}`
    : null
  const title = score ? `${score} | Final` : `${away} at ${home} | Game Center`
  const description = score
    ? `Final score, matchup context and game details for ${score} in Section X ${game.sport?.sport_name || 'sports'}.`
    : `${game.sport?.sport_name || 'Section X sports'} matchup hub for ${away} at ${home} on ${longDate(game.game_date)}.`
  const url = `https://sectionxscoreboard.com/game-center/${params.id}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Section X Scoreboard',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function GameCenterPage({ params }: PageProps) {
  const supabase = createClient()
  const { data, error } = await supabase
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

  if (!data || error) notFound()

  const game: any = data
  const homeTeam = joined<any>(game.home_team)
  const awayTeam = joined<any>(game.away_team)
  const homeSchool = joined<any>(homeTeam?.school)
  const awaySchool = joined<any>(awayTeam?.school)
  const homeName = teamName(game, 'home')
  const awayName = teamName(game, 'away')
  const final = isFinal(game)
  const live = isLive(game)
  const postponed = isPostponed(game)
  const canceled = isCanceled(game)
  const lowWins = String(game.sport?.sport_name || '').toLowerCase().includes('golf')
  const homeWins = final && game.home_score != null && game.away_score != null && (lowWins ? game.home_score < game.away_score : game.home_score > game.away_score)
  const awayWins = final && game.home_score != null && game.away_score != null && (lowWins ? game.away_score < game.home_score : game.away_score > game.home_score)

  const [photosRes, periodRes, teamStatsRes, athleteStatsRes, teamSeasonsRes, standingsGamesRes, aroundRes] = await Promise.all([
    supabase.from('photos').select('*').eq('game_id', game.id).eq('approved', true).order('featured', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('game_period_scores').select('*').eq('game_id', game.id).order('period_number'),
    supabase.from('game_team_stats').select('*, stat_definition:stat_definitions(id, label, unit, sort_order)').eq('game_id', game.id),
    supabase.from('game_athlete_stats').select('*, athlete:athletes(id, display_name, slug), stat_definition:stat_definitions(id, label, unit, sort_order)').eq('game_id', game.id),
    game.season_id && game.sport_id
      ? supabase.from('team_seasons').select(`team_id, division, class, btm_override, active_for_season, team:teams(*, school:schools(*))`).eq('season_id', game.season_id).neq('active_for_season', false)
      : Promise.resolve({ data: [] } as any),
    game.season_id && game.sport_id
      ? supabase.from('games').select(`*, home_team:teams!games_home_team_id_fkey(*, school:schools(*)), away_team:teams!games_away_team_id_fkey(*, school:schools(*))`).eq('season_id', game.season_id).eq('sport_id', game.sport_id).eq('status', 'Final')
      : Promise.resolve({ data: [] } as any),
    supabase.from('games').select(`id, game_date, game_time, status, home_score, away_score, home_team_id, away_team_id, location, sport:sports(sport_name, slug), home_team:teams!games_home_team_id_fkey(school:schools(school_name)), away_team:teams!games_away_team_id_fkey(school:schools(school_name)), external_home:external_opponents!games_external_home_opponent_id_fkey(name), external_away:external_opponents!games_external_away_opponent_id_fkey(name)`).eq('game_date', game.game_date).neq('id', game.id).order('game_time', { ascending: true }).limit(8),
  ])

  const photos = photosRes.data || []
  const periods: any[] = periodRes.data || []
  const teamStats: any[] = teamStatsRes.data || []
  const athleteStats: any[] = athleteStatsRes.data || []
  const teamSeasons: any[] = teamSeasonsRes.data || []
  const standingsGames: any[] = standingsGamesRes.data || []
  const aroundGames: any[] = aroundRes.data || []

  const standings = calculateStandings(standingsGames, teamSeasons, game.sport?.sport_name || '')
  const homeStanding = standings.find(row => row.team_id === homeTeam?.id) || null
  const awayStanding = standings.find(row => row.team_id === awayTeam?.id) || null
  const homeSeason = teamSeasons.find(row => row.team_id === homeTeam?.id) || null
  const awaySeason = teamSeasons.find(row => row.team_id === awayTeam?.id) || null

  function standingPosition(row: any) {
    if (!row) return null
    const played = row.league_wins + row.league_losses + row.league_ties
    if (!played) return null
    const pool = row.division ? standings.filter(item => item.division === row.division) : standings
    const index = pool.findIndex(item => item.team_id === row.team_id)
    return index >= 0 ? index + 1 : null
  }

  async function teamSchedule(teamId: string | null) {
    if (!teamId || !game.season_id || !game.sport_id) return []
    const { data: rows } = await supabase
      .from('games')
      .select(`id, game_date, game_time, status, home_score, away_score, home_team_id, away_team_id, location, home_team:teams!games_home_team_id_fkey(school:schools(school_name)), away_team:teams!games_away_team_id_fkey(school:schools(school_name)), external_home:external_opponents!games_external_home_opponent_id_fkey(name), external_away:external_opponents!games_external_away_opponent_id_fkey(name)`)
      .eq('season_id', game.season_id)
      .eq('sport_id', game.sport_id)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true })
    return (rows || []) as any[]
  }

  const [awaySchedule, homeSchedule] = await Promise.all([
    teamSchedule(awayTeam?.id || null),
    teamSchedule(homeTeam?.id || null),
  ])

  function scheduleNeighbors(rows: any[]) {
    const index = rows.findIndex(row => row.id === game.id)
    if (index < 0) return { previous: null, next: null }
    return { previous: index > 0 ? rows[index - 1] : null, next: index < rows.length - 1 ? rows[index + 1] : null }
  }

  const awayNeighbors = scheduleNeighbors(awaySchedule)
  const homeNeighbors = scheduleNeighbors(homeSchedule)

  let meetings: any[] = []
  if (awayTeam?.id && homeTeam?.id && game.sport_id) {
    const { data: rows } = await supabase
      .from('games')
      .select(`id, game_date, game_time, status, home_score, away_score, home_team_id, away_team_id, season_id, season:seasons(name), home_team:teams!games_home_team_id_fkey(school:schools(school_name)), away_team:teams!games_away_team_id_fkey(school:schools(school_name))`)
      .eq('sport_id', game.sport_id)
      .eq('status', 'Final')
      .or(`and(home_team_id.eq.${awayTeam.id},away_team_id.eq.${homeTeam.id}),and(home_team_id.eq.${homeTeam.id},away_team_id.eq.${awayTeam.id})`)
      .neq('id', game.id)
      .order('game_date', { ascending: false })
      .limit(5)
    meetings = rows || []
  }

  const currentSeasonMeetings = meetings.filter(row => row.season_id === game.season_id)
  let awaySeriesWins = 0
  let homeSeriesWins = 0
  let seriesTies = 0
  for (const meeting of currentSeasonMeetings) {
    if (meeting.home_score == null || meeting.away_score == null) continue
    const awayScore = meeting.home_team_id === awayTeam?.id ? meeting.home_score : meeting.away_score
    const homeScore = meeting.home_team_id === homeTeam?.id ? meeting.home_score : meeting.away_score
    if (awayScore === homeScore) seriesTies += 1
    else if (lowWins ? awayScore < homeScore : awayScore > homeScore) awaySeriesWins += 1
    else homeSeriesWins += 1
  }

  const periodNumbers = Array.from(new Set(periods.map(row => Number(row.period_number)))).sort((a, b) => a - b)
  const periodScore = (side: string, n: number) => periods.find(row => row.team_side === side && Number(row.period_number) === n)?.score ?? '—'
  const periodLabel = (n: number) => periods.find(row => Number(row.period_number) === n && row.period_label)?.period_label || String(n)

  const statDefinitions: any[] = Array.from(new Map(teamStats.filter(row => row.stat_definition).map(row => [row.stat_definition.id, row.stat_definition])).values()).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
  const athleteDefinitions: any[] = Array.from(new Map(athleteStats.filter(row => row.stat_definition).map(row => [row.stat_definition.id, row.stat_definition])).values()).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))

  const athleteRows = (teamId: string | null) => {
    const grouped = new Map<string, any>()
    for (const row of athleteStats.filter(stat => stat.team_id === teamId && stat.athlete)) {
      const current = grouped.get(row.athlete_id) || { athlete: row.athlete, stats: new Map<string, any>() }
      current.stats.set(row.stat_definition?.id, row)
      grouped.set(row.athlete_id, current)
    }
    return Array.from(grouped.values())
  }

  const shareTitle = final && game.away_score != null && game.home_score != null
    ? `${awayName} ${game.away_score}, ${homeName} ${game.home_score} — Final`
    : `${awayName} at ${homeName} — ${game.sport?.sport_name || 'Section X'}`

  const awayColor = awaySchool?.primary_color || '#2563eb'
  const homeColor = homeSchool?.primary_color || '#facc15'
  const venue = game.location || (game.neutral_site ? 'Neutral site · location TBA' : homeSchool?.city ? `${homeSchool.city}, NY` : 'Location TBA')

  return (
    <PublicLayout>
      <div className="min-h-screen pb-16" style={{ background: '#060910' }}>
        <section className="relative overflow-hidden border-b border-white/[0.07]">
          <div className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(circle at 8% 45%, ${awayColor}35, transparent 35%), radial-gradient(circle at 92% 45%, ${homeColor}35, transparent 35%), linear-gradient(180deg,#0b101b,#060910)` }} />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
              <nav className="text-[11px] flex items-center gap-2 text-white/35">
                <Link href="/scores" className="hover:text-yellow-300">Scores</Link><span>/</span><span>{game.sport?.sport_name || 'Sport'}</span><span>/</span><span>{dateLabel(game.game_date)}</span>
              </nav>
              <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${statusTone(game)}`}>{statusText(game)}</span>
            </div>

            <div className="text-center mb-5">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-300/70">Section X Game Center</div>
              <div className="mt-2 text-sm text-white/45">{game.sport?.gender ? `${game.sport.gender} ` : ''}{game.sport?.sport_name || 'Sports'} · {longDate(game.game_date)}</div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-8">
              <div className="min-w-0 text-center flex flex-col items-center">
                <SchoolLogo school={awaySchool} size="xl" />
                <Link href={awaySchool?.slug ? `/schools/${awaySchool.slug}` : '#'} className={`mt-3 max-w-full text-base sm:text-2xl font-black leading-tight ${final && !awayWins ? 'text-white/50' : 'text-white'} hover:text-yellow-200`}>{shortName(awayName)}</Link>
                <div className="mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-white/35">Away{recordLabel(awayStanding) ? ` · ${recordLabel(awayStanding)}` : ''}</div>
                {(awaySeason?.division || awaySeason?.class) && <div className="mt-2 text-[10px] text-white/40">{[awaySeason?.division, awaySeason?.class ? `Class ${awaySeason.class}` : null].filter(Boolean).join(' · ')}</div>}
              </div>

              <div className="px-1 sm:px-5 text-center">
                {live || final ? (
                  <div>
                    <div className="flex items-center justify-center gap-2 sm:gap-5">
                      <span className={`text-5xl sm:text-7xl lg:text-8xl font-black tabular-nums tracking-tight ${awayWins ? 'text-white' : 'text-white/55'}`}>{game.away_score ?? '—'}</span>
                      <span className="text-xl sm:text-3xl font-black text-white/15">–</span>
                      <span className={`text-5xl sm:text-7xl lg:text-8xl font-black tabular-nums tracking-tight ${homeWins ? 'text-white' : 'text-white/55'}`}>{game.home_score ?? '—'}</span>
                    </div>
                    <div className={`mt-2 text-xs font-black uppercase tracking-[0.2em] ${live ? 'text-yellow-300' : 'text-emerald-400'}`}>{live ? 'Latest reported score' : 'Final'}</div>
                  </div>
                ) : postponed ? (
                  <div><div className="text-xl sm:text-3xl font-black text-orange-300">POSTPONED</div><div className="mt-2 text-xs text-white/40">{game.rescheduled_date ? `Rescheduled for ${dateLabel(game.rescheduled_date)}` : 'New date not listed yet'}</div></div>
                ) : canceled ? (
                  <div><div className="text-xl sm:text-3xl font-black text-red-300">CANCELED</div><div className="mt-2 text-xs text-white/40">This game will not be played as scheduled.</div></div>
                ) : (
                  <div><div className="text-2xl sm:text-5xl font-black text-white tracking-tight">{timeLabel(game.game_time)}</div><div className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">Scheduled</div></div>
                )}
              </div>

              <div className="min-w-0 text-center flex flex-col items-center">
                <SchoolLogo school={homeSchool} size="xl" />
                <Link href={homeSchool?.slug ? `/schools/${homeSchool.slug}` : '#'} className={`mt-3 max-w-full text-base sm:text-2xl font-black leading-tight ${final && !homeWins ? 'text-white/50' : 'text-white'} hover:text-yellow-200`}>{shortName(homeName)}</Link>
                <div className="mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-white/35">Home{recordLabel(homeStanding) ? ` · ${recordLabel(homeStanding)}` : ''}</div>
                {(homeSeason?.division || homeSeason?.class) && <div className="mt-2 text-[10px] text-white/40">{[homeSeason?.division, homeSeason?.class ? `Class ${homeSeason.class}` : null].filter(Boolean).join(' · ')}</div>}
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl overflow-hidden border border-white/[0.07] bg-black/20">
              <div className="px-4 py-3"><div className="text-[9px] uppercase tracking-[0.16em] text-white/25">Venue</div><div className="mt-1 text-sm font-bold text-white/70">{venue}</div></div>
              <div className="px-4 py-3 sm:border-x border-white/[0.07]"><div className="text-[9px] uppercase tracking-[0.16em] text-white/25">Season</div><div className="mt-1 text-sm font-bold text-white/70">{game.season?.name || 'Current season'}</div></div>
              <div className="px-4 py-3"><div className="text-[9px] uppercase tracking-[0.16em] text-white/25">Event</div><div className="mt-1 text-sm font-bold text-white/70">{game.event_name || (game.is_playoff ? game.playoff_round || 'Playoffs' : game.neutral_site ? 'Neutral-site game' : 'Regular season')}</div></div>
            </div>

            <div className="mt-5 flex justify-center"><GameCenterActions gameId={game.id} shareTitle={shareTitle} /></div>
          </div>
        </section>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {(awayStanding || homeStanding) && (
            <section className="grid md:grid-cols-2 gap-3">
              {[{ name: awayName, standing: awayStanding, season: awaySeason, team: awayTeam }, { name: homeName, standing: homeStanding, season: homeSeason, team: homeTeam }].map(item => {
                const pos = standingPosition(item.standing)
                const league = leagueRecordLabel(item.standing)
                return <div key={item.name} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Season context</div><div className="mt-2 flex items-end justify-between gap-4"><div><div className="text-lg font-black text-white">{shortName(item.name)}</div><div className="mt-1 text-xs text-white/40">{[item.season?.division, item.season?.class ? `Class ${item.season.class}` : null].filter(Boolean).join(' · ') || 'Section X'}</div></div><div className="text-right"><div className="text-2xl font-black text-white">{recordLabel(item.standing) || '0-0'}</div><div className="text-[10px] text-white/35">overall</div></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/[0.025] p-3"><div className="font-black text-blue-300">{league || '0-0'}</div><div className="mt-1 text-[9px] uppercase text-white/25">Section X</div></div><div className="rounded-xl bg-white/[0.025] p-3"><div className="font-black text-yellow-300">{pos ? `#${pos}` : '—'}</div><div className="mt-1 text-[9px] uppercase text-white/25">{item.standing?.division ? item.standing.division : 'Position'}</div></div><div className="rounded-xl bg-white/[0.025] p-3"><div className="font-black text-white/75">{item.standing?.btm ? Number(item.standing.btm).toFixed(2) : '—'}</div><div className="mt-1 text-[9px] uppercase text-white/25">BTM</div></div></div></div>
              })}
            </section>
          )}

          {periodNumbers.length > 0 && (
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.07]"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Scoring detail</div><h2 className="mt-1 text-xl font-black text-white">By period</h2></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-b border-white/[0.07] text-white/35"><th className="text-left px-5 py-3">Team</th>{periodNumbers.map(n => <th key={n} className="px-3 py-3 text-center">{periodLabel(n)}</th>)}<th className="px-5 py-3 text-center">Total</th></tr></thead><tbody><tr className="border-b border-white/[0.05]"><td className="px-5 py-3 font-bold text-white/80">{awayName}</td>{periodNumbers.map(n => <td key={n} className="px-3 py-3 text-center text-white/65">{periodScore('away', n)}</td>)}<td className="px-5 py-3 text-center font-black text-white">{game.away_score ?? '—'}</td></tr><tr><td className="px-5 py-3 font-bold text-white/80">{homeName}</td>{periodNumbers.map(n => <td key={n} className="px-3 py-3 text-center text-white/65">{periodScore('home', n)}</td>)}<td className="px-5 py-3 text-center font-black text-white">{game.home_score ?? '—'}</td></tr></tbody></table></div>
            </section>
          )}

          {statDefinitions.length > 0 && teamStats.length > 0 && (
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden"><div className="px-5 py-4 border-b border-white/[0.07]"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Game stats</div><h2 className="mt-1 text-xl font-black text-white">Team comparison</h2></div><div className="divide-y divide-white/[0.05]">{statDefinitions.map(def => { const away = teamStats.find(row => row.team_side === 'away' && row.stat_definition?.id === def.id); const home = teamStats.find(row => row.team_side === 'home' && row.stat_definition?.id === def.id); return <div key={def.id} className="grid grid-cols-[1fr_1.4fr_1fr] gap-3 items-center px-5 py-3"><div className="text-left text-lg font-black text-white">{statValue(away)}</div><div className="text-center text-xs uppercase tracking-wide text-white/35">{def.label}</div><div className="text-right text-lg font-black text-white">{statValue(home)}</div></div> })}</div></section>
          )}

          {athleteDefinitions.length > 0 && athleteStats.length > 0 && (
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden"><div className="px-5 py-4 border-b border-white/[0.07]"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Player stats</div><h2 className="mt-1 text-xl font-black text-white">Game leaders</h2></div>{[{ id: awayTeam?.id || null, name: awayName }, { id: homeTeam?.id || null, name: homeName }].map(team => { const rows = athleteRows(team.id); if (!rows.length) return null; return <div key={team.name} className="border-b last:border-b-0 border-white/[0.07]"><div className="px-5 py-3 bg-white/[0.02] text-sm font-black text-white/75">{team.name}</div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="text-white/30"><th className="text-left px-5 py-2">Player</th>{athleteDefinitions.map(def => <th key={def.id} className="px-3 py-2 text-center">{def.label}</th>)}</tr></thead><tbody>{rows.map((row: any) => <tr key={row.athlete.id} className="border-t border-white/[0.05]"><td className="px-5 py-3 font-semibold">{row.athlete.slug ? <Link href={`/athletes/${row.athlete.slug}`} className="text-white hover:text-yellow-300">{row.athlete.display_name}</Link> : <span className="text-white/75">{row.athlete.display_name}</span>}</td>{athleteDefinitions.map(def => <td key={def.id} className="px-3 py-3 text-center text-white/60">{statValue(row.stats.get(def.id))}</td>)}</tr>)}</tbody></table></div></div> })}</section>
          )}

          {game.recap && (
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Game recap</div><p className="mt-3 text-white/75 leading-relaxed whitespace-pre-line">{game.recap}</p>{game.recap_author && <p className="mt-4 text-xs text-white/30">By {game.recap_author}</p>}</section>
          )}

          {(awayNeighbors.previous || awayNeighbors.next || homeNeighbors.previous || homeNeighbors.next) && (
            <section>
              <div className="mb-4"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Team timeline</div><h2 className="mt-1 text-2xl font-black text-white">Before & after this game</h2></div>
              <div className="grid lg:grid-cols-2 gap-4">{[
                { name: awayName, teamId: awayTeam?.id || null, previous: awayNeighbors.previous, next: awayNeighbors.next },
                { name: homeName, teamId: homeTeam?.id || null, previous: homeNeighbors.previous, next: homeNeighbors.next },
              ].map(item => <div key={item.name} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="font-black text-white mb-3">{shortName(item.name)}</div><div className="grid sm:grid-cols-2 gap-2">{item.previous ? <div><div className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] text-white/25">Previous</div><MatchupMini game={item.previous} /></div> : <div className="rounded-xl border border-dashed border-white/[0.07] p-4 text-xs text-white/25">No previous game listed.</div>}{item.next ? <div><div className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] text-white/25">Next</div><MatchupMini game={item.next} /></div> : <div className="rounded-xl border border-dashed border-white/[0.07] p-4 text-xs text-white/25">No next game listed.</div>}</div>{item.previous && isFinal(item.previous) && <div className="mt-3 text-[10px] text-white/30">Previous result: <span className="font-black text-white/55">{gameResultFor(item.previous, item.teamId)}</span></div>}</div>)}</div>
            </section>
          )}

          {awayTeam?.id && homeTeam?.id && (
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.07] flex items-end justify-between gap-4 flex-wrap"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Matchup history</div><h2 className="mt-1 text-xl font-black text-white">{shortName(awayName)} vs {shortName(homeName)}</h2></div>{currentSeasonMeetings.length > 0 && <div className="text-right"><div className="text-xs text-white/30">Season series</div><div className="mt-1 font-black text-white">{shortName(awayName)} {awaySeriesWins} · {shortName(homeName)} {homeSeriesWins}{seriesTies ? ` · ${seriesTies} tie${seriesTies === 1 ? '' : 's'}` : ''}</div></div>}</div>
              {meetings.length ? <div className="grid md:grid-cols-2 gap-2 p-4">{meetings.map(meeting => <MatchupMini key={meeting.id} game={meeting} />)}</div> : <div className="p-6 text-sm text-white/35">No previous final between these teams is in the Section X database yet. This matchup starts the archive.</div>}
            </section>
          )}

          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between gap-3 flex-wrap"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Game gallery</div><h2 className="mt-1 text-xl font-black text-white">Photos from this matchup</h2><p className="mt-1 text-xs text-white/30">Help build the permanent Section X sports archive.</p></div><Link href={`/submit-photo?game=${game.id}`} className="rounded-xl border border-blue-400/25 bg-blue-400/10 px-4 py-2.5 text-xs font-black text-blue-300 hover:bg-blue-400/15">Add photos</Link></div>
            {photos.length ? <div className="grid grid-cols-2 md:grid-cols-3 gap-1 p-1">{photos.slice(0, 12).map((photo: any) => <div key={photo.id} className="relative aspect-[4/3] overflow-hidden bg-black"><img src={photo.photo_url} alt={photo.caption || `${awayName} at ${homeName}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />{photo.photographer_credit_name && <div className="absolute inset-x-0 bottom-0 p-2 pt-8 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-white/80">Photo: {photo.photographer_credit_name}</div>}</div>)}</div> : <div className="p-7 sm:p-9 text-center"><div className="text-sm font-black text-white/65">No approved game photos yet.</div><div className="mt-1 text-xs text-white/30">If you were there, you can be the first to add one.</div></div>}
          </section>

          {aroundGames.length > 0 && (
            <section><div className="mb-4 flex items-end justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Around Section X</div><h2 className="mt-1 text-2xl font-black text-white">More from {dateLabel(game.game_date)}</h2></div><Link href={`/scores?date=${game.game_date}`} className="text-xs font-black text-blue-300">All scores →</Link></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{aroundGames.map(other => <MatchupMini key={other.id} game={other} />)}</div></section>
          )}

          <section className="grid sm:grid-cols-3 gap-3">
            <Link href={`/standings?sport=${game.sport?.slug || ''}&season=${game.season_id || ''}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 hover:border-yellow-300/20"><div className="text-xs font-black text-white">Standings</div><div className="mt-1 text-xs text-white/30">League record, overall record and BTM.</div></Link>
            <Link href={`/submit-photo?game=${game.id}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 hover:border-yellow-300/20"><div className="text-xs font-black text-white">Submit photos</div><div className="mt-1 text-xs text-white/30">Add this matchup to the Section X archive.</div></Link>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="text-xs font-black text-white">See something wrong?</div><div className="mt-1 text-xs text-white/30">Use Report a Correction above. Every submission is reviewed.</div></div>
          </section>
        </main>
      </div>
    </PublicLayout>
  )
}
