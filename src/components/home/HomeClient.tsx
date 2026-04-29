// src/components/home/HomeClient.tsx
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import ScoreCard from '@/components/scores/ScoreCard'
import type { Game, Season, School, GameWithTeams } from '@/types'
import { HOMEPAGE_SPORTS, isCloseGame, calculateStandings } from '@/lib/constants'
import { calculateStandings as calcStandings } from '@/lib/standings'

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

export default function HomeClient({
  activeSeason,
  todayGames,
  recentGames,
  featuredGame,
  featuredPhoto,
  allStandingsGames,
  homepageSponsor,
  schools,
  today,
}: HomeClientProps) {
  const seasonType = activeSeason?.season_type || 'Spring'
  const homeSports = HOMEPAGE_SPORTS[seasonType as keyof typeof HOMEPAGE_SPORTS] || HOMEPAGE_SPORTS.Spring
  const [activeSport, setActiveSport] = useState<string>('All')
  const [schoolSearch, setSchoolSearch] = useState('')

  const filteredTodayGames = useMemo(() => {
    if (activeSport === 'All') return todayGames
    return todayGames.filter(g => {
      if (!g.sport) return false
      const sn = g.sport.gender === 'Boys'
        ? `Boys ${g.sport.sport_name}` === activeSport
          ? true : g.sport.sport_name === activeSport
        : g.sport.gender === 'Girls'
          ? `Girls ${g.sport.sport_name}` === activeSport
            ? true : g.sport.sport_name === activeSport
          : g.sport.sport_name === activeSport
      return sn
    })
  }, [todayGames, activeSport])

  const todayFinals = filteredTodayGames.filter(g => g.status === 'Final')
  const todayScheduled = filteredTodayGames.filter(g => g.status === 'Scheduled')
  const todayLive = filteredTodayGames.filter(g => g.status === 'Live')
  const closeGames = todayFinals.filter(g => isCloseGame(g.home_score, g.away_score))

  const filteredSchools = useMemo(() => {
    if (!schoolSearch) return []
    const q = schoolSearch.toLowerCase()
    return schools.filter(s =>
      s.school_name.toLowerCase().includes(q) ||
      s.mascot?.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [schoolSearch, schools])

  const sportTabs = ['All', ...homeSports]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Hero bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="badge"
              style={{ background: 'rgba(53,114,255,0.15)', color: '#5e99ff', border: '1px solid rgba(53,114,255,0.3)' }}
            >
              {activeSeason?.name || 'Spring 2026'}
            </span>
            {todayLive.length > 0 && (
              <span className="badge badge-live">🔴 {todayLive.length} Live</span>
            )}
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold text-white"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
          >
            Tonight's Section X Scores
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {format(new Date(today + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/submit-score" className="btn-primary">
            + Submit Score
          </Link>
          <Link href="/submit-photo" className="btn-ghost">
            📷 Photo
          </Link>
        </div>
      </div>

      {/* Sport tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
        {sportTabs.map(sport => (
          <button
            key={sport}
            className={`sport-tab flex-shrink-0 ${activeSport === sport ? 'active' : ''}`}
            onClick={() => setActiveSport(sport)}
          >
            {sport}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main scores column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live games */}
          {todayLive.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="badge badge-live">🔴 LIVE</span>
                <span className="section-label">In Progress</span>
              </div>
              <div className="space-y-2">
                {todayLive.map(game => (
                  <ScoreCard key={game.id} game={game} />
                ))}
              </div>
            </section>
          )}

          {/* Finals */}
          {todayFinals.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="badge badge-final">FINAL</span>
                  <span className="section-label">{todayFinals.length} Result{todayFinals.length !== 1 ? 's' : ''}</span>
                </div>
                {closeGames.length > 0 && (
                  <span className="text-xs" style={{ color: '#fbbf24' }}>🔥 {closeGames.length} close game{closeGames.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="space-y-2">
                {todayFinals.map(game => (
                  <ScoreCard key={game.id} game={game} />
                ))}
              </div>
            </section>
          )}

          {/* Scheduled */}
          {todayScheduled.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="badge badge-scheduled">SCHEDULED</span>
                <span className="section-label">Today's Games</span>
              </div>
              <div className="space-y-2">
                {todayScheduled.map(game => (
                  <ScoreCard key={game.id} game={game} />
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {filteredTodayGames.length === 0 && (
            <div
              className="rounded-xl p-10 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="text-4xl mb-3">🏆</div>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}
              >
                No games today
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Check back later or browse recent results.
              </p>
              <Link href="/scores" className="btn-ghost mt-4 inline-flex">
                Browse Scores
              </Link>
            </div>
          )}

          {/* Recent finals */}
          {recentGames.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <span className="section-label">Recent Results</span>
                <Link href="/scores" className="text-xs" style={{ color: 'var(--accent-bright)' }}>View All →</Link>
              </div>
              <div className="space-y-2">
                {recentGames.slice(0, 6).map(game => (
                  <ScoreCard key={game.id} game={game} compact />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Featured Game */}
          {featuredGame && (
            <div>
              <div className="section-label mb-2">Game of the Night</div>
              <ScoreCard game={featuredGame} />
            </div>
          )}

          {/* School Search */}
          <div className="card p-4">
            <div className="section-label mb-3">Find a School</div>
            <input
              className="input text-sm"
              placeholder="Search schools..."
              value={schoolSearch}
              onChange={e => setSchoolSearch(e.target.value)}
            />
            {filteredSchools.length > 0 && (
              <div className="mt-2 space-y-1">
                {filteredSchools.map(school => (
                  <Link
                    key={school.id}
                    href={`/schools/${school.slug}`}
                    className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors"
                  >
                    <div
                      className="w-6 h-6 rounded text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
                      style={{ background: school.primary_color || 'var(--accent)', fontFamily: 'var(--font-display)' }}
                    >
                      {school.school_name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {school.school_name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{school.city}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick nav */}
          <div className="card p-4">
            <div className="section-label mb-3">Quick Links</div>
            <div className="space-y-1">
              {[
                { href: '/scores', label: '📅 All Scores' },
                { href: '/standings', label: '📊 Standings' },
                { href: '/schools', label: '🏫 All Schools' },
                { href: '/photos', label: '📷 Photo Gallery' },
                { href: '/submit-score', label: '✏️ Submit a Score' },
                { href: '/submit-photo', label: '📸 Submit a Photo' },
                { href: '/shoutout', label: '🌟 Send a Shoutout' },
              ].map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Photo of the Week */}
          {featuredPhoto && (
            <div className="card overflow-hidden">
              <div className="section-label p-3 pb-0">Photo of the Week</div>
              <img
                src={featuredPhoto.photo_url}
                alt={featuredPhoto.caption || 'Section X sports photo'}
                className="w-full aspect-video object-cover mt-2"
              />
              <div className="p-3">
                {featuredPhoto.caption && (
                  <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{featuredPhoto.caption}</p>
                )}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  📷 {featuredPhoto.photographer_credit_name}
                </p>
              </div>
            </div>
          )}

          {/* Sponsor */}
          {homepageSponsor ? (
            <a
              href={homepageSponsor.website_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="sponsor-block flex flex-col gap-1 hover:border-blue-800 transition-colors"
            >
              <span className="section-label">Sponsored By</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {homepageSponsor.business_name}
              </span>
            </a>
          ) : (
            <Link
              href="/advertise"
              className="sponsor-block flex flex-col gap-1 hover:border-blue-800 transition-colors cursor-pointer"
            >
              <span className="section-label">Your Ad Here</span>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                Reach North Country sports families
              </span>
              <span className="text-xs" style={{ color: 'var(--accent-bright)' }}>
                Advertise on Section X Scoreboard →
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
