import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import PublicLayout from '@/components/layout/PublicLayout'
import SchoolLogo from '@/components/SchoolLogo'
import { calculateStandings } from '@/lib/standings'
import { isScrimmage } from '@/lib/gameType'
import { getGameCenterRepository } from '@/lib/data/runtime-game-center-repository'
import GameCenterActions from './GameCenterActions'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

type GameCard = {
  id: string
  game_date: string
  game_time: string | null
  status: string | null
  contest_type?: string | null
  notes?: string | null
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

function shortName(value: string) {
  const cleaned = value
    .replace(/^CC\s+/i, '')
    .replace(/^P\s+(?=[A-Z])/i, '')
    .replace(/ Central Rural Junior-Senior High School$/i, '')
    .replace(/ Central Junior-Senior High School$/i, '')
    .replace(/ Central High School$/i, '')
    .replace(/ Central School District$/i, '')
    .replace(/ Central School$/i, '')
    .replace(/ Junior-Senior High School$/i, '')
    .replace(/ High School$/i, '')
    .replace(/ School$/i, '')
    .trim()
  const aliases: Record<string, string> = {
    'Ogdensburg Free Academy': 'OFA',
    'St Lawrence Central': 'St. Lawrence Central',
    'St. Lawrence Central': 'St. Lawrence Central',
    'Madrid-Waddington Central': 'Madrid-Waddington',
  }
  return aliases[cleaned] || cleaned
}

function sportLabel(sport: any) {
  const name = String(sport?.sport_name || 'Sports').trim()
  const gender = String(sport?.gender || '').trim()
  if (!gender || name.toLowerCase().startsWith(gender.toLowerCase())) return name
  return `${gender} ${name}`
}

function timeLabel(value: string | null) {
  if (!value) return 'Time TBA'
  const [hRaw, mRaw] = value.split(':')
  const h = Number(hRaw), m = Number(mRaw)
  if (Number.isNaN(h) || Number.isNaN(m)) return value
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
function dateLabel(value: string) { return format(parseISO(`${value}T12:00:00`), 'EEE, MMM d') }
function longDate(value: string) { return format(parseISO(`${value}T12:00:00`), 'EEEE, MMMM d, yyyy') }
function statusKey(game: any) { return String(game?.status || 'Scheduled').trim().toLowerCase() }
function isFinal(game: any) { return !isScrimmage(game) && statusKey(game) === 'final' }
function isLive(game: any) { return !isScrimmage(game) && ['live','in progress'].includes(statusKey(game)) }
function isPostponed(game: any) { return statusKey(game) === 'postponed' }
function isCanceled(game: any) { return ['canceled','cancelled'].includes(statusKey(game)) }
function statusText(game: any) {
  if (isScrimmage(game)) return isPostponed(game) ? 'Postponed Scrimmage' : isCanceled(game) ? 'Canceled Scrimmage' : 'Scrimmage'
  if (isFinal(game)) return 'Final'
  if (isLive(game)) return 'Live'
  if (isPostponed(game)) return 'Postponed'
  if (isCanceled(game)) return 'Canceled'
  return 'Scheduled'
}
function statusTone(game: any) {
  if (isLive(game) || isScrimmage(game)) return 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200'
  if (isFinal(game)) return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
  if (isPostponed(game)) return 'border-orange-400/25 bg-orange-400/10 text-orange-300'
  if (isCanceled(game)) return 'border-red-400/25 bg-red-400/10 text-red-300'
  return 'border-blue-400/25 bg-blue-400/10 text-blue-300'
}
function teamName(game: any, side: 'home' | 'away') {
  return game?.[`${side}_team`]?.school?.school_name || game?.[`external_${side}`]?.name || 'TBD'
}
function statValue(row: any) {
  const value = row?.value_text ?? row?.value_numeric
  return value == null ? '—' : `${value}${row?.stat_definition?.unit || ''}`
}
function recordLabel(row: any) { return row ? `${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ''}` : null }
function leagueRecordLabel(row: any) { return row ? `${row.league_wins}-${row.league_losses}${row.league_ties ? `-${row.league_ties}` : ''}` : null }
function gameResultFor(game: any, teamId: string | null, lowerScoreWins = false) {
  if (!teamId || !isFinal(game) || game.home_score == null || game.away_score == null) return null
  const mine = game.home_team_id === teamId ? game.home_score : game.away_score
  const opp = game.home_team_id === teamId ? game.away_score : game.home_score
  if (mine === opp) return 'T'
  return (lowerScoreWins ? mine < opp : mine > opp) ? 'W' : 'L'
}

function MatchupMini({ game, currentId }: { game: GameCard; currentId?: string }) {
  const away = shortName(teamName(game, 'away')), home = shortName(teamName(game, 'home'))
  const final = isFinal(game), live = isLive(game)
  return <Link href={`/game-center/${game.id}`} className={`block rounded-2xl border p-4 transition-colors hover:border-yellow-300/30 hover:bg-white/[0.04] ${currentId === game.id ? 'border-yellow-300/25 bg-yellow-300/[0.05]' : 'border-white/[0.07] bg-white/[0.025]'}`}>
    <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.13em]"><span className="text-white/35">{dateLabel(game.game_date)} · {timeLabel(game.game_time)}</span><span className={live ? 'text-yellow-300' : final ? 'text-emerald-400' : isPostponed(game) ? 'text-orange-300' : isCanceled(game) ? 'text-red-300' : 'text-blue-300'}>{statusText(game)}</span></div>
    <div className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><span className="truncate font-bold text-white/75">{away}</span><span className="font-black tabular-nums text-white">{final || live ? game.away_score ?? '—' : ''}</span></div><div className="flex justify-between gap-3"><span className="truncate font-bold text-white/75">{home}</span><span className="font-black tabular-nums text-white">{final || live ? game.home_score ?? '—' : ''}</span></div></div>
  </Link>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const game = await getGameCenterRepository().getGame(id)
  if (!game) return { title: 'Game Center | Section X Scoreboard' }
  const home = teamName(game, 'home'), away = teamName(game, 'away')
  const score = isFinal(game) && game.away_score != null && game.home_score != null ? `${away} ${game.away_score}, ${home} ${game.home_score}` : null
  const title = isScrimmage(game) ? `${away} at ${home} | Scrimmage` : score ? `${score} | Final` : `${away} at ${home} | Game Center`
  const description = score ? `Final score, matchup context and game details for ${score} in Section X ${game.sport?.sport_name || 'sports'}.` : `${sportLabel(game.sport)} matchup hub for ${away} at ${home} on ${longDate(game.game_date)}.`
  const url = `https://sectionxscoreboard.com/game-center/${id}`
  return { title, description, alternates:{canonical:url}, openGraph:{title,description,url,siteName:'Section X Scoreboard',type:'website'}, twitter:{card:'summary',title,description} }
}

export default async function GameCenterPage({ params }: PageProps) {
  noStore()
  const { id } = await params
  const repo = getGameCenterRepository()
  const game = await repo.getGame(id)
  if (!game) notFound()

  const homeTeam = game.home_team, awayTeam = game.away_team
  const homeSchool = homeTeam?.school, awaySchool = awayTeam?.school
  const homeName = teamName(game, 'home'), awayName = teamName(game, 'away')
  const scrimmage = isScrimmage(game), final = isFinal(game), live = isLive(game)
  const postponed = isPostponed(game), canceled = isCanceled(game)
  const lowWins = String(game.sport?.sport_name || '').toLowerCase().includes('golf')
  const homeWins = final && game.home_score != null && game.away_score != null && (lowWins ? game.home_score < game.away_score : game.home_score > game.away_score)
  const awayWins = final && game.home_score != null && game.away_score != null && (lowWins ? game.away_score < game.home_score : game.away_score > game.home_score)

  const [photos, periods, teamStats, athleteStats, teamSeasons, standingsGames, aroundGames, awaySchedule, homeSchedule, meetings] = await Promise.all([
    repo.getGamePhotos(game.id),
    repo.getPeriodScores(game.id),
    repo.getTeamStats(game.id),
    repo.getAthleteStats(game.id),
    game.sport_id && game.season_id ? repo.getTeamSeasons(game.sport_id, game.season_id) : Promise.resolve([]),
    game.sport_id && game.season_id ? repo.getStandingsGames(game.sport_id, game.season_id) : Promise.resolve([]),
    repo.getGamesOnDate(game.game_date, game.id, 8),
    awayTeam?.id && game.sport_id && game.season_id ? repo.getTeamSchedule(awayTeam.id, game.sport_id, game.season_id) : Promise.resolve([]),
    homeTeam?.id && game.sport_id && game.season_id ? repo.getTeamSchedule(homeTeam.id, game.sport_id, game.season_id) : Promise.resolve([]),
    awayTeam?.id && homeTeam?.id && game.sport_id ? repo.getPriorMeetings(awayTeam.id, homeTeam.id, game.sport_id, game.id, 5) : Promise.resolve([]),
  ])

  const standings = calculateStandings(standingsGames, teamSeasons, game.sport?.sport_name || '')
  const homeStanding = standings.find((r:any)=>r.team_id===homeTeam?.id) || null
  const awayStanding = standings.find((r:any)=>r.team_id===awayTeam?.id) || null
  const homeSeason = teamSeasons.find((r:any)=>r.team_id===homeTeam?.id) || null
  const awaySeason = teamSeasons.find((r:any)=>r.team_id===awayTeam?.id) || null
  function standingPosition(row:any) { if(!row) return null; const pool=row.division?standings.filter((x:any)=>x.division===row.division):standings; const i=pool.findIndex((x:any)=>x.team_id===row.team_id); return i>=0?i+1:null }
  function neighbors(rows:any[]) { const i=rows.findIndex(r=>r.id===game.id); return {previous:i>0?rows[i-1]:null,next:i>=0&&i<rows.length-1?rows[i+1]:null} }
  const awayNeighbors=neighbors(awaySchedule), homeNeighbors=neighbors(homeSchedule)

  const currentSeasonMeetings = meetings.filter((r:any)=>r.season_id===game.season_id)
  const seriesMeetings = final ? [game,...currentSeasonMeetings] : currentSeasonMeetings
  let awaySeriesWins=0,homeSeriesWins=0,seriesTies=0
  for(const m of seriesMeetings){ if(m.home_score==null||m.away_score==null)continue; const a=m.home_team_id===awayTeam?.id?m.home_score:m.away_score; const h=m.home_team_id===homeTeam?.id?m.home_score:m.away_score; if(a===h)seriesTies++; else if(lowWins?a<h:a>h)awaySeriesWins++; else homeSeriesWins++ }

  const periodNumbers = Array.from(new Set(periods.map((r:any)=>Number(r.period_number)))).sort((a,b)=>a-b)
  const periodScore=(side:string,n:number)=>periods.find((r:any)=>r.team_side===side&&Number(r.period_number)===n)?.score??'—'
  const periodLabel=(n:number)=>periods.find((r:any)=>Number(r.period_number)===n&&r.period_label)?.period_label||String(n)
  const statDefinitions:any[]=Array.from(new Map(teamStats.filter((r:any)=>r.stat_definition).map((r:any)=>[r.stat_definition.id,r.stat_definition])).values()).sort((a:any,b:any)=>(a.sort_order||0)-(b.sort_order||0))
  const athleteDefinitions:any[]=Array.from(new Map(athleteStats.filter((r:any)=>r.stat_definition).map((r:any)=>[r.stat_definition.id,r.stat_definition])).values()).sort((a:any,b:any)=>(a.sort_order||0)-(b.sort_order||0))
  const athleteRows=(teamId:string|null)=>{const grouped=new Map<string,any>(); for(const row of athleteStats.filter((s:any)=>s.team_id===teamId&&s.athlete)){const cur=grouped.get(row.athlete_id)||{athlete:row.athlete,stats:new Map<string,any>()};cur.stats.set(row.stat_definition?.id,row);grouped.set(row.athlete_id,cur)} return Array.from(grouped.values())}

  const shareTitle = scrimmage ? `${awayName} at ${homeName} - Scrimmage` : final && game.away_score != null && game.home_score != null ? `${awayName} ${game.away_score}, ${homeName} ${game.home_score} - Final` : `${awayName} at ${homeName} - ${sportLabel(game.sport)}`
  const awayColor=awaySchool?.primary_color||'#2563eb', homeColor=homeSchool?.primary_color||'#facc15'
  const venue=game.location||(game.neutral_site?'Neutral site · location TBA':homeSchool?.city?`${homeSchool.city}, NY`:'Location TBA')

  return <PublicLayout><div className="min-h-screen pb-16" style={{background:'#060910'}}>
    <section className="relative overflow-hidden border-b border-white/[0.07]"><div className="absolute inset-0 opacity-60" style={{background:`radial-gradient(circle at 8% 45%, ${awayColor}35, transparent 35%), radial-gradient(circle at 92% 45%, ${homeColor}35, transparent 35%), linear-gradient(180deg,#0b101b,#060910)`}}/><div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6"><nav className="text-[11px] flex items-center gap-2 text-white/35"><Link href="/scores" className="hover:text-yellow-300">Scores</Link><span>/</span><span>{sportLabel(game.sport)}</span><span>/</span><span>{dateLabel(game.game_date)}</span></nav><span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${statusTone(game)}`}>{statusText(game)}</span></div>
      <div className="text-center mb-5"><div className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-300/70">Section X Game Center</div><div className="mt-2 text-sm text-white/45">{sportLabel(game.sport)} · {longDate(game.game_date)}</div></div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-8">
        <div className="min-w-0 text-center flex flex-col items-center"><SchoolLogo school={awaySchool} size="xl"/><Link href={awaySchool?.slug?`/schools/${awaySchool.slug}`:'#'} className={`mt-3 max-w-full text-base sm:text-2xl font-black leading-tight ${final&&!awayWins?'text-white/50':'text-white'} hover:text-yellow-200`}>{shortName(awayName)}</Link><div className="mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-white/35">Away{recordLabel(awayStanding)?` · ${recordLabel(awayStanding)}`:''}</div></div>
        <div className="px-1 sm:px-5 text-center">{scrimmage?<div><div className="text-2xl sm:text-5xl font-black text-white">{postponed?'POSTPONED':canceled?'CANCELED':timeLabel(game.game_time)}</div><div className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-300">Scrimmage</div></div>:live||final?<div><div className="flex items-center justify-center gap-2 sm:gap-5"><span className={`text-5xl sm:text-7xl lg:text-8xl font-black ${awayWins?'text-white':'text-white/55'}`}>{game.away_score??'—'}</span><span className="text-xl sm:text-3xl text-white/15">-</span><span className={`text-5xl sm:text-7xl lg:text-8xl font-black ${homeWins?'text-white':'text-white/55'}`}>{game.home_score??'—'}</span></div><div className={`mt-2 text-xs font-black uppercase tracking-[0.2em] ${live?'text-yellow-300':'text-emerald-400'}`}>{live?'Latest reported score':'Final'}</div></div>:postponed?<div className="text-xl sm:text-3xl font-black text-orange-300">POSTPONED</div>:canceled?<div className="text-xl sm:text-3xl font-black text-red-300">CANCELED</div>:<div><div className="text-2xl sm:text-5xl font-black text-white">{timeLabel(game.game_time)}</div><div className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">Scheduled</div></div>}</div>
        <div className="min-w-0 text-center flex flex-col items-center"><SchoolLogo school={homeSchool} size="xl"/><Link href={homeSchool?.slug?`/schools/${homeSchool.slug}`:'#'} className={`mt-3 max-w-full text-base sm:text-2xl font-black leading-tight ${final&&!homeWins?'text-white/50':'text-white'} hover:text-yellow-200`}>{shortName(homeName)}</Link><div className="mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-white/35">Home{recordLabel(homeStanding)?` · ${recordLabel(homeStanding)}`:''}</div></div>
      </div>
      <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl overflow-hidden border border-white/[0.07] bg-black/20"><div className="px-4 py-3"><div className="text-[9px] uppercase text-white/25">Venue</div><div className="mt-1 text-sm font-bold text-white/70">{venue}</div></div><div className="px-4 py-3 sm:border-x border-white/[0.07]"><div className="text-[9px] uppercase text-white/25">Season</div><div className="mt-1 text-sm font-bold text-white/70">{game.season?.name||'Current season'}</div></div><div className="px-4 py-3"><div className="text-[9px] uppercase text-white/25">Event</div><div className="mt-1 text-sm font-bold text-white/70">{scrimmage?'Scrimmage':game.event_name||'Regular season'}</div></div></div>
      <div className="mt-5 flex justify-center"><GameCenterActions gameId={game.id} shareTitle={shareTitle}/></div>
    </div></section>

    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {scrimmage&&<section className="rounded-2xl border border-yellow-300/20 bg-yellow-300/[0.055] px-5 py-4"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300">Preseason / non-counting event</div><div className="mt-1 text-sm font-bold text-white/80">This is a scrimmage. It does not count in official records, standings or BTM.</div></section>}
      {(awayStanding||homeStanding)&&<section className="grid md:grid-cols-2 gap-3">{[{name:awayName,standing:awayStanding,season:awaySeason},{name:homeName,standing:homeStanding,season:homeSeason}].map(item=><div key={item.name} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Season context</div><div className="mt-2 flex items-end justify-between gap-4"><div><div className="text-lg font-black text-white">{shortName(item.name)}</div><div className="mt-1 text-xs text-white/40">{[item.season?.division,item.season?.class?`Class ${item.season.class}`:null].filter(Boolean).join(' · ')||'Section X'}</div></div><div className="text-right"><div className="text-2xl font-black text-white">{recordLabel(item.standing)||'0-0'}</div><div className="text-[10px] text-white/35">overall</div></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/[0.025] p-3"><div className="font-black text-blue-300">{leagueRecordLabel(item.standing)||'0-0'}</div><div className="mt-1 text-[9px] uppercase text-white/25">Section X</div></div><div className="rounded-xl bg-white/[0.025] p-3"><div className="font-black text-yellow-300">{standingPosition(item.standing)?`#${standingPosition(item.standing)}`:'—'}</div><div className="mt-1 text-[9px] uppercase text-white/25">Position</div></div><div className="rounded-xl bg-white/[0.025] p-3"><div className="font-black text-white/75">{item.standing?.btm?Number(item.standing.btm).toFixed(2):'—'}</div><div className="mt-1 text-[9px] uppercase text-white/25">BTM</div></div></div></div>)}</section>}
      {!scrimmage&&periodNumbers.length>0&&<section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden"><div className="px-5 py-4 border-b border-white/[0.07]"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Scoring detail</div><h2 className="mt-1 text-xl font-black text-white">By period</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-b border-white/[0.07] text-white/35"><th className="text-left px-5 py-3">Team</th>{periodNumbers.map(n=><th key={n} className="px-3 py-3 text-center">{periodLabel(n)}</th>)}<th className="px-5 py-3 text-center">Total</th></tr></thead><tbody><tr className="border-b border-white/[0.05]"><td className="px-5 py-3 font-bold text-white/80">{awayName}</td>{periodNumbers.map(n=><td key={n} className="px-3 py-3 text-center text-white/65">{periodScore('away',n)}</td>)}<td className="px-5 py-3 text-center font-black text-white">{game.away_score??'—'}</td></tr><tr><td className="px-5 py-3 font-bold text-white/80">{homeName}</td>{periodNumbers.map(n=><td key={n} className="px-3 py-3 text-center text-white/65">{periodScore('home',n)}</td>)}<td className="px-5 py-3 text-center font-black text-white">{game.home_score??'—'}</td></tr></tbody></table></div></section>}
      {!scrimmage&&statDefinitions.length>0&&teamStats.length>0&&<section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden"><div className="px-5 py-4 border-b border-white/[0.07]"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Game stats</div><h2 className="mt-1 text-xl font-black text-white">Team comparison</h2></div><div className="divide-y divide-white/[0.05]">{statDefinitions.map(def=>{const a=teamStats.find((r:any)=>r.team_side==='away'&&r.stat_definition?.id===def.id);const h=teamStats.find((r:any)=>r.team_side==='home'&&r.stat_definition?.id===def.id);return <div key={def.id} className="grid grid-cols-[1fr_1.5fr_1fr] px-5 py-3 text-center"><div className="font-black text-white">{statValue(a)}</div><div className="text-xs text-white/40">{def.label}</div><div className="font-black text-white">{statValue(h)}</div></div>})}</div></section>}
      {!scrimmage&&athleteDefinitions.length>0&&athleteStats.length>0&&<section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden"><div className="px-5 py-4 border-b border-white/[0.07]"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Player stats</div><h2 className="mt-1 text-xl font-black text-white">Game leaders</h2></div>{[{id:awayTeam?.id||null,name:awayName},{id:homeTeam?.id||null,name:homeName}].map(team=>{const rows=athleteRows(team.id);if(!rows.length)return null;return <div key={team.name} className="border-b last:border-0 border-white/[0.07]"><div className="px-5 py-3 bg-white/[0.02] text-sm font-black text-white/75">{team.name}</div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="text-white/30"><th className="text-left px-5 py-2">Player</th>{athleteDefinitions.map(def=><th key={def.id} className="px-3 py-2 text-center">{def.label}</th>)}</tr></thead><tbody>{rows.map((row:any)=><tr key={row.athlete.id} className="border-t border-white/[0.05]"><td className="px-5 py-3 font-semibold">{row.athlete.slug?<Link href={`/athletes/${row.athlete.slug}`} className="text-white hover:text-yellow-300">{row.athlete.display_name}</Link>:row.athlete.display_name}</td>{athleteDefinitions.map(def=><td key={def.id} className="px-3 py-3 text-center text-white/60">{statValue(row.stats.get(def.id))}</td>)}</tr>)}</tbody></table></div></div>})}</section>}
      {(awayNeighbors.previous||awayNeighbors.next||homeNeighbors.previous||homeNeighbors.next)&&<section><div className="mb-4"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Team timeline</div><h2 className="mt-1 text-2xl font-black text-white">Before & after this game</h2></div><div className="grid lg:grid-cols-2 gap-4">{[{name:awayName,teamId:awayTeam?.id||null,...awayNeighbors},{name:homeName,teamId:homeTeam?.id||null,...homeNeighbors}].map(item=><div key={item.name} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="font-black text-white mb-3">{shortName(item.name)}</div><div className="grid sm:grid-cols-2 gap-2">{item.previous?<MatchupMini game={item.previous}/>:<div className="rounded-xl border border-dashed border-white/[0.07] p-4 text-xs text-white/25">No previous game listed.</div>}{item.next?<MatchupMini game={item.next}/>:<div className="rounded-xl border border-dashed border-white/[0.07] p-4 text-xs text-white/25">No next game listed.</div>}</div>{item.previous&&isFinal(item.previous)&&<div className="mt-3 text-[10px] text-white/30">Previous result: <span className="font-black text-white/55">{gameResultFor(item.previous,item.teamId,lowWins)}</span></div>}</div>)}</div></section>}
      {awayTeam?.id&&homeTeam?.id&&<section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden"><div className="px-5 py-4 border-b border-white/[0.07] flex items-end justify-between gap-4 flex-wrap"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Matchup history</div><h2 className="mt-1 text-xl font-black text-white">{shortName(awayName)} vs {shortName(homeName)}</h2></div>{seriesMeetings.length>0&&<div className="text-right"><div className="text-xs text-white/30">Season series</div><div className="mt-1 font-black text-white">{shortName(awayName)} {awaySeriesWins} · {shortName(homeName)} {homeSeriesWins}{seriesTies?` · ${seriesTies} tie${seriesTies===1?'':'s'}`:''}</div></div>}</div>{meetings.length?<div className="grid md:grid-cols-2 gap-2 p-4">{meetings.map((m:any)=><MatchupMini key={m.id} game={m}/>)}</div>:<div className="p-6 text-sm text-white/35">No previous official final between these teams is in the database yet.</div>}</section>}
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden"><div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between gap-3 flex-wrap"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Game gallery</div><h2 className="mt-1 text-xl font-black text-white">Photos from this matchup</h2></div><Link href={`/submit-photo?game=${game.id}`} className="rounded-xl border border-blue-400/25 bg-blue-400/10 px-4 py-2.5 text-xs font-black text-blue-300">Add photos</Link></div>{photos.length?<div className="grid grid-cols-2 md:grid-cols-3 gap-1 p-1">{photos.slice(0,12).map((p:any)=><div key={p.id} className="relative aspect-[4/3] overflow-hidden bg-black"><img src={p.photo_url} alt={p.caption||`${awayName} at ${homeName}`} className="w-full h-full object-cover"/>{p.photographer_credit_name&&<div className="absolute inset-x-0 bottom-0 p-2 pt-8 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-white/80">Photo: {p.photographer_credit_name}</div>}</div>)}</div>:<div className="p-7 sm:p-9 text-center text-sm text-white/35">No approved game photos yet.</div>}</section>
      {aroundGames.length>0&&<section><div className="mb-4 flex items-end justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300/65">Around Section X</div><h2 className="mt-1 text-2xl font-black text-white">More from {dateLabel(game.game_date)}</h2></div><Link href={`/scores?date=${game.game_date}`} className="text-xs font-black text-blue-300">All scores →</Link></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{aroundGames.map((other:any)=><MatchupMini key={other.id} game={other}/>)}</div></section>}
    </main>
  </div></PublicLayout>
}
