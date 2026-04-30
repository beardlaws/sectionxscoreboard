import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'
import ScoreCard from '@/components/scores/ScoreCard'

export const revalidate = 300

interface PageProps { params: { slug: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createClient()
  const { data: school } = await supabase.from('schools').select('*').eq('slug', params.slug).single()
  if (!school) return { title: 'School Not Found' }
  return {
    title: `${school.school_name} ${school.mascot} | Section X Scoreboard`,
    description: `${school.school_name} sports scores, standings, and schedules. ${school.mascot} of ${school.city}, ${school.county} County.`,
  }
}

const SPORT_ICONS: Record<string, string> = {
  Baseball: '⚾', Softball: '🥎', Football: '🏈',
  'Boys Basketball': '🏀', 'Girls Basketball': '🏀',
  'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
  'Boys Hockey': '🏒', 'Girls Hockey': '🏒',
  'Boys Soccer': '⚽', 'Girls Soccer': '⚽',
  Volleyball: '🏐', 'Boys Golf': '⛳', 'Girls Swimming': '🏊',
  'Boys Wrestling': '🤼', 'Girls Wrestling': '🤼',
  'Boys Track': '🏃', 'Girls Track': '🏃',
  'Cross Country': '🏃',
}

export default async function SchoolPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: school, error } = await supabase.from('schools').select('*').eq('slug', params.slug).single()
  if (!school || error) notFound()

  const { data: activeSeason } = await supabase.from('seasons').select('id, name').eq('is_active', true).single()

  // Teams with sport info
  const { data: teams } = await supabase
    .from('teams')
    .select('*, sport:sports(*)')
    .eq('school_id', school.id)
    .eq('active', true)
    .order('team_name')

  const teamIds = (teams || []).map(t => t.id)
  const sportIds = [...new Set((teams || []).map(t => (t.sport as any)?.id).filter(Boolean))]

  // Recent finals
  const { data: recentGames } = teamIds.length > 0
    ? await supabase
        .from('games')
        .select(`*, sport:sports(*),
          home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
          away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
          external_home:external_opponents!games_external_home_opponent_id_fkey(*),
          external_away:external_opponents!games_external_away_opponent_id_fkey(*)`)
        .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
        .eq('status', 'Final')
        .in('sport_id', sportIds.length > 0 ? sportIds : ['none'])
        .order('game_date', { ascending: false })
        .limit(15)
    : { data: [] }

  // Calculate record per team
  async function getTeamRecord(teamId: string, sportId: string, isGolf: boolean): Promise<{ w: number; l: number; t: number }> {
    if (!activeSeason?.id) return { w: 0, l: 0, t: 0 }
    const { data: tgames } = await supabase
      .from('games')
      .select('home_team_id, home_score, away_score')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('season_id', activeSeason.id)
      .eq('sport_id', sportId)
      .eq('status', 'Final')
    let w = 0, l = 0, t = 0
    for (const g of (tgames || [])) {
      if (g.home_score == null || g.away_score == null) continue
      const isHome = g.home_team_id === teamId
      const mine = isHome ? g.home_score : g.away_score
      const opp = isHome ? g.away_score : g.home_score
      if (isGolf ? mine < opp : mine > opp) w++
      else if (mine === opp) t++
      else l++
    }
    return { w, l, t }
  }

  // Get records for all active spring teams (current season)
  const teamRecords: Record<string, { w: number; l: number; t: number }> = {}
  for (const team of (teams || [])) {
    const sportId = (team.sport as any)?.id
    if (!sportId) continue
    const isGolf = team.sport?.sport_name?.toLowerCase().includes('golf')
    teamRecords[team.id] = await getTeamRecord(team.id, sportId, isGolf)
  }

  // Group by season
  const sportsBySeason: Record<string, typeof teams> = {}
  const SEASON_ORDER = ['Spring', 'Fall', 'Winter', 'Other']
  for (const team of teams || []) {
    const s = team.sport?.season_type || 'Other'
    if (!sportsBySeason[s]) sportsBySeason[s] = []
    sportsBySeason[s]!.push(team)
  }

  // Group recent results by sport
  const resultsBySport: Record<string, any[]> = {}
  for (const game of (recentGames || [])) {
    const key = game.sport?.sport_name || 'Other'
    if (!resultsBySport[key]) resultsBySport[key] = []
    if (resultsBySport[key].length < 5) resultsBySport[key].push(game)
  }

  const { data: photos } = await supabase
    .from('photos').select('*').eq('school_id', school.id).eq('approved', true)
    .order('created_at', { ascending: false }).limit(6)

  const { data: sponsor } = await supabase
    .from('sponsors').select('*').eq('placement', 'school_page').eq('active', true).single()

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Hero header */}
        <div className="rounded-2xl overflow-hidden mb-6 relative"
          style={{ background: `linear-gradient(135deg, ${school.primary_color || '#1e2d47'} 0%, ${school.secondary_color || '#0f172a'}cc 100%)` }}>
          {/* Noise texture overlay */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")', backgroundSize: '200px' }} />
          <div className="relative px-6 py-8">
            <nav className="text-xs mb-4 opacity-60 text-white">
              <Link href="/schools" className="hover:opacity-100">Schools</Link>
              <span className="mx-2">/</span>
              <span>{school.school_name}</span>
            </nav>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-1"
                  style={{ fontFamily: 'var(--font-display)' }}>{school.city}, NY · {school.county} County</p>
                <h1 className="text-4xl md:text-5xl font-black text-white leading-none"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                  {school.school_name}
                </h1>
                <p className="text-white/70 text-lg font-bold mt-1"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                  {school.mascot}
                </p>
              </div>
              <div className="flex-shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl text-white"
                style={{ background: 'rgba(0,0,0,0.3)', fontFamily: 'var(--font-display)', letterSpacing: '0.02em', backdropFilter: 'blur(8px)' }}>
                {school.alias || school.school_name.slice(0, 3).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Sports records grid */}
        {(teams || []).length > 0 && activeSeason && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-black text-white uppercase tracking-widest text-sm"
                style={{ fontFamily: 'var(--font-display)' }}>{activeSeason.name} Teams</h2>
              <div className="flex-1 h-px bg-white/6" />
            </div>
            {SEASON_ORDER.filter(s => sportsBySeason[s]?.length).map(season => (
              <div key={season} className="mb-4">
                {Object.keys(sportsBySeason).length > 1 && (
                  <p className="text-xs text-slate-600 uppercase tracking-widest font-bold mb-2"
                    style={{ fontFamily: 'var(--font-display)' }}>{season}</p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {sportsBySeason[season]?.map(team => {
                    const rec = teamRecords[team.id]
                    const hasRecord = rec && (rec.w + rec.l + rec.t) > 0
                    const sportName = team.sport?.gender && team.sport.gender !== 'Both'
                      ? `${team.sport.gender} ${team.sport.sport_name}`
                      : team.sport?.sport_name || ''
                    const icon = SPORT_ICONS[sportName] || SPORT_ICONS[team.sport?.sport_name || ''] || '🏆'
                    return (
                      <Link key={team.id} href={`/teams/${team.slug}`}
                        className="rounded-xl p-3 border transition-all hover:-translate-y-0.5 hover:shadow-lg group"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-base leading-none">{icon}</span>
                          <span className="text-xs font-black text-slate-400 uppercase truncate"
                            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
                            {team.sport?.sport_name}
                          </span>
                        </div>
                        {hasRecord ? (
                          <div className="flex items-baseline gap-1">
                            <span className="font-black text-white text-xl"
                              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
                              {rec.w}-{rec.l}{rec.t > 0 ? `-${rec.t}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-700" style={{ fontFamily: 'var(--font-display)' }}>
                            No games yet
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recent results by sport */}
          <div className="md:col-span-2 space-y-5">
            {Object.keys(resultsBySport).length > 0 ? (
              Object.entries(resultsBySport).map(([sportName, sportGames]) => {
                const icon = SPORT_ICONS[sportName] || '🏆'
                return (
                  <div key={sportName}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{icon}</span>
                      <span className="font-black text-slate-400 uppercase tracking-widest text-xs"
                        style={{ fontFamily: 'var(--font-display)' }}>{sportName}</span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>
                    <div className="rounded-xl overflow-hidden border border-white/6"
                      style={{ background: 'rgba(8,12,20,0.7)' }}>
                      {sportGames.map((game: any) => {
                        const ht = game.home_team
                        const at = game.away_team
                        const homeName = ht?.school?.school_name || game.external_home?.name || 'TBD'
                        const awayName = at?.school?.school_name || game.external_away?.name || 'TBD'
                        const homeColor = ht?.school?.primary_color || '#334155'
                        const awayColor = at?.school?.primary_color || '#334155'
                        const isSchoolHome = teamIds.includes(ht?.id)
                        const isGolf = game.sport?.sport_name?.toLowerCase().includes('golf')
                        const homeWins = isGolf
                          ? (game.home_score ?? 999) < (game.away_score ?? 999)
                          : (game.home_score ?? 0) > (game.away_score ?? 0)
                        const awayWins = isGolf
                          ? (game.away_score ?? 999) < (game.home_score ?? 999)
                          : (game.away_score ?? 0) > (game.home_score ?? 0)
                        const schoolWon = isSchoolHome ? homeWins : awayWins
                        return (
                          <Link key={game.id} href={`/games/${game.id}`}
                            className="flex items-center px-4 py-2.5 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-b-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0 mr-3"
                              style={{ background: homeWins ? homeColor : awayColor }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-xs text-slate-600 w-6 flex-shrink-0"
                                  style={{ fontFamily: 'var(--font-display)' }}>AWY</span>
                                <span style={{ fontFamily: 'var(--font-display)', fontWeight: awayWins ? 800 : 500, fontSize: '13px', color: awayWins ? '#e2e8f5' : '#6b7a8d' }}>
                                  {awayName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-600 w-6 flex-shrink-0"
                                  style={{ fontFamily: 'var(--font-display)' }}>HME</span>
                                <span style={{ fontFamily: 'var(--font-display)', fontWeight: homeWins ? 800 : 500, fontSize: '13px', color: homeWins ? '#e2e8f5' : '#6b7a8d' }}>
                                  {homeName}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end ml-3 flex-shrink-0">
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: awayWins ? 800 : 500, fontSize: awayWins ? '16px' : '13px', color: awayWins ? '#fff' : '#374151', lineHeight: 1 }}>
                                {game.away_score}
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: homeWins ? 800 : 500, fontSize: homeWins ? '16px' : '13px', color: homeWins ? '#fff' : '#374151', lineHeight: 1, marginTop: '2px' }}>
                                {game.home_score}
                              </span>
                            </div>
                            <div className="ml-2 flex flex-col items-center flex-shrink-0">
                              <span className="text-xs font-black text-emerald-500"
                                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em', fontSize: '10px' }}>F</span>
                              <span className={`text-xs font-black mt-0.5 ${schoolWon ? 'text-green-400' : 'text-red-400'}`}
                                style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.06em' }}>
                                {schoolWon ? 'W' : 'L'}
                              </span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-xl p-8 text-center border border-white/6" style={{ background: 'rgba(8,12,20,0.5)' }}>
                <p className="text-slate-500 text-sm">No results yet this season.</p>
              </div>
            )}

            {/* Photos */}
            {photos && photos.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">📷</span>
                  <span className="font-black text-slate-400 uppercase tracking-widest text-xs"
                    style={{ fontFamily: 'var(--font-display)' }}>Photos</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {photos.slice(0, 6).map(p => (
                    <div key={p.id} className="rounded-xl overflow-hidden aspect-video">
                      <img src={p.photo_url} alt={p.caption || 'Photo'} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Link href="/submit-score"
              className="block rounded-xl p-4 text-center text-white font-black uppercase tracking-widest text-sm"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', boxShadow: '0 4px 20px rgba(37,99,235,0.3)' }}>
              ✏️ Submit a Score
            </Link>

            {sponsor ? (
              <a href={sponsor.website_url || '#'} target="_blank" rel="noopener noreferrer"
                className="block rounded-xl overflow-hidden transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(8,12,24,0.95))', border: '1px solid rgba(37,99,235,0.2)' }}>
                <div className="px-4 py-3">
                  <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1"
                    style={{ fontFamily: 'var(--font-display)' }}>School Sponsor</p>
                  <p className="font-black text-white text-base" style={{ fontFamily: 'var(--font-display)' }}>{sponsor.business_name}</p>
                  {sponsor.tagline && <p className="text-xs text-slate-500 mt-1">{sponsor.tagline}</p>}
                  <p className="text-xs font-bold text-blue-400 mt-2" style={{ fontFamily: 'var(--font-display)' }}>Visit →</p>
                </div>
              </a>
            ) : (
              <Link href="/advertise" className="block rounded-xl p-4 text-center border border-dashed border-white/8">
                <p className="text-xs text-slate-600">Sponsor this school page</p>
                <p className="text-xs text-blue-400 mt-1 font-semibold">Learn more →</p>
              </Link>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
