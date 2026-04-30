'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { format, isToday, isYesterday } from 'date-fns'
import ScoreCard from '@/components/scores/ScoreCard'
import type { Season, School, GameWithTeams } from '@/types'
import { isCloseGame } from '@/lib/constants'
import { Camera, Star, ChevronRight } from 'lucide-react'

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

export default function HomeClient({
  activeSeason, todayGames, recentGames, featuredGame,
  featuredPhoto, homepageSponsor, schools, today,
}: HomeClientProps) {
  const [schoolSearch, setSchoolSearch] = useState('')
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const allGames = useMemo(() => {
    const seen = new Set<string>()
    return [...todayGames, ...recentGames].filter(g => {
      if (seen.has(g.id)) return false
      seen.add(g.id); return true
    }).sort((a, b) => b.game_date > a.game_date ? 1 : b.game_date < a.game_date ? -1 : 0)
  }, [todayGames, recentGames])

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
      s.school_name.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q) || s.mascot?.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [schoolSearch, schools])

  const todayFinals = todayGames.filter(g => g.status === 'Final')
  const todayLive = todayGames.filter(g => g.status === 'Live')
  const closeCount = allGames.filter(g => isCloseGame(g.home_score, g.away_score) && g.status === 'Final').length

  // Latest finals (most recent 5, excluding featured)
  const latestFinals = allGames
    .filter(g => g.status === 'Final' && g.id !== featuredGame?.id)
    .slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── MAIN COLUMN ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Hero header */}
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
                  Section X Scores
                </h1>
                <p className="text-slate-500 text-sm mt-1.5">{format(new Date(today + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}</p>
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

          {/* Game of the Night */}
          {featuredGame && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-yellow-400 text-sm">⭐</span>
                <span className="text-xs font-black text-yellow-400 tracking-widest uppercase"
                  style={{ fontFamily: 'var(--font-display)' }}>Game of the Night</span>
                {homepageSponsor && (
                  <span className="text-xs text-slate-500">· Presented by {homepageSponsor.business_name}</span>
                )}
              </div>
              <ScoreCard game={featuredGame} featured />
            </div>
          )}

          {/* Latest Finals strip */}
          {latestFinals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-black text-slate-400 tracking-widest uppercase"
                  style={{ fontFamily: 'var(--font-display)' }}>Latest Finals</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {latestFinals.map(game => (
                  <ScoreCard key={game.id} game={game} compact />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {allGames.length === 0 && (
            <div className="rounded-2xl p-12 text-center border border-white/6"
              style={{ background: 'rgba(10,15,28,0.6)' }}>
              <p className="text-4xl mb-3">🏆</p>
              <p className="text-slate-300 font-bold text-xl" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                No Games Yet
              </p>
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
            const scheduledCount = dateGames.filter(g => g.status === 'Scheduled').length

            // Skip "Latest Finals" games from the main list if they're in today's section
            // to avoid duplication — show them only in Latest Finals strip
            const isLatestFinalsDate = dateIdx === 0

            return (
              <div key={date}>
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
                  <div className="flex items-center gap-2">
                    {dateIdx === 0 && (
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                    )}
                    <h2 className="font-black" style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: dateIdx === 0 ? '20px' : '16px',
                      color: dateIdx === 0 ? '#f0f4ff' : '#7a90b8',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      {label}
                    </h2>
                    <span className="text-xs text-slate-600 font-medium">
                      {finalCount > 0 && `${finalCount} final${finalCount !== 1 ? 's' : ''}`}
                      {finalCount > 0 && scheduledCount > 0 && ' · '}
                      {scheduledCount > 0 && `${scheduledCount} scheduled`}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-white/5" />
                  {dateIdx > 0 && (
                    <span className="text-slate-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-6">
                    {sportKeys.map(sportKey => {
                      const games = sportGroups.get(sportKey)!
                      const icon = SPORT_ICONS[sportKey] || '🏆'
                      const finals = games.filter(g => g.status === 'Final')
                      const scheduled = games.filter(g => g.status !== 'Final' && g.status !== 'Canceled')

                      return (
                        <div key={sportKey}>
                          {/* Sport header */}
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="text-base">{icon}</span>
                            <span className="font-black text-slate-300 uppercase tracking-widest text-xs"
                              style={{ fontFamily: 'var(--font-display)' }}>
                              {sportKey}
                            </span>
                            <span className="text-xs text-slate-600">{games.length}</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-white/8 to-transparent" />
                          </div>

                          {/* Finals first */}
                          {finals.length > 0 && (
                            <div className="space-y-2 mb-2">
                              {finals.map(game => <ScoreCard key={game.id} game={game} />)}
                            </div>
                          )}

                          {/* Then scheduled */}
                          {scheduled.length > 0 && (
                            <div className="space-y-2">
                              {scheduled.map(game => <ScoreCard key={game.id} game={game} />)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── SIDEBAR ── */}
        <div className="space-y-4">

          {/* School search */}
          <div className="rounded-2xl p-4 border border-white/6" style={{ background: 'rgba(10,15,28,0.7)' }}>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
              style={{ fontFamily: 'var(--font-display)' }}>Find a School</p>
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
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
                    onClick={() => setSchoolSearch('')}>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                      style={{ background: school.primary_color || '#1e3a5f', fontFamily: 'var(--font-display)' }}>
                      {school.school_name[0]}
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
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
              style={{ fontFamily: 'var(--font-display)' }}>Quick Actions</p>
            <div className="space-y-1">
              {[
                { href: '/submit-score', label: 'Submit a Score', icon: '✏️', accent: true },
                { href: '/submit-photo', label: 'Submit a Photo', icon: '📷', accent: false },
                { href: '/shoutout', label: 'Send a Shoutout', icon: '🌟', accent: false },
              ].map(link => (
                <Link key={link.href} href={link.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                    link.accent ? 'text-white hover:brightness-110' : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                  style={link.accent ? { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' } : {}}>
                  <span className="text-base">{link.icon}</span> {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="rounded-2xl p-4 border border-white/6" style={{ background: 'rgba(10,15,28,0.7)' }}>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
              style={{ fontFamily: 'var(--font-display)' }}>Explore</p>
            <div className="space-y-0.5">
              {[
                { href: '/scores', label: 'All Scores', icon: '📅' },
                { href: '/standings', label: 'Standings', icon: '📊' },
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
                <img src={featuredPhoto.photo_url} alt={featuredPhoto.caption || 'Section X sports'}
                  className="w-full aspect-video object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1"
                    style={{ fontFamily: 'var(--font-display)' }}>Photo of the Week</p>
                  {featuredPhoto.caption && <p className="text-sm text-white font-semibold">{featuredPhoto.caption}</p>}
                  <p className="text-xs text-white/50 mt-0.5">📷 {featuredPhoto.photographer_credit_name || featuredPhoto.submitter_name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sponsor */}
          {homepageSponsor ? (
            <a href={homepageSponsor.website_url || '#'} target="_blank" rel="noopener noreferrer"
              className="block rounded-2xl p-4 border border-white/8 hover:border-white/14 transition-all group"
              style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(10,15,28,0.9))' }}>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1"
                style={{ fontFamily: 'var(--font-display)' }}>Tonight's Scores Presented By</p>
              <p className="text-white font-black text-lg" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                {homepageSponsor.business_name}
              </p>
              {homepageSponsor.tagline && <p className="text-xs text-slate-400 mt-1">{homepageSponsor.tagline}</p>}
              <div className="mt-3 flex items-center gap-1 text-xs font-bold text-blue-400 group-hover:gap-2 transition-all"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
                VISIT SPONSOR <ChevronRight size={12} />
              </div>
            </a>
          ) : (
            <Link href="/advertise"
              className="block rounded-2xl p-4 border border-dashed border-white/8 hover:border-white/16 transition-colors text-center">
              <Camera size={20} className="mx-auto mb-2 text-slate-600" />
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-display)' }}>Your Ad Here</p>
              <p className="text-xs text-slate-600 mt-1">Reach North Country sports families</p>
              <p className="text-xs text-blue-400 mt-2 font-semibold">Advertise →</p>
            </Link>
          )}

          {/* Coming soon content block */}
          <div className="rounded-2xl p-4 border border-white/4"
            style={{ background: 'rgba(10,15,28,0.4)' }}>
            <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2"
              style={{ fontFamily: 'var(--font-display)' }}>Section X Spotlight</p>
            <p className="text-xs text-slate-600">Coming soon: interviews, athlete stories, and weekly Section X sports recaps.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
