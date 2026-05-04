import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { calculateStandings } from '@/lib/standings'
import { GameWithTeams } from '@/types'
import PublicLayout from '@/components/layout/PublicLayout'

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data: team } = await supabase.from('teams')
    .select('team_name, school:schools(school_name), sport:sports(sport_name)')
    .eq('slug', params.slug).single()
  if (!team) return {}
  const s = team.school as any
  const sp = team.sport as any
  return {
    title: `${s?.school_name} ${sp?.sport_name} | Section X Scoreboard`,
    description: `${team.team_name} scores, schedule, and standings.`,
  }
}

function formatTime(t: string) {
  try {
    const [h, m] = t.split(':').map(Number)
    const isPM = h < 8 || h >= 12
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`
  } catch { return t }
}

export default async function TeamPage({ params }: Props) {
  const supabase = createClient()

  const { data: team } = await supabase.from('teams')
    .select('*, school:schools(*), sport:sports(*)')
    .eq('slug', params.slug).single()
  if (!team) notFound()

  const school = team.school as any
  const sport = team.sport as any
  const schoolColor = school?.primary_color || '#1e3a5f'
  const schoolColor2 = school?.secondary_color || '#0f172a'
  const isGolf = sport?.sport_name?.toLowerCase().includes('golf')

  const { data: activeSeason } = await supabase.from('seasons').select('*').eq('is_active', true).single()
  const teamSportId = sport?.id || team.sport_id

  // All games this season for this team
  let q = supabase.from('games').select(`
    *, sport:sports(sport_name, gender),
    home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
    away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
    external_home:external_opponents!games_external_home_opponent_id_fkey(name),
    external_away:external_opponents!games_external_away_opponent_id_fkey(name)
  `).or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
  if (activeSeason) q = q.eq('season_id', activeSeason.id)
  if (teamSportId) q = q.eq('sport_id', teamSportId)
  const { data: gamesData } = await q.order('game_date', { ascending: false })
  const games = (gamesData as GameWithTeams[]) || []

  // Record
  const finalGames = games.filter(g => g.status === 'Final')
  let wins = 0, losses = 0, ties = 0
  finalGames.forEach(g => {
    if (g.home_score == null || g.away_score == null) return
    const isHome = g.home_team_id === team.id
    const mine = isHome ? g.home_score : g.away_score
    const opp = isHome ? g.away_score : g.home_score
    if (isGolf ? mine < opp : mine > opp) wins++
    else if (mine === opp) ties++
    else losses++
  })

  const upcoming = games.filter(g => g.status === 'Scheduled' || g.status === 'Postponed').reverse()
  const results = games.filter(g => g.status === 'Final')

  // Last 5 form
  const last5 = results.slice(0, 5)
  const form = last5.map(g => {
    if (g.home_score == null || g.away_score == null) return 'U'
    const isHome = g.home_team_id === team.id
    const mine = isHome ? g.home_score : g.away_score
    const opp = isHome ? g.away_score : g.home_score
    if (isGolf ? mine < opp : mine > opp) return 'W'
    if (mine === opp) return 'T'
    return 'L'
  }).reverse()

  // Standings position
  let standingsPosition: number | null = null
  let standingsTotal: number | null = null
  if (activeSeason && teamSportId) {
    const { data: allGames } = await supabase.from('games')
      .select(`*, sport:sports(sport_name), home_team:teams!games_home_team_id_fkey(*, school:schools(*)), away_team:teams!games_away_team_id_fkey(*, school:schools(*))`)
      .eq('sport_id', teamSportId).eq('season_id', activeSeason.id).eq('status', 'Final')
    const { data: tsData } = await supabase.from('team_seasons')
      .select('team_id, division, class').eq('season_id', activeSeason.id)
    const standings = calculateStandings(allGames || [], tsData || [], sport?.sport_name)
    const myRow = standings.findIndex(r => r.team_id === team.id)
    if (myRow >= 0) {
      standingsPosition = myRow + 1
      standingsTotal = standings.length
    }
  }

  // Get team's division from team_seasons
  const { data: teamSeason } = await supabase.from('team_seasons')
    .select('division, class').eq('team_id', team.id)
    .eq('season_id', activeSeason?.id || '').maybeSingle()

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Hero */}
        <div className="rounded-2xl overflow-hidden mb-6 relative"
          style={{ background: `linear-gradient(135deg, ${schoolColor}ee 0%, ${schoolColor2}cc 100%)` }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '200px' }} />
          <div className="relative px-6 pt-5 pb-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-white/50 mb-3">
              <Link href={`/schools/${school?.slug}`} className="hover:text-white transition-colors">{school?.school_name}</Link>
              <span>/</span>
              <span>{sport?.sport_name}</span>
            </div>

            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-white leading-none"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                  {team.team_name}
                </h1>
                {activeSeason && <p className="text-white/60 text-sm mt-1">{activeSeason.name}</p>}

                {/* Form pills */}
                {form.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3">
                    <span className="text-white/40 text-xs mr-1">Last {form.length}:</span>
                    {form.map((r, i) => (
                      <span key={i} className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                        style={{
                          background: r === 'W' ? 'rgba(34,197,94,0.3)' : r === 'L' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.15)',
                          color: r === 'W' ? '#4ade80' : r === 'L' ? '#f87171' : '#94a3b8',
                          fontFamily: 'var(--font-display)',
                        }}>{r}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Record */}
              <div className="flex items-end gap-4 flex-shrink-0">
                <div className="text-center">
                  <div className="text-5xl font-black text-white leading-none"
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{wins}</div>
                  <div className="text-xs text-white/50 uppercase tracking-widest mt-1"
                    style={{ fontFamily: 'var(--font-display)' }}>W</div>
                </div>
                <div className="text-white/30 text-3xl font-light mb-1">-</div>
                <div className="text-center">
                  <div className="text-5xl font-black text-white leading-none"
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{losses}</div>
                  <div className="text-xs text-white/50 uppercase tracking-widest mt-1"
                    style={{ fontFamily: 'var(--font-display)' }}>L</div>
                </div>
                {ties > 0 && (
                  <>
                    <div className="text-white/30 text-3xl font-light mb-1">-</div>
                    <div className="text-center">
                      <div className="text-5xl font-black text-white leading-none"
                        style={{ fontFamily: 'var(--font-display)' }}>{ties}</div>
                      <div className="text-xs text-white/50 uppercase tracking-widest mt-1"
                        style={{ fontFamily: 'var(--font-display)' }}>T</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Meta pills */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {teamSeason?.division && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white/70"
                  style={{ background: 'rgba(255,255,255,0.1)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
                  {teamSeason.division} Division
                </span>
              )}
              {teamSeason?.class && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white/70"
                  style={{ background: 'rgba(255,255,255,0.1)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
                  Class {teamSeason.class}
                </span>
              )}
              {standingsPosition && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-yellow-400"
                  style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.25)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
                  #{standingsPosition} of {standingsTotal}
                </span>
              )}
              <Link href="/standings" className="px-2.5 py-1 rounded-full text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                style={{ background: 'rgba(37,99,235,0.15)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
                Full Standings →
              </Link>
            </div>
          </div>
        </div>

        {/* Upcoming games */}
        {upcoming.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="font-black text-xs text-blue-400 uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-display)' }}>Upcoming · {upcoming.length}</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/6" style={{ background: 'rgba(8,12,20,0.7)' }}>
              {upcoming.slice(0, 8).map((game, i) => {
                const ht = game.home_team
                const at = game.away_team
                const homeName = ht?.school?.school_name || (game as any).external_home?.name || 'TBD'
                const awayName = at?.school?.school_name || (game as any).external_away?.name || 'TBD'
                const isHome = game.home_team_id === team.id
                const opp = isHome ? awayName : homeName
                const timeStr = game.game_time ? formatTime(game.game_time) : 'TBD'
                const isPpd = game.status === 'Postponed'
                return (
                  <Link key={game.id} href={`/games/${game.id}`}
                    className="flex items-center px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-0">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-slate-600 mr-2" style={{ fontFamily: 'var(--font-display)' }}>
                        {isHome ? 'vs' : '@'}
                      </span>
                      <span className="text-sm font-semibold text-slate-200" style={{ fontFamily: 'var(--font-display)' }}>{opp}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="text-xs text-slate-500">{game.game_date}</div>
                      {isPpd
                        ? <div className="text-xs font-bold text-amber-500" style={{ fontFamily: 'var(--font-display)' }}>PPD</div>
                        : <div className="text-xs font-bold text-blue-400" style={{ fontFamily: 'var(--font-display)' }}>{timeStr}</div>
                      }
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="font-black text-xs text-slate-400 uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-display)' }}>Results · {results.length}</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/6" style={{ background: 'rgba(8,12,20,0.7)' }}>
              {results.map((game, i) => {
                const ht = game.home_team
                const at = game.away_team
                const homeName = ht?.school?.school_name || (game as any).external_home?.name || 'TBD'
                const awayName = at?.school?.school_name || (game as any).external_away?.name || 'TBD'
                const homeColor = ht?.school?.primary_color || '#334155'
                const awayColor = at?.school?.primary_color || '#334155'
                const isHome = game.home_team_id === team.id
                const myScore = isHome ? game.home_score : game.away_score
                const oppScore = isHome ? game.away_score : game.home_score
                const iWon = myScore != null && oppScore != null && (isGolf ? myScore < oppScore : myScore > oppScore)
                const iLost = myScore != null && oppScore != null && (isGolf ? myScore > oppScore : myScore < oppScore)
                const homeWins = game.home_score != null && game.away_score != null &&
                  (isGolf ? (game.home_score < game.away_score) : (game.home_score > game.away_score))
                const awayWins = game.home_score != null && game.away_score != null &&
                  (isGolf ? (game.away_score < game.home_score) : (game.away_score > game.home_score))
                const winnerColor = homeWins ? homeColor : awayColor
                return (
                  <Link key={game.id} href={`/games/${game.id}`}
                    className="flex items-center px-4 py-2.5 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-0">
                    {/* W/L indicator */}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mr-3`}
                      style={{
                        background: iWon ? 'rgba(34,197,94,0.2)' : iLost ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                        color: iWon ? '#4ade80' : iLost ? '#f87171' : '#64748b',
                        fontFamily: 'var(--font-display)',
                        fontSize: '10px',
                      }}>
                      {iWon ? 'W' : iLost ? 'L' : 'T'}
                    </div>
                    {/* Teams */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-xs text-slate-600 w-6" style={{ fontFamily: 'var(--font-display)' }}>AWY</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: awayWins ? 700 : 400, color: awayWins ? '#e2e8f5' : '#6b7a8d' }}>
                          {awayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-600 w-6" style={{ fontFamily: 'var(--font-display)' }}>HME</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: homeWins ? 700 : 400, color: homeWins ? '#e2e8f5' : '#6b7a8d' }}>
                          {homeName}
                        </span>
                      </div>
                    </div>
                    {/* Score */}
                    <div className="flex flex-col items-end ml-3 flex-shrink-0">
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: awayWins ? 800 : 500, fontSize: awayWins ? '16px' : '13px', color: awayWins ? '#fff' : '#374151', lineHeight: 1 }}>
                        {game.away_score}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: homeWins ? 800 : 500, fontSize: homeWins ? '16px' : '13px', color: homeWins ? '#fff' : '#374151', lineHeight: 1, marginTop: '2px' }}>
                        {game.home_score}
                      </span>
                    </div>
                    <div className="ml-2 flex flex-col items-center flex-shrink-0 gap-0.5">
                      <span className="text-xs font-black text-emerald-500" style={{ fontFamily: 'var(--font-display)', fontSize: '10px' }}>F</span>
                      <span className="text-xs text-slate-700" style={{ fontSize: '10px' }}>{game.game_date?.slice(5)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {games.length === 0 && (
          <div className="rounded-2xl p-10 text-center border border-white/6" style={{ background: 'rgba(8,12,20,0.6)' }}>
            <p className="text-slate-500">No games found for this team this season.</p>
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
