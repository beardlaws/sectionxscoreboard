// src/app/(public)/schools/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'

export const revalidate = 0

interface PageProps { params: { slug: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createClient()
  const { data: school } = await supabase.from('schools').select('*').eq('slug', params.slug).single()
  if (!school) return { title: 'School Not Found' }
  return {
    title: `${school.school_name} ${school.mascot} Scores & Standings | Section X Scoreboard`,
    description: `${school.school_name} ${school.mascot} sports scores, standings, schedule and results. ${school.city}, ${school.county} County. Section X / Section 10 Northern New York high school sports.`,
  }
}

const SPORT_ICONS: Record<string, string> = {
  Baseball: '⚾', Softball: '🥎', Football: '🏈',
  'Boys Basketball': '🏀', 'Girls Basketball': '🏀',
  'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
  'Boys Hockey': '🏒', 'Girls Hockey': '🏒',
  'Boys Soccer': '⚽', 'Girls Soccer': '⚽',
  Volleyball: '🏐', 'Boys Golf': '⛳', 'Girls Golf': '⛳',
  Swimming: '🏊', 'Girls Swimming': '🏊',
  'Boys Wrestling': '🤼', 'Girls Wrestling': '🤼',
  'Cross Country': '🏃', 'Boys Cross Country': '🏃', 'Girls Cross Country': '🏃',
  'Boys Track': '🏃', 'Girls Track': '🏃',
}

function one<T = any>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(time: string | null) {
  if (!time) return 'TBD'
  const [h, m] = time.split(':')
  const hour = Number(h)
  if (Number.isNaN(hour)) return time
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default async function SchoolPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: school, error } = await supabase.from('schools').select('*').eq('slug', params.slug).single()
  if (!school || error) notFound()

  const logoUrl = (school as any).logo_url as string | null | undefined
  const { data: activeSeason } = await supabase.from('seasons').select('id, name, year, season_type').eq('is_active', true).single()

  const { data: teamSeasonRows } = activeSeason?.id
    ? await supabase
        .from('team_seasons')
        .select(`
          id, team_id, season_id, division, class, active_for_season,
          team:teams(
            id, team_name, slug, school_id, sport_id, level, active,
            sport:sports(id, sport_name, slug, gender, season_type)
          )
        `)
        .eq('season_id', activeSeason.id)
        .neq('active_for_season', false)
    : { data: [] }

  const activeTeams = (teamSeasonRows || [])
    .filter((record: any) => {
      const team = one<any>(record.team)
      return !!team && team.school_id === school.id && team.active !== false && (!team.level || team.level.toLowerCase().trim() === 'varsity')
    })
    .map((record: any) => {
      const team = one<any>(record.team)
      const sport = one<any>(team?.sport)
      return { ...team, sport, division: record.division || '', class: record.class || '' }
    })

  const teamIds = activeTeams.map((t: any) => t.id)
  const sportIds = [...new Set(activeTeams.map((t: any) => t.sport?.id).filter(Boolean))]

  const { data: schoolSponsor } = await supabase
    .from('sponsors')
    .select('*')
    .eq('placement_type', 'school')
    .eq('school_id', school.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  const today = new Date().toISOString().slice(0, 10)

  const { data: seasonGames } = teamIds.length > 0 && activeSeason?.id
    ? await supabase
        .from('games')
        .select(`
          *, sport:sports(*),
          home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
          away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
          external_home:external_opponents!games_external_home_opponent_id_fkey(*),
          external_away:external_opponents!games_external_away_opponent_id_fkey(*)
        `)
        .eq('season_id', activeSeason.id)
        .in('sport_id', sportIds.length > 0 ? sportIds : ['none'])
        .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
        .order('game_date', { ascending: true })
    : { data: [] }

  const games = seasonGames || []
  const teamRecords = new Map<string, { w: number; l: number; t: number }>()
  activeTeams.forEach((team: any) => teamRecords.set(team.id, { w: 0, l: 0, t: 0 }))

  for (const game of games) {
    if (game.status !== 'Final' || game.home_score == null || game.away_score == null) continue
    const isGolf = game.sport?.sport_name?.toLowerCase().includes('golf')
    const homeWins = isGolf ? game.home_score < game.away_score : game.home_score > game.away_score
    const awayWins = isGolf ? game.away_score < game.home_score : game.away_score > game.home_score

    for (const id of [game.home_team_id, game.away_team_id]) {
      if (!id || !teamRecords.has(id)) continue
      const rec = teamRecords.get(id)!
      const isHome = game.home_team_id === id
      if (game.home_score === game.away_score) rec.t++
      else if ((isHome && homeWins) || (!isHome && awayWins)) rec.w++
      else rec.l++
    }
  }

  const nextGameByTeam = new Map<string, any>()
  for (const game of games) {
    if (!['Scheduled', 'Postponed'].includes(game.status) || game.game_date < today) continue
    for (const id of [game.home_team_id, game.away_team_id]) {
      if (id && teamIds.includes(id) && !nextGameByTeam.has(id)) nextGameByTeam.set(id, game)
    }
  }

  const todaysGames = games.filter((g: any) => g.game_date === today && ['Scheduled', 'Postponed'].includes(g.status))
  const upcomingGames = games.filter((g: any) => g.game_date >= today && ['Scheduled', 'Postponed'].includes(g.status)).slice(0, 8)
  const recentGames = games.filter((g: any) => g.status === 'Final').sort((a: any, b: any) => b.game_date.localeCompare(a.game_date)).slice(0, 12)

  const logoInitials = school.alias || school.school_name?.split(' ')
    .filter((w: string) => !['Central', 'School', 'Free', 'Academy', 'High', 'of'].includes(w))
    .map((w: string) => w[0]).join('').slice(0, 3).toUpperCase()

  const sportDisplay = (team: any) => {
    const sport = team.sport
    if (!sport) return ''

    const sportName = sport.sport_name || ''
    const gender = sport.gender || ''

    if (
      (gender === 'Boys' || gender === 'Girls') &&
      !sportName.toLowerCase().startsWith(gender.toLowerCase())
    ) {
      return `${gender} ${sportName}`
    }

    return sportName
  }

  const iconForTeam = (team: any) => SPORT_ICONS[sportDisplay(team)] || SPORT_ICONS[team.sport?.sport_name || ''] || '🏆'

  const schoolSide = (game: any) => teamIds.includes(game.home_team_id) ? 'home' : teamIds.includes(game.away_team_id) ? 'away' : null
  const opponent = (game: any) => {
    const side = schoolSide(game)
    if (side === 'home') return game.away_team?.school?.school_name || game.external_away?.name || 'TBD'
    if (side === 'away') return game.home_team?.school?.school_name || game.external_home?.name || 'TBD'
    return 'TBD'
  }
  const atVs = (game: any) => game.neutral_site ? 'vs' : schoolSide(game) === 'home' ? 'vs' : '@'

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="rounded-2xl overflow-hidden mb-6 relative"
          style={{ background: `linear-gradient(135deg, ${school.primary_color || '#1e2d47'} 0%, ${school.secondary_color || '#0f172a'}cc 100%)` }}>
          <div className="relative px-6 py-8">
            <nav className="text-xs mb-4 opacity-60 text-white">
              <Link href="/schools" className="hover:opacity-100">Schools</Link><span className="mx-2">/</span><span>{school.school_name}</span>
            </nav>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {school.city}, NY · {school.county} County
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-white leading-none" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                  {school.school_name}
                </h1>
                <p className="text-white/70 text-lg font-bold mt-1" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>{school.mascot}</p>
                {activeSeason && <div className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest bg-black/20 text-white/80 border border-white/10">{activeSeason.name}</div>}
              </div>
              <div className="flex-shrink-0 w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white/20"
                style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}>
                {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-contain p-2" /> :
                  <span className="font-black text-white text-2xl" style={{ fontFamily: 'var(--font-display)' }}>{logoInitials}</span>}
              </div>
            </div>
          </div>
        </div>

        <section className="mb-7">
          <div className="flex items-center gap-2 mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm" style={{ fontFamily: 'var(--font-display)' }}>Today</h2><div className="flex-1 h-px bg-white/6" /></div>
          {todaysGames.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {todaysGames.map((game: any) => (
                <Link key={game.id} href={`/games/${game.id}`} className="rounded-xl p-4 border transition-all hover:-translate-y-0.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-xs uppercase tracking-widest font-black text-slate-500 mb-1">{game.sport?.sport_name || 'Sport'}</div>
                  <div className="font-black text-white text-lg">{atVs(game)} {opponent(game)}</div>
                  <div className="text-sm text-slate-400 mt-1">{formatTime(game.game_time)}{game.location ? ` · ${game.location}` : ''}</div>
                </Link>
              ))}
            </div>
          ) : <div className="rounded-xl px-4 py-5 border text-sm text-slate-500" style={{ background: 'rgba(8,12,20,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}>No games scheduled today.</div>}
        </section>

        <section className="mb-7">
          <div className="flex items-center gap-2 mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm" style={{ fontFamily: 'var(--font-display)' }}>Upcoming</h2><div className="flex-1 h-px bg-white/6" /></div>
          {upcomingGames.length > 0 ? (
            <div className="rounded-xl overflow-hidden border" style={{ background: 'rgba(8,12,20,0.65)', borderColor: 'rgba(255,255,255,0.07)' }}>
              {upcomingGames.map((game: any) => (
                <Link key={game.id} href={`/games/${game.id}`} className="grid grid-cols-[72px_1fr_auto] md:grid-cols-[110px_150px_1fr_auto] gap-3 items-center px-4 py-3 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.03] transition-colors">
                  <div className="text-xs font-black text-slate-500 uppercase">{formatDate(game.game_date)}</div>
                  <div className="hidden md:block text-xs font-black text-slate-500 uppercase tracking-wider">{game.sport?.sport_name}</div>
                  <div className="min-w-0"><div className="font-bold text-white truncate">{atVs(game)} {opponent(game)}</div><div className="text-xs text-slate-500 md:hidden">{game.sport?.sport_name}</div></div>
                  <div className="text-xs text-slate-400 text-right">{formatTime(game.game_time)}</div>
                </Link>
              ))}
            </div>
          ) : <div className="rounded-xl px-4 py-5 border text-sm text-slate-500" style={{ background: 'rgba(8,12,20,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}>No upcoming games loaded yet.</div>}
        </section>

        {activeTeams.length > 0 && activeSeason && (
          <section className="mb-7">
            <div className="flex items-center gap-2 mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm" style={{ fontFamily: 'var(--font-display)' }}>{activeSeason.name} Teams</h2><div className="flex-1 h-px bg-white/6" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeTeams.map((team: any) => {
                const rec = teamRecords.get(team.id) || { w: 0, l: 0, t: 0 }
                const next = nextGameByTeam.get(team.id)
                return (
                  <Link key={team.id} href={`/teams/${team.slug}`} className="rounded-xl p-4 border transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><span className="text-lg">{iconForTeam(team)}</span><span className="text-xs font-black text-slate-400 uppercase tracking-wider truncate" style={{ fontFamily: 'var(--font-display)' }}>{sportDisplay(team)}</span></div>
                        <div className="font-black text-white text-2xl mt-2" style={{ fontFamily: 'var(--font-display)' }}>{rec.w}-{rec.l}{rec.t > 0 ? `-${rec.t}` : ''}</div>
                        {(team.division || team.class) && <div className="text-xs text-slate-500 mt-1">{team.division ? `${team.division} Division` : ''}{team.division && team.class ? ' · ' : ''}{team.class ? `Class ${team.class}` : ''}</div>}
                      </div>
                      <span className="text-xs text-blue-400 font-bold">View →</span>
                    </div>
                    {next && <div className="mt-4 pt-3 border-t border-white/[0.06]"><div className="text-[10px] uppercase tracking-widest font-black text-slate-600 mb-1">Next</div><div className="text-sm text-slate-300 truncate">{atVs(next)} {opponent(next)} · {formatDate(next.game_date)}</div></div>}
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2"><h2 className="font-black text-white uppercase tracking-widest text-sm" style={{ fontFamily: 'var(--font-display)' }}>Recent Results</h2><div className="flex-1 h-px bg-white/6" /></div>
            {recentGames.length > 0 ? (
              <div className="rounded-xl overflow-hidden border" style={{ background: 'rgba(8,12,20,0.7)', borderColor: 'rgba(255,255,255,0.06)' }}>
                {recentGames.map((game: any) => {
                  const isHome = teamIds.includes(game.home_team_id)
                  const mine = isHome ? game.home_score : game.away_score
                  const oppScore = isHome ? game.away_score : game.home_score
                  const isGolf = game.sport?.sport_name?.toLowerCase().includes('golf')
                  const won = isGolf ? mine < oppScore : mine > oppScore
                  const tied = mine === oppScore
                  return (
                    <Link key={game.id} href={`/games/${game.id}`} className="grid grid-cols-[80px_1fr_auto] gap-3 items-center px-4 py-3 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.03]">
                      <div className="text-xs text-slate-500">{formatDate(game.game_date)}</div>
                      <div><div className="text-xs text-slate-500 uppercase">{game.sport?.sport_name}</div><div className="font-bold text-white">{atVs(game)} {opponent(game)}</div></div>
                      <div className="flex items-center gap-2"><span className="font-mono text-white">{mine}-{oppScore}</span><span className={`text-xs font-black ${tied ? 'text-slate-400' : won ? 'text-green-400' : 'text-red-400'}`}>{tied ? 'T' : won ? 'W' : 'L'}</span></div>
                    </Link>
                  )
                })}
              </div>
            ) : <div className="rounded-xl p-8 text-center border border-white/6" style={{ background: 'rgba(8,12,20,0.5)' }}><p className="text-slate-500 text-sm">No results yet this season.</p></div>}
          </div>

          <div className="space-y-4">
            <Link href="/submit-score" className="block rounded-xl p-4 text-center text-white font-black uppercase tracking-widest text-sm"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontFamily: 'var(--font-display)', boxShadow: '0 4px 20px rgba(37,99,235,0.3)' }}>
              ✏️ Submit a Score
            </Link>

            {schoolSponsor ? (
              <a href={(schoolSponsor as any).website_url || '#'} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(8,12,24,0.95))', border: '1px solid rgba(37,99,235,0.25)' }}>
                <div className="px-4 py-2 border-b" style={{ borderColor: 'rgba(37,99,235,0.15)' }}><p className="text-xs font-black text-blue-400 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.12em' }}>School Sponsor</p></div>
                <div className="px-4 py-3 flex items-center gap-3">
                  {(schoolSponsor as any).logo_url && <img src={(schoolSponsor as any).logo_url} alt={(schoolSponsor as any).business_name} className="w-10 h-10 object-contain rounded-lg flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }} />}
                  <div className="min-w-0"><p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{(schoolSponsor as any).business_name}</p>{(schoolSponsor as any).tagline && <p className="text-xs text-slate-400 truncate">{(schoolSponsor as any).tagline}</p>}</div>
                  <span className="text-xs text-blue-400 ml-auto flex-shrink-0" style={{ fontFamily: 'var(--font-display)' }}>Visit →</span>
                </div>
              </a>
            ) : (
              <Link href="/advertise" className="block rounded-xl p-4 text-center border border-dashed border-white/8 transition-all hover:border-white/16">
                <p className="text-xs text-slate-600">Sponsor {school.school_name} coverage</p><p className="text-xs text-blue-400 mt-1 font-semibold">Learn more →</p>
              </Link>
            )}

            <Link href="/standings" className="block rounded-xl p-3 text-center border border-white/8 text-sm text-slate-300 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.03)' }}>📊 View Standings</Link>
            <Link href="/scores" className="block rounded-xl p-3 text-center border border-white/8 text-sm text-slate-300 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.03)' }}>🗓️ All Scores & Schedules</Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
