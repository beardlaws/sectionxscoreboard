import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { ALL_SPORTS } from '@/lib/constants'
import { calculateStandings } from '@/lib/standings'
import ScoreCard from '@/components/scores/ScoreCard'
import { GameWithTeams } from '@/types'
import { Trophy } from 'lucide-react'
import PublicLayout from '@/components/layout/PublicLayout'

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sport = ALL_SPORTS.find(s => s.slug === params.slug)
  if (!sport) return {}
  return {
    title: `${sport.name} Scores & Standings | Section X Scoreboard`,
    description: `Section X ${sport.name} scores, schedules, and standings. Northern NY high school sports.`,
  }
}

const SEASON_START: Record<string, string> = {
  'Fall': 'August 2026',
  'Winter': 'December 2026',
}

const SEASON_ICONS: Record<string, string> = {
  'Fall': '🍂',
  'Winter': '❄️',
}

export default async function SportPage({ params }: Props) {
  const sport = ALL_SPORTS.find(s => s.slug === params.slug)
  if (!sport) notFound()

  const supabase = createClient()

  const [{ data: activeSeason }, { data: sportRecord }] = await Promise.all([
    supabase.from('seasons').select('*').eq('is_active', true).single(),
    supabase.from('sports').select('*').eq('slug', params.slug).single(),
  ])

  // Sport exists in ALL_SPORTS but not in DB yet (fall/winter not seeded)
  // OR sport is in DB but no games this season
  const comingSoonSeason = !sportRecord ? sport.season : null

  if (!sportRecord) {
    const startDate = SEASON_START[sport.season] || 'this fall'
    const icon = SEASON_ICONS[sport.season] || '🏆'
    return (
      <PublicLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-6xl mb-6">{icon}</p>
          <h1 className="text-3xl font-black text-white mb-3"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
            {sport.name}
          </h1>
          <div className="rounded-2xl p-8 border border-white/8 inline-block"
            style={{ background: 'rgba(8,12,20,0.7)' }}>
            <p className="text-xl font-black text-blue-400 mb-2"
              style={{ fontFamily: 'var(--font-display)' }}>
              Season Starts {startDate}
            </p>
            <p className="text-slate-400 text-sm">
              {sport.name} scores, standings, and schedules will appear here once the season begins.
            </p>
            <p className="text-slate-500 text-xs mt-3">
              Coaches — submit scores at sectionxscoreboard.com/submit-score
            </p>
          </div>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/schools" className="btn-secondary text-sm">Browse Schools</Link>
            <Link href="/standings" className="btn-secondary text-sm">Current Standings</Link>
          </div>
        </div>
      </PublicLayout>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
  const twoWeeksAhead = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]

  const { data: gamesData } = await supabase
    .from('games')
    .select(`
      *,
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(*),
      external_away:external_opponents!games_external_away_opponent_id_fkey(*)
    `)
    .eq('sport_id', sportRecord.id)
    .gte('game_date', twoWeeksAgo)
    .lte('game_date', twoWeeksAhead)
    .eq(activeSeason ? 'season_id' : 'id', activeSeason ? activeSeason.id : 'none')
    .order('game_date', { ascending: false })

  const games = (gamesData as GameWithTeams[]) || []

  const { data: allGames } = await supabase
    .from('games')
    .select(`*, home_team:teams!games_home_team_id_fkey(*, school:schools(*)), away_team:teams!games_away_team_id_fkey(*, school:schools(*))`)
    .eq('sport_id', sportRecord.id)
    .eq('status', 'Final')
    .eq(activeSeason ? 'season_id' : 'id', activeSeason ? activeSeason.id : 'none')

  const { data: tsData } = activeSeason
    ? await supabase.from('team_seasons').select('team_id, division, class, btm_override').eq('season_id', activeSeason.id)
    : { data: [] }

  const standings = calculateStandings(
    (allGames as GameWithTeams[]) || [],
    tsData || [],
    sportRecord.sport_name
  )

  const recentGames = games.filter(g => g.status === 'Final')
  const upcomingGames = games.filter(g => g.status === 'Scheduled' || g.status === 'Postponed').reverse()

  // No games at all this season
  if (games.length === 0 && standings.length === 0) {
    return (
      <PublicLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-6xl mb-6">
            {sport.season === 'Fall' ? '🍂' : sport.season === 'Winter' ? '❄️' : '🏆'}
          </p>
          <h1 className="text-3xl font-black text-white mb-3"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
            {sport.name}
          </h1>
          <div className="rounded-2xl p-8 border border-white/8 inline-block"
            style={{ background: 'rgba(8,12,20,0.7)' }}>
            {sport.season !== 'Spring' ? (
              <>
                <p className="text-xl font-black text-blue-400 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                  Season Starts {SEASON_START[sport.season] || 'Coming Soon'}
                </p>
                <p className="text-slate-400 text-sm">
                  {sport.name} scores and standings will appear here once the season begins.
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-black text-slate-400 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                  No Games Yet
                </p>
                <p className="text-slate-500 text-sm">
                  Scores will appear here once games are reported.
                </p>
              </>
            )}
            <p className="text-slate-600 text-xs mt-3">
              Coaches — submit scores at sectionxscoreboard.com/submit-score
            </p>
          </div>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/schools" className="btn-secondary text-sm">Browse Schools</Link>
            <Link href="/standings" className="btn-secondary text-sm">Current Standings</Link>
          </div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="text-slate-400 hover:text-white text-sm">Home</Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 text-sm">{sport.name}</span>
          </div>
          <h1 className="text-3xl font-bold font-display text-white">{sport.name}</h1>
          {activeSeason && <p className="text-slate-400 text-sm mt-1">{activeSeason.name}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {upcomingGames.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Upcoming</h2>
                <div className="space-y-2">
                  {upcomingGames.slice(0, 10).map(game => (
                    <ScoreCard key={game.id} game={game} compact />
                  ))}
                </div>
              </section>
            )}
            {recentGames.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Results</h2>
                <div className="space-y-2">
                  {recentGames.slice(0, 20).map(game => (
                    <ScoreCard key={game.id} game={game} compact />
                  ))}
                </div>
              </section>
            )}
          </div>

          <div>
            {standings.length > 0 && (
              <div className="card p-4">
                <h2 className="text-white font-bold flex items-center gap-2 mb-4">
                  <Trophy size={16} className="text-yellow-400" /> Standings
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-white/10">
                        <th className="text-left pb-2 font-medium">Team</th>
                        <th className="text-center pb-2 font-medium">W</th>
                        <th className="text-center pb-2 font-medium">L</th>
                        <th className="text-center pb-2 font-medium">PCT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.slice(0, 16).map((row, i) => (
                        <tr key={row.team_id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-1.5 pr-2">
                            <span className="text-slate-500 mr-1.5">{i + 1}.</span>
                            <Link href={`/teams/${row.slug}`} className="text-white hover:text-ice transition-colors">
                              {row.school_name || row.team_name}
                            </Link>
                          </td>
                          <td className="text-center text-white font-mono">{row.wins}</td>
                          <td className="text-center text-white font-mono">{row.losses}</td>
                          <td className="text-center text-slate-300 font-mono">{row.win_pct.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Link href="/standings" className="block text-center text-xs text-blue-400 hover:underline mt-3">
                  Full Standings →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
