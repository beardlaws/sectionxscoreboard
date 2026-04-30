'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { format, isToday, isYesterday } from 'date-fns'
import ScoreCard from '@/components/scores/ScoreCard'
import type { Season, School, GameWithTeams } from '@/types'
import { isCloseGame } from '@/lib/constants'
import { Camera, Star, ChevronRight } from 'lucide-react'

function formatTime(t: string) {
  try {
    const [h, m] = t.split(':').map(Number)
    const isPM = h < 8 || h >= 12
    const ampm = isPM ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
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
  featuredPhoto, homepageSponsor, latestShoutout, schools, today,
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

  // Main feed = finals only, newest first. Scheduled games are on team/school pages.
  const finalGamesOnly = useMemo(() =>
    allGames.filter(g => g.status === 'Final'),
    [allGames]
  )

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
      s.school_name.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q) || s.mascot?.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [schoolSearch, schools])

  const todayFinals = todayGames.filter(g => g.status === 'Final')
  const todayLive = todayGames.filter(g => g.status === 'Live')
  const closeCount = allGames.filter(g => isCloseGame(g.home_score, g.away_score) && g.status === 'Final').length

  // Latest finals (most recent 5, excluding featured)
  const latestFinals = finalGamesOnly
    .filter(g => g.id !== featuredGame?.id)
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
                  Latest Results
                </h1>
                <p className="text-slate-500 text-sm mt-1.5">
                  {finalGamesOnly.length > 0
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

          {/* Empty state */}
          {finalGamesOnly.length === 0 && (
            <div className="rounded-2xl p-10 text-center border border-white/6"
              style={{ background: 'rgba(8,12,20,0.7)' }}>
              <p className="text-3xl mb-3">🏆</p>
              <p className="text-slate-300 font-bold text-lg" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                No Final Scores Yet
              </p>
              <p className="text-slate-600 text-sm mt-1">Check back after tonight's games.</p>
            </div>
          )}

          {/* Scores feed — newspaper style grouped by date then sport */}
          {dates.map((date, dateIdx) => {
            const dateGames = byDate.get(date)!
            const sportGroups = groupBySport(dateGames)
            const sportKeys = Array.from(sportGroups.keys()).sort()
            const label = dateLabel(date)
            const isExpanded = dateIdx === 0 || expandedDates.has(date)
            const isToday = dateIdx === 0

            // Today: show featured card + newspaper list
            // Past dates: newspaper list only, collapsible
            return (
              <div key={date} className={dateIdx > 0 ? 'mt-2' : ''}>

                {/* Date header */}
                <button
                  onClick={() => {
                    if (isToday) return
                    setExpandedDates(prev => {
                      const n = new Set(prev)
                      n.has(date) ? n.delete(date) : n.add(date)
                      return n
                    })
                  }}
                  className="w-full flex items-center gap-3 mb-3 group"
                >
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isToday && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      fontSize: isToday ? '22px' : '15px',
                      color: isToday ? '#f0f4ff' : '#4a5f7a',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>
                      {label}
                    </span>
                    <span className="text-xs text-slate-600">
                      {dateGames.filter(g => g.status === 'Final').length > 0
                        ? `${dateGames.filter(g => g.status === 'Final').length} finals`
                        : `${dateGames.length} games`}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-white/5" />
                  {!isToday && (
                    <span className="text-slate-600 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                  )}
                </button>

                {isExpanded && (
                  <div className="rounded-2xl overflow-hidden border border-white/6 mb-6"
                    style={{ background: 'rgba(8,12,20,0.7)' }}>
                    {sportKeys.map((sportKey, sportIdx) => {
                      const games = sportGroups.get(sportKey)!
                      const icon = SPORT_ICONS[sportKey] || '🏆'
                      const finals = games.filter(g => g.status === 'Final')
                      const scheduled = games.filter(g => g.status !== 'Final' && g.status !== 'Canceled')
                      const ppd = games.filter(g => g.status === 'Postponed' || g.status === 'Canceled')

                      return (
                        <div key={sportKey}>
                          {sportIdx > 0 && <div className="mx-4 h-px bg-white/[0.04]" />}

                          {/* Sport label */}
                          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                            <span className="text-sm leading-none">{icon}</span>
                            <span className="font-black text-xs uppercase tracking-widest"
                              style={{ fontFamily: 'var(--font-display)', color: '#4a5f7a', letterSpacing: '0.14em' }}>
                              {sportKey}
                            </span>
                          </div>

                          {/* Final games — newspaper row */}
                          {finals.map(game => {
                            const ht = game.home_team
                            const at = game.away_team
                            const homeName = ht?.school?.school_name || (game as any).external_home?.name || 'TBD'
                            const awayName = at?.school?.school_name || (game as any).external_away?.name || 'TBD'
                            const homeColor = ht?.school?.primary_color || '#334155'
                            const awayColor = at?.school?.primary_color || '#334155'
                            const isGolfGame = game.sport?.sport_name?.toLowerCase().includes('golf')
                            const homeWins = isGolfGame
                              ? (game.home_score ?? 999) < (game.away_score ?? 999)
                              : (game.home_score ?? 0) > (game.away_score ?? 0)
                            const awayWins = isGolfGame
                              ? (game.away_score ?? 999) < (game.home_score ?? 999)
                              : (game.away_score ?? 0) > (game.home_score ?? 0)
                            return (
                              <Link key={game.id} href={`/games/${game.id}`}
                                className="flex items-center px-4 py-2 hover:bg-white/[0.03] transition-colors group">
                                {/* Color dot */}
                                <div className="w-2 h-2 rounded-full flex-shrink-0 mr-3 mt-0.5"
                                  style={{ background: homeWins ? homeColor : awayColor }} />
                                {/* Teams */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-1.5 flex-wrap">
                                    <span style={{
                                      fontFamily: 'var(--font-display)',
                                      fontWeight: awayWins ? 800 : 400,
                                      fontSize: '14px',
                                      color: awayWins ? '#e2e8f5' : '#374151',
                                      letterSpacing: '0.02em',
                                    }}>{awayName}</span>
                                    <span className="text-slate-700 text-xs">at</span>
                                    <span style={{
                                      fontFamily: 'var(--font-display)',
                                      fontWeight: homeWins ? 800 : 400,
                                      fontSize: '14px',
                                      color: homeWins ? '#e2e8f5' : '#374151',
                                      letterSpacing: '0.02em',
                                    }}>{homeName}</span>
                                  </div>
                                </div>
                                {/* Score */}
                                <div className="flex items-baseline gap-1.5 ml-3 flex-shrink-0">
                                  <span style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 700,
                                    fontSize: awayWins ? '16px' : '13px',
                                    color: awayWins ? '#ffffff' : '#374151',
                                  }}>{game.away_score}</span>
                                  <span className="text-slate-700 text-xs">-</span>
                                  <span style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 700,
                                    fontSize: homeWins ? '16px' : '13px',
                                    color: homeWins ? '#ffffff' : '#374151',
                                  }}>{game.home_score}</span>
                                  <span className="text-xs font-bold text-emerald-500 ml-1"
                                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>F</span>
                                </div>
                              </Link>
                            )
                          })}

                          {/* Scheduled/PPD games not shown on homepage - go to team/school pages */}

                          <div className="pb-1" />
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

          {/* Latest Shoutout */}
          {latestShoutout && (
            <div className="rounded-2xl p-4 border border-white/6" style={{ background: 'rgba(10,15,28,0.7)' }}>
              <p className="text-xs font-black text-yellow-500 uppercase tracking-widest mb-2"
                style={{ fontFamily: 'var(--font-display)' }}>🏆 Latest Shoutout</p>
              {latestShoutout.athlete_name && (
                <p className="text-white font-black text-base leading-tight mb-1"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>
                  {latestShoutout.athlete_name}
                </p>
              )}
              <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">{latestShoutout.description}</p>
              <Link href="/shoutout" className="block mt-2 text-xs text-yellow-500 font-bold hover:text-yellow-400 transition-colors"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
                SEND A SHOUTOUT →
              </Link>
            </div>
          )}

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
