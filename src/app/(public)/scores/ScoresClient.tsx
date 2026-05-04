// src/app/(public)/scores/ScoresClient.tsx
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import ScoreCard from '@/components/scores/ScoreCard'
import type { GameWithTeams, Sport } from '@/types'

interface ScoresClientProps {
  games: GameWithTeams[]
  sports: Sport[]
  selectedDate: string
  today: string
  datesWithGames: string[]
}

export default function ScoresClient({ games, sports, selectedDate, today, datesWithGames }: ScoresClientProps) {
  const router = useRouter()
  const [sportFilter, setSportFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [viewMode, setViewMode] = useState<'sport' | 'division'>('sport')
  const [showScheduled, setShowScheduled] = useState(true)

  const filteredGames = useMemo(() => {
    return games.filter(g => {
      if (sportFilter !== 'All' && g.sport?.sport_name !== sportFilter) return false
      if (statusFilter !== 'All' && g.status !== statusFilter) return false
      return true
    })
  }, [games, sportFilter, statusFilter])

  const displayGames = useMemo(() =>
    showScheduled ? filteredGames : filteredGames.filter(g => g.status === 'Final' || g.status === 'Live'),
    [filteredGames, showScheduled]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, GameWithTeams[]>()
    for (const game of displayGames) {
      let key: string
      if (viewMode === 'division') {
        const homeDiv = (game.home_team as any)?.team_seasons?.[0]?.division
        const awayDiv = (game.away_team as any)?.team_seasons?.[0]?.division
        key = homeDiv || awayDiv || 'Non-League'
      } else {
        const g = game.sport?.gender
        const n = game.sport?.sport_name || 'Other'
        key = (g === 'Boys' || g === 'Girls') ? `${g} ${n}` : n
      }
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(game)
    }
    return map
  }, [displayGames, viewMode])

  const SPORT_ICONS: Record<string, string> = {
    Baseball: '⚾', Softball: '🥎', Football: '🏈',
    'Boys Basketball': '🏀', 'Girls Basketball': '🏀',
    'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
    'Boys Hockey': '🏒', 'Girls Hockey': '🏒',
    'Boys Soccer': '⚽', 'Girls Soccer': '⚽',
    Volleyball: '🏐', 'Boys Golf': '⛳',
  }

  const handleDateChange = (date: string) => {
    router.push(`/scores?date=${date}`)
  }

  const displayDate = parseISO(selectedDate + 'T12:00:00')

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Scores
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Section X high school sports results
        </p>
      </div>

      {/* Date picker row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="date"
          className="input w-full sm:w-auto"
          value={selectedDate}
          onChange={e => handleDateChange(e.target.value)}
        />
        <div className="flex gap-2 overflow-x-auto">
          {datesWithGames.slice(-7).map(date => (
            <button
              key={date}
              onClick={() => handleDateChange(date)}
              className={`px-3 py-1.5 rounded text-xs font-medium flex-shrink-0 transition-colors ${
                date === selectedDate
                  ? 'text-white'
                  : ''
              }`}
              style={{
                background: date === selectedDate ? 'var(--accent)' : 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: date === selectedDate ? '#fff' : 'var(--text-secondary)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {format(parseISO(date + 'T12:00:00'), 'M/d')}
              {date === today && ' ·Today'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-5">
        <select
          className="input w-auto text-sm"
          value={sportFilter}
          onChange={e => setSportFilter(e.target.value)}
        >
          <option value="All">All Sports</option>
          {sports.map(s => (
            <option key={s.id} value={s.sport_name}>{s.sport_name}</option>
          ))}
        </select>
        <select
          className="input w-auto text-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Final">Final</option>
          <option value="Live">Live</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Postponed">Postponed</option>
          <option value="Canceled">Canceled</option>
        </select>
      </div>

      {/* Date heading */}
      <h2
        className="text-xl font-semibold mb-4"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}
      >
        {selectedDate === today ? "Today's Games" : format(displayDate, 'EEEE, MMMM d, yyyy')}
        <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-muted)' }}>
          ({filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''})
        </span>
      </h2>

      {/* Grouped by sport */}
      {grouped.size === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
            No games on this date
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Try selecting a different date.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([sport, sportGames]) => (
            <section key={sport}>
              <h3
                className="text-lg font-semibold mb-3 flex items-center gap-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {sport}
                <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                  ({sportGames.length})
                </span>
              </h3>
              <div className="space-y-2">
                {sportGames.map(game => (
                  <ScoreCard key={game.id} game={game} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
