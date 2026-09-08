// src/app/(public)/scores/ScoresClient.tsx
'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import ScoreCard from '@/components/scores/ScoreCard'
import CrossCountryMeetCard from '@/components/scores/CrossCountryMeetCard'
import { isScrimmage } from '@/lib/gameType'
import type { GameWithTeams, Sport } from '@/types'

interface ScoresClientProps {
  games: GameWithTeams[]
  crossCountryMeets: any[]
  sports: Sport[]
  selectedDate: string
  today: string
  datesWithGames: string[]
}

function sportDisplayName(name?: string, gender?: string) {
  const cleanName = (name || 'Other').trim()
  const cleanGender = (gender || '').trim()
  if (cleanGender !== 'Boys' && cleanGender !== 'Girls') return cleanName
  if (cleanName.toLowerCase().startsWith(`${cleanGender.toLowerCase()} `)) return cleanName
  return `${cleanGender} ${cleanName}`
}

function formatGameTime(value?: string | null) {
  if (!value) return 'Time TBA'
  const [hRaw, mRaw] = value.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw)
  if (Number.isNaN(h) || Number.isNaN(m)) return value
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function gameTeamName(game: any, side: 'home' | 'away') {
  return game?.[`${side}_team`]?.school?.school_name || game?.[`external_${side}`]?.name || 'TBD'
}

function ScrimmageCard({ game }: { game: GameWithTeams }) {
  const status = String(game.status || 'Scheduled')
  const canceled = status === 'Canceled'
  const postponed = status === 'Postponed'
  const label = canceled ? 'Canceled Scrimmage' : postponed ? 'Postponed Scrimmage' : 'Scrimmage'

  return (
    <Link href={`/game-center/${game.id}`} className="block group">
      <div className="rounded-2xl overflow-hidden transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-black/40 border border-yellow-300/15 bg-yellow-300/[0.035]">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/[0.05]">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-300">{label}</div>
            <div className="mt-0.5 text-[10px] text-white/30">Does not count in official records or standings</div>
          </div>
          <div className={`text-xs font-black whitespace-nowrap ${canceled ? 'text-red-300' : postponed ? 'text-orange-300' : 'text-white'}`}>
            {canceled ? 'CANCELED' : postponed ? 'POSTPONED' : formatGameTime(game.game_time)}
          </div>
        </div>
        <div className="px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0 text-left">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/25">Away</div>
            <div className="mt-1 text-sm font-black text-white/75 truncate">{gameTeamName(game, 'away')}</div>
          </div>
          <div className="text-[10px] font-black text-yellow-300/65">VS</div>
          <div className="min-w-0 text-right">
            <div className="text-[9px] font-black uppercase tracking-widest text-white/25">Home</div>
            <div className="mt-1 text-sm font-black text-white/75 truncate">{gameTeamName(game, 'home')}</div>
          </div>
        </div>
        {game.location && <div className="px-4 pb-3 text-xs text-white/30 truncate">{game.location}</div>}
      </div>
    </Link>
  )
}

export default function ScoresClient({ games, crossCountryMeets, sports, selectedDate, today, datesWithGames }: ScoresClientProps) {
  const router = useRouter()
  const [sportFilter, setSportFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [viewMode, setViewMode] = useState<'sport' | 'division'>('sport')
  const [showScheduled, setShowScheduled] = useState(true)

  const filteredGames = useMemo(() => {
    return games.filter(g => {
      if (sportFilter !== 'All' && g.sport?.sport_name !== sportFilter) return false
      if (statusFilter === 'Scrimmage' && !isScrimmage(g)) return false
      if (statusFilter !== 'All' && statusFilter !== 'Scrimmage' && g.status !== statusFilter) return false
      return true
    })
  }, [games, sportFilter, statusFilter])

  const displayGames = useMemo(() =>
    showScheduled ? filteredGames : filteredGames.filter(g => !isScrimmage(g) && (g.status === 'Final' || g.status === 'Live')),
    [filteredGames, showScheduled]
  )

  const filteredCrossCountryMeets = useMemo(() => {
    if (sportFilter !== 'All' && sportFilter !== 'Cross Country') return []
    return (crossCountryMeets || []).filter(meet => {
      if (statusFilter === 'Scrimmage') return meet.meet_type === 'Scrimmage'
      if (statusFilter !== 'All' && meet.status !== statusFilter) return false
      if (!showScheduled && meet.status !== 'Final' && meet.status !== 'Live') return false
      return true
    })
  }, [crossCountryMeets, sportFilter, statusFilter, showScheduled])

  const grouped = useMemo(() => {
    const map = new Map<string, GameWithTeams[]>()
    for (const game of displayGames) {
      let key: string
      if (viewMode === 'division') {
        const homeDiv = (game.home_team as any)?.team_seasons?.[0]?.division
        const awayDiv = (game.away_team as any)?.team_seasons?.[0]?.division
        key = homeDiv || awayDiv || 'Non-League'
      } else {
        key = sportDisplayName(game.sport?.sport_name, game.sport?.gender)
      }
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(game)
    }
    return map
  }, [displayGames, viewMode])

  const handleDateChange = (date: string) => {
    router.push(`/scores?date=${date}`)
  }

  const offsetDate = (base: string, days: number) => {
    const d = new Date(base + 'T12:00:00')
    d.setDate(d.getDate() + days)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const displayDate = parseISO(selectedDate + 'T12:00:00')

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Scores
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Section X high school sports results and schedules
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[['Yesterday', -1], ['Today', 0], ['Tomorrow', 1]].map(([label, offset]) => {
          const date = offsetDate(today, Number(offset))
          const active = selectedDate === date
          return <button key={String(label)} onClick={() => handleDateChange(date)} className="rounded-xl px-3 py-2 text-xs font-black transition-all" style={{background:active?'rgba(37,99,235,.22)':'rgba(255,255,255,.025)',border:active?'1px solid rgba(96,165,250,.35)':'1px solid rgba(255,255,255,.06)',color:active?'#fff':'var(--text-secondary)',fontFamily:'var(--font-display)'}}>{String(label)}</button>
        })}
      </div>

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
                date === selectedDate ? 'text-white' : ''
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

      <div className="flex gap-2 flex-wrap mb-5">
        <select
          className="input w-auto text-sm"
          value={sportFilter}
          onChange={e => setSportFilter(e.target.value)}
        >
          <option value="All">All Sports</option>
          {[...new Set(sports.map(s => s.sport_name))].map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          className="input w-auto text-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Scrimmage">Scrimmages</option>
          <option value="Final">Final</option>
          <option value="Live">Live</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Postponed">Postponed</option>
          <option value="Canceled">Canceled</option>
        </select>
      </div>

      <h2
        className="text-xl font-semibold mb-4"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}
      >
        {selectedDate === today ? "Today's Events" : format(displayDate, 'EEEE, MMMM d, yyyy')}
        <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-muted)' }}>
          ({filteredGames.length + filteredCrossCountryMeets.length} event{filteredGames.length + filteredCrossCountryMeets.length !== 1 ? 's' : ''})
        </span>
      </h2>

      {grouped.size === 0 && filteredCrossCountryMeets.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
            No events on this date
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Try selecting a different date.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredCrossCountryMeets.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                Cross Country
                <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>({filteredCrossCountryMeets.length})</span>
              </h3>
              <div className="space-y-2">{filteredCrossCountryMeets.map(meet => <CrossCountryMeetCard key={meet.id} meet={meet} />)}</div>
            </section>
          )}
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
                  isScrimmage(game)
                    ? <ScrimmageCard key={game.id} game={game} />
                    : <ScoreCard key={game.id} game={game} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
