'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, isToday, isYesterday } from 'date-fns'
import ScoreCard from '@/components/scores/ScoreCard'
import type { Season, School, GameWithTeams } from '@/types'
import { isCloseGame } from '@/lib/constants'
import HomeSponsorWrapper from '@/components/HomeSponsorWrapper'
import { createClient } from '@/lib/supabase/client'

function formatTime(t: string) {
  try {
    const [h, m] = t.split(':').map(Number)
    const isPM = h < 8 || h >= 12
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`
  } catch { return t }
}

interface HomeClientProps {
  activeSeason: Season | null
  todayGames: GameWithTeams[]
  recentGames: GameWithTeams[]
  featuredGame: GameWithTeams | null
  featuredPhoto: any | null
  allStandingsGames: any[]
  homepageSponsor: any | null
  schools: School[]
  today: string
  latestShoutout?: any | null
  featuredSpotlight?: any | null
  featuredAthlete?: any | null
  springGames?: GameWithTeams[]
  allSpotlights?: any[]
}

const SPORT_ICONS: Record<string, string> = {
  'Baseball': '⚾', 'Softball': '🥎', 'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
  'Football': '🏈', 'Boys Basketball': '🏀', 'Girls Basketball': '🏀',
  'Boys Hockey': '🏒', 'Girls Hockey': '🏒', 'Boys Soccer': '⚽', 'Girls Soccer': '⚽',
  'Volleyball': '🏐', 'Boys Golf': '⛳', 'Girls Swimming': '🏊',
  'Boys Wrestling': '🤼', 'Girls Wrestling': '🤼',
  'Boys Track': '🏃', 'Girls Track': '🏃',
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, MMMM d')
}

function getSportKey(game: GameWithTeams): string {
  const g = game.sport?.gender
  const n = game.sport?.sport_name || 'Other'
  return (g === 'Boys' || g === 'Girls') ? `${g} ${n}` : n
}

function TeamDot({ color, logo }: { color: string; logo?: string | null }) {
  if (logo) {
    return (
      <div className="w-4 h-4 rounded flex-shrink-0 overflow-hidden border border-white/10" style={{ background: color }}>
        <img src={logo} alt="" className="w-full h-full object-contain" />
      </div>
    )
  }
  return <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
}

function ScoreAlertForm() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function subscribe() {
    if (!email.includes('@')) return
    setLoading(true)
    await supabase.from('score_alert_subscriptions').insert({
      email: email.toLowerCase().trim(),
      school_id: null,
      all_section_x: true,
      confirmed: true,
    })
    setDone(true)
    setLoading(false)
  }

  if (done) return (
    <p className="text-xs text-green-400 font-bold" style={{ fontFamily: 'var(--font-display)' }}>✓ You're signed up!</p>
  )

  return (
    <div className="flex gap-1.5 mt-2">
      <input type="email" value={email} placeholder="your@email.com"
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && subscribe()}
        className="input flex-1 text-xs py-1.5" />
      <button onClick={subscribe} disabled={loading}
        className="text-xs px-3 py-1.5 rounded-lg font-black flex-shrink-0"
        style={{ background: 'rgba(37,99,235,0.3)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.4)', fontFamily: 'var(--font-display)' }}>
        {loading ? '...' : 'GO'}
      </button>
    </div>
  )
}

function OffSeasonState({ activeSeason, allSpotlights, springGames }: {
  activeSeason: Season | null
  allSpotlights: any[]
  springGames: GameWithTeams[]
}) {
  const isFallSeason = activeSeason?.name?.includes('Fall')
  const isWinterSeason = activeSeason?.name?.includes('Winter')

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 border border-white/8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(8,12,20,0.95) 60%)' }}>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-blue-400 uppercase tracking-widest"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.12em' }}>
              {activeSeason?.name || 'Upcoming Season'}
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
            {isFallSeason ? '🏈 Fall Sports Are Coming' : isWinterSeason ? '🏀 Winter Sports Are Coming' : '⚾ Season Preview'}
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            {isFallSeason
              ? 'Football, Soccer, and Volleyball kick off in August. Follow your favorite Section X teams all season long.'
              : isWinterSeason
              ? 'Basketball, Hockey, and Wrestling tip off in December.'
              : 'The season is coming. Follow your favorite Section X teams right here.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {isFallSeason && (
              <>
                <Link href="/sports/football" className="text-xs font-black px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', fontFamily: 'var(--font-display)' }}>🏈 Football</Link>
                <Link href="/sports/boys-soccer" className="text-xs font-black px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)', fontFamily: 'var(--font-display)' }}>⚽ Boys Soccer</Link>
                <Link href="/sports/girls-soccer" className="text-xs font-black px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)', fontFamily: 'var(--font-display)' }}>⚽ Girls Soccer</Link>
                <Link href="/sports/volleyball" className="text-xs font-black px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)', fontFamily: 'var(--font-display)' }}>🏐 Volleyball</Link>
              </>
            )}
            {isWinterSeason && (
              <>
                <Link href="/sports/boys-basketball" className="text-xs font-black px-3 py-1.5 rounded-lg" style={{ background: 'rgba(234,88,12,0.15)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.25)', fontFamily: 'var(--font-display)' }}>🏀 Boys Basketball</Link>
                <Link href="/sports/girls-basketball" className="text-xs font-black px-3 py-1.5 rounded-lg" style={{ background: 'rgba(219,39,119,0.15)', color: '#f472b6', border: '1px solid rgba(219,39,119,0.25)', fontFamily: 'var(--font-display)' }}>🏀 Girls Basketball</Link>
              </>
            )}
          </div>
        </div>
      </div>

      {springGames && springGames.length > 0 && (
        <div className="rounded-2xl p-4 border border-white/6" style={{ background: 'rgba(8,12,20,0.7)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>📋 Spring 2026 Results</p>
            <Link href="/scores?season=a1000000-0000-0000-0000-000000000001" className="text-xs text-blue-400 font-bold hover:text-blue-300 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>View All →</Link>
          </div>
          <div className="space-y-1">
            {springGames.slice(0, 5).map((game: any) => {
              const homeName = game.home_team?.school?.school_name || game.external_home?.name || 'TBD'
              const awayName = game.away_team?.school?.school_name || game.external_away?.name || 'TBD'
              const homeWins = (game.home_score ?? 0) > (game.away_score ?? 0)
              const awayWins = (game.away_score ?? 0) > (game.home_score ?? 0)
              return (
                <Link key={game.id} href={`/games/${game.id}`} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                  <span className="text-xs" style={{ fontFamily: 'var(--font-display)', color: '#4a5f7a' }}>{game.sport?.sport_name}</span>
                  <span className="flex-1 text-xs text-slate-300 truncate">
                    <span style={{ fontWeight: awayWins ? 700 : 400 }}>{awayName}</span>
                    <span className="text-slate-600 mx-1">at</span>
                    <span style={{ fontWeight: homeWins ? 700 : 400 }}>{homeName}</span>
                  </span>
                  <span className="text-xs font-mono text-white flex-shrink-0">{game.away_score}–{game.home_score}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {allSpotlights && allSpotlights.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>📰 Latest Stories</p>
            <Link href="/spotlight" className="text-xs text-blue-400 font-bold hover:text-blue-300 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>All Stories →</Link>
          </div>
          <div className="space-y-2">
            {allSpotlights.map((story: any) => (
              <Link key={story.id} href={`/spotlight/${story.id}`}
                className="block rounded-xl p-4 border border-white/6 hover:border-white/12 transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(8,12,20,0.7)' }}>
                <p className="font-black text-white text-sm mb-1" style={{ fontFamily: 'var(--font-display)' }}>{story.title}</p>
                <p className="text-xs text-slate-500 line-clamp-2">{story.body}</p>
                <p className="text-xs text-slate-600 mt-1">{format(new Date(story.created_at), 'MMMM d, yyyy')}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl p-5 border border-white/6 text-center" style={{ background: 'rgba(8,12,20,0.5)' }}>
        <p className="text-slate-400 text-sm mb-3">Browse all 24 Section X schools and their teams</p>
        <Link href="/schools" className="btn-primary inline-flex">View All Schools →</Link>
      </div>
    </div>
  )
}

export default function HomeClient({
  activeSeason, todayGames, recentGames, featuredGame,
  featuredPhoto, homepageSponsor, latestShoutout, schools, today,
  featuredSpotlight, featuredAthlete, springGames = [], allSpotlights = [],
}: HomeClientProps) {
  const [schoolSearch, setSchoolSearch] = useState('')
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [compact, setCompact] = useState(false)

  const allGames = useMemo(() => {
    const seen = new Set<string>()
    return [...todayGames, ...recentGames].filter(g => {
      if (seen.has(g.id)) return false
      seen.add(g.id); return true
    }).sort((a, b) => b.game_date > a.game_date ? 1 : b.game_date < a.game_date ? -1 : 0)
  }, [todayGames, recentGames])

  const finalGamesOnly = useMemo(() => allGames.filter(g => g.status === 'Final'), [allGames])

  const byDate = useMemo(() => {
    const map = new Map<string, GameWithTeams[]>()
    for (const g of finalGamesOnly) {
      const d = g.game_date || today
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(g)
    }
    return map
  }, [finalGamesOnly, today])

  const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a))

  function groupBySport(games: GameWithTeams[]) {
    const map = new Map<string, GameWithTeams[]>()
    for (const g of games) {
      const key = getSportKey(g)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(g)
    }
    return map
  }

  const filteredSchools = useMemo(() => {
    if (!schoolSearch || schoolSearch.length < 2) return []
    const q = schoolSearch.toLowerCase()
    return schools.filter(s =>
      s.school_name.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.mascot?.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [schoolSearch, schools])

  const todayLive = todayGames.filter(g => g.status === 'Live')
  const closeCount = allGames.filter(g => isCloseGame(g.home_score, g.away_score) && g.status === 'Final').length
  const isOffSeason = finalGamesOnly.length === 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── MAIN COLUMN ── */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            {activeSeason && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold mb-2 uppercase tracking-widest"
                style={{ background: 'rgba(37,99,235,0.15)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.25)', fontFamily: 'var(--font-display)' }}>
                {activeSeason.name}
              </span>
            )}
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-4xl md:text-5xl font-black text-white leading-none tracking-tight"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                  {isOffSeason ? 'Section X Sports' : 'Latest Results'}
                </h1>
                <p className="text-slate-500 text-sm mt-1.5">
                  {isOffSeason
                    ? `${activeSeason?.name || ''} · Season preview`
                    : finalGamesOnly.length > 0
                    ? `${finalGamesOnly.length} final score${finalGamesOnly.length !== 1 ? 's' : ''} · ${format(new Date(today + 'T12:00:00'), 'MMMM d, yyyy')}`
                    : format(new Date(today + 'T12:00:00'), 'EEEE, MMMM d, yyyy')
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {todayLive.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />{todayLive.length} Live
                  </span>
                )}
                {closeCount > 0 && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold text-amber-300 border border-amber-500/30 bg-amber-500/12">
                    🔥 {closeCount} close
                  </span>
                )}
              </div>
            </div>
          </div>

          {featuredGame && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-yellow-400 text-sm">⭐</span>
                <span className="text-xs font-black text-yellow-400 tracking-widest uppercase" style={{ fontFamily: 'var(--font-display)' }}>Game of the Night</span>
                {homepageSponsor && <span className="text-xs text-slate-500">· Presented by {homepageSponsor.business_name}</span>}
              </div>
              <ScoreCard game={featuredGame} featured />
            </div>
          )}

          {isOffSeason ? (
            <OffSeasonState activeSeason={activeSeason} allSpotlights={allSpotlights} springGames={springGames as GameWithTeams[]} />
          ) : (
            dates.map((date, dateIdx) => {
              const dateGames = byDate.get(date)!
              const sportGroups = groupBySport(dateGames)
              const sportKeys = Array.from(sportGroups.keys()).sort()
              const label = dateLabel(date)
              const isExpanded = dateIdx === 0 || expandedDates.has(date)
              const isTodayDate = dateIdx === 0

              return (
                <div key={date} className={dateIdx > 0 ? 'mt-2' : ''}>
                  <button
                    onClick={() => {
                      if (isTodayDate) return
                      setExpandedDates(prev => {
                        const n = new Set(prev)
                        n.has(date) ? n.delete(date) : n.add(date)
                        return n
                      })
                    }}
                    className="w-full flex items-center gap-3 mb-3 group">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isTodayDate && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: isTodayDate ? '22px' : '15px', color: isTodayDate ? '#f0f4ff' : '#4a5f7a', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
                      <span className="text-xs text-slate-600">{dateGames.filter(g => g.status === 'Final').length} finals</span>
                    </div>
                    <div className="flex-1 h-px bg-white/5" />
                    {isTodayDate && (
                      <button onClick={e => { e.stopPropagation(); setCompact(c => !c) }}
                        className="text-xs px-2 py-0.5 rounded flex-shrink-0 transition-colors"
                        style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em', background: compact ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)', color: compact ? '#60a5fa' : '#4a5f7a', border: `1px solid ${compact ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                        {compact ? 'STANDARD' : 'COMPACT'}
                      </button>
                    )}
                    {!isTodayDate && <span className="text-slate-600 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>}
                  </button>

                  {isExpanded && (
                    <div className="rounded-2xl overflow-hidden border border-white/6 mb-6" style={{ background: 'rgba(8,12,20,0.7)' }}>
                      {sportKeys.map((sportKey, sportIdx) => {
                        const games = sportGroups.get(sportKey)!
                        const icon = SPORT_ICONS[sportKey] || '🏆'
                        const finals = games.filter(g => g.status === 'Final')
                        return (
                          <div key={sportKey}>
                            {sportIdx > 0 && <div className="mx-4 h-px bg-white/[0.04]" />}
                            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                              <span className="text-sm leading-none">{icon}</span>
                              <span className="font-black text-xs uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', color: '#4a5f7a', letterSpacing: '0.14em' }}>{sportKey}</span>
                            </div>
                            {finals.map(game => {
                              const ht = game.home_team
                              const at = game.away_team
                              const homeName = ht?.school?.school_name || (game as any).external_home?.name || 'TBD'
                              const awayName = at?.school?.school_name || (game as any).external_away?.name || 'TBD'
                              const homeColor = ht?.school?.primary_color || '#334155'
                              const awayColor = at?.school?.primary_color || '#334155'
                              const homeLogo = (ht?.school as any)?.logo_url || null
                              const awayLogo = (at?.school as any)?.logo_url || null
                              const hasRecap = !!(game as any).recap
                              const isGolfGame = game.sport?.sport_name?.toLowerCase().includes('golf')
                              const homeWins = isGolfGame ? (game.home_score ?? 999) < (game.away_score ?? 999) : (game.home_score ?? 0) > (game.away_score ?? 0)
                              const awayWins = isGolfGame ? (game.away_score ?? 999) < (game.home_score ?? 999) : (game.away_score ?? 0) > (game.home_score ?? 0)
                              const diff = Math.abs((game.home_score ?? 0) - (game.away_score ?? 0))
                              const isClose = diff <= 2
                              const isBlowout = diff >= 15
                              const winnerColor = homeWins ? homeColor : awayColor

                              if (compact) {
                                return (
                                  <Link key={game.id} href={`/games/${game.id}`} className="flex items-center px-4 py-1.5 hover:bg-white/[0.03] transition-colors">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-3" style={{ background: winnerColor }} />
                                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: awayWins ? 700 : 400, fontSize: '13px', color: awayWins ? '#d1d9e8' : '#4a5568' }}>{awayName}</span>
                                      <span style={{ color: '#2d3748', fontSize: '11px' }}>at</span>
                                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: homeWins ? 700 : 400, fontSize: '13px', color: homeWins ? '#d1d9e8' : '#4a5568' }}>{homeName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                      {hasRecap && <span className="text-xs text-blue-400">📝</span>}
                                      {isClose && <span className="text-xs text-amber-400">🔥</span>}
                                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px', color: '#ffffff' }}>
                                        {awayWins ? game.away_score : game.home_score}<span style={{ color: '#374151', fontWeight: 400 }}>–</span>{awayWins ? game.home_score : game.away_score}
                                      </span>
                                      <span className="text-xs font-bold text-emerald-500" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>F</span>
                                    </div>
                                  </Link>
                                )
                              }

                              return (
                                <Link key={game.id} href={`/games/${game.id}`}
                                  className="flex items-center px-4 py-2.5 hover:bg-white/[0.025] transition-colors group border-l-2 border-transparent"
                                  onMouseEnter={e => (e.currentTarget.style.borderLeftColor = winnerColor + '60')}
                                  onMouseLeave={e => (e.currentTarget.style.borderLeftColor = 'transparent')}>
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mr-3 mt-0.5" style={{ background: winnerColor, boxShadow: `0 0 6px ${winnerColor}80` }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="text-xs text-slate-700 w-6 flex-shrink-0" style={{ fontFamily: 'var(--font-display)' }}>AWY</span>
                                      <TeamDot color={awayColor} logo={awayLogo} />
                                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: awayWins ? 800 : 500, fontSize: awayWins ? '15px' : '14px', color: awayWins ? '#e8edf5' : '#8a9ab0' }}>{awayName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-slate-700 w-6 flex-shrink-0" style={{ fontFamily: 'var(--font-display)' }}>HME</span>
                                      <TeamDot color={homeColor} logo={homeLogo} />
                                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: homeWins ? 800 : 500, fontSize: homeWins ? '15px' : '14px', color: homeWins ? '#e8edf5' : '#8a9ab0' }}>{homeName}</span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end ml-4 flex-shrink-0 gap-0.5">
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: awayWins ? 800 : 500, fontSize: awayWins ? '20px' : '15px', color: awayWins ? '#ffffff' : '#52647a', lineHeight: 1 }}>{game.away_score}</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: homeWins ? 800 : 500, fontSize: homeWins ? '20px' : '15px', color: homeWins ? '#ffffff' : '#52647a', lineHeight: 1 }}>{game.home_score}</span>
                                  </div>
                                  <div className="flex flex-col items-center ml-2 flex-shrink-0 gap-1">
                                    <span className="text-xs font-bold text-emerald-500" style={{ fontFamily: 'var(--font-display)', fontSize: '10px' }}>F</span>
                                    {hasRecap && <span className="text-xs leading-none">📝</span>}
                                    {isClose && <span className="text-xs leading-none">🔥</span>}
                                    {isBlowout && <span className="text-xs leading-none opacity-40">💨</span>}
                                  </div>
                                </Link>
                              )
                            })}
                            <div className="pb-1" />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ── SIDEBAR ── */}
        <div className="space-y-4">

          {/* School search */}
          <div className="rounded-2xl p-4 border border-white/6" style={{ background: 'rgba(10,15,28,0.7)' }}>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-display)' }}>Find a School</p>
            <input className="input text-sm w-full" placeholder="Search schools..."
              value={schoolSearch} onChange={e => setSchoolSearch(e.target.value)} />
            {filteredSchools.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {filteredSchools.map(school => (
                  <Link key={school.id} href={`/schools/${school.slug}`}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
                    onClick={() => setSchoolSearch('')}>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: school.primary_color || '#1e3a5f' }}>
                      {(school as any).logo_url
                        ? <img src={(school as any).logo_url} alt="" className="w-full h-full object-contain" />
                        : <span className="text-white text-xs font-black" style={{ fontFamily: 'var(--font-display)' }}>{school.school_name[0]}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 group-hover:text-white transition-colors truncate">{school.school_name}</p>
                      <p className="text-xs text-slate-600">{school.city}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl p-4 border border-white/6" style={{ background: 'rgba(10,15,28,0.7)' }}>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-display)' }}>Quick Actions</p>
            <div className="space-y-1">
              {[
                { href: '/submit-score', label: 'Submit a Score', icon: '✏️', accent: true },
                { href: '/submit-photo', label: 'Submit a Photo', icon: '📷', accent: false },
                { href: '/shoutout', label: 'Send a Shoutout', icon: '🌟', accent: false },
                { href: '/nominate', label: 'Nominate an Athlete', icon: '🏅', accent: false },
              ].map(link => (
                <Link key={link.href} href={link.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${link.accent ? 'text-white hover:brightness-110' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                  style={link.accent ? { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' } : {}}>
                  <span className="text-base">{link.icon}</span> {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Score Alerts */}
          <div className="rounded-2xl p-4 border border-white/6" style={{ background: 'rgba(10,15,28,0.7)' }}>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-display)' }}>🔔 Score Alerts</p>
            <p className="text-xs text-slate-500 mb-1">Get notified when Section X scores are posted.</p>
            <ScoreAlertForm />
          </div>

          {/* Athlete of Week */}
          {featuredAthlete && (
            <div className="rounded-2xl overflow-hidden border border-yellow-400/20" style={{ background: 'rgba(251,191,36,0.04)' }}>
              <div className="px-4 py-3 border-b border-yellow-400/10 flex items-center gap-2">
                <span className="text-base">🏅</span>
                <p className="text-xs font-black text-yellow-400 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>Athlete of the Week</p>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  {featuredAthlete.photo_url ? (
                    <img src={featuredAthlete.photo_url} alt={featuredAthlete.athlete_name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-white/10" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10" style={{ background: featuredAthlete.school?.primary_color || '#1e3a5f' }}>
                      {featuredAthlete.school?.logo_url
                        ? <img src={featuredAthlete.school.logo_url} alt="" className="w-full h-full object-contain p-1.5" />
                        : <span className="text-white font-black text-lg" style={{ fontFamily: 'var(--font-display)' }}>{featuredAthlete.athlete_name[0]}</span>
                      }
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-black text-white text-base leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{featuredAthlete.athlete_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{[featuredAthlete.grade, featuredAthlete.sport_name, featuredAthlete.school?.school_name].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                {featuredAthlete.stats && (
                  <div className="rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
                    <p className="text-xs font-black text-yellow-400" style={{ fontFamily: 'var(--font-display)' }}>{featuredAthlete.stats}</p>
                  </div>
                )}
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{featuredAthlete.body}</p>
                <Link href="/nominate" className="block text-center mt-3 text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-colors" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>NOMINATE AN ATHLETE →</Link>
              </div>
            </div>
          )}

          {/* Latest Shoutout */}
          {latestShoutout && (
            <div className="rounded-2xl p-4 border border-white/6" style={{ background: 'rgba(10,15,28,0.7)' }}>
              <p className="text-xs font-black text-yellow-500 uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)' }}>🏆 Latest Shoutout</p>
              {latestShoutout.athlete_name && <p className="text-white font-black text-base leading-tight mb-1" style={{ fontFamily: 'var(--font-display)' }}>{latestShoutout.athlete_name}</p>}
              <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">{latestShoutout.description}</p>
              <Link href="/shoutout" className="block mt-2 text-xs text-yellow-500 font-bold hover:text-yellow-400 transition-colors" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>SEND A SHOUTOUT →</Link>
            </div>
          )}

          {/* Explore */}
          <div className="rounded-2xl p-4 border border-white/6" style={{ background: 'rgba(10,15,28,0.7)' }}>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-display)' }}>Explore</p>
            <div className="space-y-0.5">
              {[
                { href: '/scores', label: 'All Scores', icon: '📅' },
                { href: '/standings', label: 'Standings', icon: '📊' },
                { href: '/playoffs', label: 'Playoffs', icon: '🏆' },
                { href: '/spotlight', label: 'Spotlight', icon: '📰' },
                { href: '/schools', label: 'All Schools', icon: '🏫' },
                { href: '/photos', label: 'Photo Gallery', icon: '📷' },
              ].map(link => (
                <Link key={link.href} href={link.href}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/4 transition-colors">
                  <span className="w-5 text-center">{link.icon}</span> {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Featured photo */}
          {featuredPhoto && (
            <div className="rounded-2xl overflow-hidden border border-white/6">
              <div className="relative">
                <img src={featuredPhoto.photo_url} alt={featuredPhoto.caption || 'Section X sports'} className="w-full aspect-video object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-display)' }}>Photo of the Week</p>
                  {featuredPhoto.caption && <p className="text-sm text-white font-semibold">{featuredPhoto.caption}</p>}
                  <p className="text-xs text-white/50 mt-0.5">📷 {featuredPhoto.photographer_credit_name || featuredPhoto.submitter_name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sponsor — now tracked via HomeSponsorWrapper */}
          {homepageSponsor ? (
            <HomeSponsorWrapper sponsor={homepageSponsor} />
          ) : (
            <Link href="/advertise" className="block rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(8,12,24,0.8))', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-black uppercase tracking-widest text-slate-600" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.14em' }}>Sponsor This Section</p>
              </div>
              <div className="px-4 py-4">
                <p className="font-black text-slate-400 text-lg mb-1" style={{ fontFamily: 'var(--font-display)' }}>Your Business Here</p>
                <p className="text-slate-600 text-xs mb-3">Reach thousands of North Country sports families every night.</p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold text-blue-400" style={{ fontFamily: 'var(--font-display)', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}>LEARN MORE →</div>
              </div>
            </Link>
          )}

          {/* Spotlight */}
          {featuredSpotlight ? (
            <Link href={`/spotlight/${featuredSpotlight.id}`}
              className="block rounded-2xl p-4 border border-white/8 transition-all hover:-translate-y-0.5 group"
              style={{ background: 'rgba(10,15,28,0.7)' }}>
              <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>📰 Section X Spotlight</p>
              <p className="text-white font-black text-sm leading-tight mb-2 group-hover:text-blue-300 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>{featuredSpotlight.title}</p>
              <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">{featuredSpotlight.body}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-600">by {featuredSpotlight.author}</p>
                <p className="text-xs font-bold text-blue-400 group-hover:text-blue-300" style={{ fontFamily: 'var(--font-display)' }}>Read →</p>
              </div>
            </Link>
          ) : (
            <div className="rounded-2xl p-4 border border-white/4" style={{ background: 'rgba(10,15,28,0.4)' }}>
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)' }}>Section X Spotlight</p>
              <p className="text-xs text-slate-600">Coming soon: interviews, athlete stories, and weekly Section X sports recaps.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
