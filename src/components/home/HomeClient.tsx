'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, isToday, isYesterday } from 'date-fns'
import ScoreCard from '@/components/scores/ScoreCard'
import type { Season, School, GameWithTeams } from '@/types'
import { isCloseGame } from '@/lib/constants'

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
  if (g === 'Boys' || g === 'Girls') return `${g} ${n}`
  return n
}

const SPORT_ICONS: Record<string, string> = {
  'Baseball': '⚾', 'Softball': '🥎',
  'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
  'Football': '🏈',
  'Boys Basketball': '🏀', 'Girls Basketball': '🏀',
  'Boys Hockey': '🏒', 'Girls Hockey': '🏒',
  'Boys Soccer': '⚽', 'Girls Soccer': '⚽',
  'Volleyball': '🏐',
  'Boys Wrestling': '🤼', 'Girls Wrestling': '🤼',
  'Boys Track': '🏃', 'Girls Track': '🏃',
  'Boys Golf': '⛳', 'Girls Swimming': '🏊',
}

export default function HomeClient({
  activeSeason, todayGames, recentGames, featuredGame,
  featuredPhoto, homepageSponsor, schools, today,
}: HomeClientProps) {
  const [schoolSearch, setSchoolSearch] = useState('')
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  // All games combined, deduplicated, sorted newest first
  const allGames = useMemo(() => {
    const seen = new Set<string>()
    const combined = [...todayGames, ...recentGames].filter(g => {
      if (seen.has(g.id)) return false
      seen.add(g.id)
      return true
    })
    return combined.sort((a, b) => {
      if (b.game_date !== a.game_date) return b.game_date > a.game_date ? 1 : -1
      return 0
    })
  }, [todayGames, recentGames])

  // Group by date
  const byDate = useMemo(() => {
    const map = new Map<string, GameWithTeams[]>()
    for (const g of allGames) {
      const d = g.game_date || today
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(g)
    }
    return map
  }, [allGames, today])

  const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a))

  // Within each date, group by sport
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
    if (!schoolSearch) return []
    const q = schoolSearch.toLowerCase()
    return schools.filter(s =>
      s.school_name.toLowerCase().includes(q) ||
      s.mascot?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [schoolSearch, schools])

  const todayFinals = todayGames.filter(g => g.status === 'Final')
  const todayLive = todayGames.filter(g => g.status === 'Live')
  const closeCount = allGames.filter(g => isCloseGame(g.home_score, g.away_score) && g.status === 'Final').length

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">

      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          {activeSeason && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-2"
              style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
              {activeSeason.name}
            </span>
          )}
          <h1 className="text-3xl md:text-4xl font-bold font-display text-white leading-tight">
            Section X Scores
          </h1>
          <p className="text-slate-400 text-sm mt-1">{format(new Date(today + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {todayLive.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />{todayLive.length} Live
            </span>
          )}
          {closeCount > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-medium text-amber-400 border border-amber-500/20 bg-amber-500/10">
              🔥 {closeCount} close game{closeCount !== 1 ? 's' : ''}
            </span>
          )}
          <Link href="/submit-score" className="btn-primary text-sm">+ Submit Score</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main scores feed */}
        <div className="lg:col-span-2">

          {/* Featured GOTN */}
          {featuredGame && (
            <div className="mb-6">
              <p className="text-xs font-bold text-yellow-400 tracking-widest uppercase mb-2">⭐ Game of the Night</p>
              <ScoreCard game={featuredGame} featured />
            </div>
          )}

          {/* Empty state */}
          {allGames.length === 0 && (
            <div className="rounded-xl p-12 text-center border border-white/8 bg-white/[0.02]">
              <p className="text-4xl mb-3">🏆</p>
              <p className="text-slate-300 font-medium font-display text-lg">No games yet</p>
              <p className="text-slate-500 text-sm mt-1">Import scores from the admin to get started.</p>
            </div>
          )}

          {/* Date sections */}
          {dates.map((date, dateIdx) => {
            const dateGames = byDate.get(date)!
            const sportGroups = groupBySport(dateGames)
            const sportKeys = Array.from(sportGroups.keys()).sort()
            const label = dateLabel(date)
            const isExpanded = dateIdx === 0 || expandedDates.has(date)
            const finalCount = dateGames.filter(g => g.status === 'Final').length

            return (
              <div key={date} className="mb-8">
                {/* Date header */}
                <button
                  onClick={() => {
                    if (dateIdx === 0) return
                    setExpandedDates(prev => {
                      const n = new Set(prev)
                      n.has(date) ? n.delete(date) : n.add(date)
                      return n
                    })
                  }}
                  className="w-full flex items-center gap-3 mb-4 group"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <h2 className={`font-bold font-display ${dateIdx === 0 ? 'text-white text-lg' : 'text-slate-300 text-base'}`}>
                      {label}
                    </h2>
                    <span className="text-xs text-slate-500 font-medium">
                      {finalCount > 0 ? `${finalCount} final${finalCount !== 1 ? 's' : ''}` : `${dateGames.length} game${dateGames.length !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-white/8" />
                  {dateIdx > 0 && (
                    <span className="text-slate-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-5">
                    {sportKeys.map(sportKey => {
                      const games = sportGroups.get(sportKey)!
                      const icon = SPORT_ICONS[sportKey] || '🏆'
                      return (
                        <div key={sportKey}>
                          {/* Sport sub-header */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm">{icon}</span>
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{sportKey}</span>
                            <span className="text-xs text-slate-600">{games.length}</span>
                          </div>
                          <div className="space-y-2 pl-0">
                            {games.map(game => (
                              <ScoreCard key={game.id} game={game} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* School search */}
          <div className="rounded-xl p-4 border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Find a School</p>
            <input
              className="input text-sm w-full"
              placeholder="Search schools..."
              value={schoolSearch}
              onChange={e => setSchoolSearch(e.target.value)}
            />
            {filteredSchools.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {filteredSchools.map(school => (
                  <Link key={school.id} href={`/schools/${school.slug}`}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: school.primary_color || '#1e3a5f' }}>
                      {school.school_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 group-hover:text-white transition-colors truncate">{school.school_name}</p>
                      <p className="text-xs text-slate-500">{school.city}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="rounded-xl p-4 border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Links</p>
            <div className="space-y-0.5">
              {[
                { href: '/scores', label: 'All Scores', icon: '📅' },
                { href: '/standings', label: 'Standings', icon: '📊' },
                { href: '/schools', label: 'All Schools', icon: '🏫' },
                { href: '/photos', label: 'Photo Gallery', icon: '📷' },
                { href: '/submit-score', label: 'Submit a Score', icon: '✏️' },
                { href: '/shoutout', label: 'Send a Shoutout', icon: '🌟' },
              ].map(link => (
                <Link key={link.href} href={link.href}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
                  <span className="text-base w-5 text-center">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Featured photo */}
          {featuredPhoto && (
            <div className="rounded-xl overflow-hidden border border-white/8">
              <img src={featuredPhoto.photo_url} alt={featuredPhoto.caption || 'Section X sports'}
                className="w-full aspect-video object-cover" />
              <div className="p-3 bg-white/[0.02]">
                {featuredPhoto.caption && <p className="text-sm text-slate-300 mb-1">{featuredPhoto.caption}</p>}
                <p className="text-xs text-slate-500">📷 {featuredPhoto.photographer_credit_name}</p>
              </div>
            </div>
          )}

          {/* Sponsor */}
          {homepageSponsor ? (
            <a href={homepageSponsor.website_url || '#'} target="_blank" rel="noopener noreferrer"
              className="block rounded-xl p-4 border border-white/8 hover:border-white/16 transition-colors" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-xs text-slate-500 mb-1">Sponsored By</p>
              <p className="text-white font-semibold">{homepageSponsor.business_name}</p>
              {homepageSponsor.tagline && <p className="text-xs text-slate-400 mt-1">{homepageSponsor.tagline}</p>}
            </a>
          ) : (
            <Link href="/advertise"
              className="block rounded-xl p-4 border border-dashed border-white/10 hover:border-white/20 transition-colors text-center">
              <p className="text-xs text-slate-500 mb-1">Your Ad Here</p>
              <p className="text-sm text-slate-400">Reach North Country sports families</p>
              <p className="text-xs text-ice mt-1">Advertise on Section X Scoreboard →</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
