'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, addDays, subDays, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TickerGame {
  id: string
  game_date: string
  game_time: string | null
  home_score: number | null
  away_score: number | null
  status: string
  sport: { sport_name: string; gender: string } | null
  home_team: { team_name: string; school: { school_name: string; alias: string; primary_color: string } | null } | null
  away_team: { team_name: string; school: { school_name: string; alias: string; primary_color: string } | null } | null
  external_home: { name: string } | null
  external_away: { name: string } | null
}

function teamAbbr(game: TickerGame, side: 'home' | 'away'): string {
  if (side === 'home') {
    const s = game.home_team?.school
    if (s?.alias) return s.alias.toUpperCase()
    if (s?.school_name) return s.school_name.split(' ').filter((w: string) => w.length > 2).map((w: string) => w[0]).join('').toUpperCase().slice(0, 4)
    return game.external_home?.name?.slice(0, 4).toUpperCase() || 'TBD'
  } else {
    const s = game.away_team?.school
    if (s?.alias) return s.alias.toUpperCase()
    if (s?.school_name) return s.school_name.split(' ').filter((w: string) => w.length > 2).map((w: string) => w[0]).join('').toUpperCase().slice(0, 4)
    return game.external_away?.name?.slice(0, 4).toUpperCase() || 'TBD'
  }
}

function teamColor(game: TickerGame, side: 'home' | 'away'): string {
  const color = side === 'home'
    ? game.home_team?.school?.primary_color
    : game.away_team?.school?.primary_color
  return color || '#334155'
}

const SPORT_ICONS: Record<string, string> = {
  Baseball: '⚾', Softball: '🥎', Football: '🏈',
  'Boys Basketball': '🏀', 'Girls Basketball': '🏀',
  'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
  'Boys Hockey': '🏒', 'Girls Hockey': '🏒',
  'Boys Soccer': '⚽', 'Girls Soccer': '⚽',
  Volleyball: '🏐', 'Boys Golf': '⛳',
}

function sportIcon(game: TickerGame): string {
  const g = game.sport?.gender
  const n = game.sport?.sport_name || ''
  const full = (g === 'Boys' || g === 'Girls') ? `${g} ${n}` : n
  return SPORT_ICONS[full] || SPORT_ICONS[n] || '🏆'
}

export default function ScoreTicker() {
  const supabase = createClient()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [games, setGames] = useState<TickerGame[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const fetchGames = useCallback(async (d: string) => {
    setLoading(true)
    // Yesterday & earlier: show finals only (scores reported)
    // Today & tomorrow: show all non-canceled games
    const isPast = d < format(new Date(), 'yyyy-MM-dd')
    let q = supabase
      .from('games')
      .select(`
        id, game_date, game_time, home_score, away_score, status,
        sport:sports(sport_name, gender),
        home_team:teams!games_home_team_id_fkey(team_name, school:schools(school_name, alias, primary_color)),
        away_team:teams!games_away_team_id_fkey(team_name, school:schools(school_name, alias, primary_color)),
        external_home:external_opponents!games_external_home_opponent_id_fkey(name),
        external_away:external_opponents!games_external_away_opponent_id_fkey(name)
      `)
      .eq('game_date', d)
      .neq('status', 'Canceled')
      .order('game_time', { ascending: true })
    if (isPast) q = (q as any).eq('status', 'Final')
    const { data } = await q
    setGames((data as any) || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchGames(date) }, [date, fetchGames])

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => { el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll) }
  }, [games, checkScroll])

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -260 : 260, behavior: 'smooth' })
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  const dateLabel = (d: string) => {
    if (d === today) return 'Today'
    if (d === yesterday) return 'Yesterday'
    if (d === tomorrow) return 'Tomorrow'
    return format(new Date(d + 'T12:00:00'), 'MMM d')
  }

  return (
    <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.4)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Date nav */}
        <div className="flex items-center gap-1.5 px-4 pt-2 pb-1.5">
          {[yesterday, today, tomorrow].map(d => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                date === d
                  ? 'text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              style={date === d ? { background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)' } : {}}
            >
              {dateLabel(d)}
            </button>
          ))}
        </div>

        {/* Ticker strip */}
        <div className="relative flex items-center">
          {/* Left fade + arrow */}
          <div className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to right, rgba(4,8,16,0.95), transparent)' }} />
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-1 z-20 flex items-center justify-center w-7 h-7 rounded-full text-slate-300 hover:text-white transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.1)', top: '50%', transform: 'translateY(-50%)' }}
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Scrollable row */}
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto py-2.5 px-4 no-scrollbar"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          >
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-44 h-16 rounded-lg animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.04)', scrollSnapAlign: 'start' }} />
              ))
            ) : games.length === 0 ? (
              <div className="flex items-center px-3 py-2 text-xs text-slate-500">
                No games {dateLabel(date).toLowerCase()}
              </div>
            ) : (
              games.map(game => {
                const isFinal = game.status === 'Final'
                const isLive = game.status === 'Live'
                const isPpd = game.status === 'Postponed'
                const homeAbbr = teamAbbr(game, 'home')
                const awayAbbr = teamAbbr(game, 'away')
                const homeColor = teamColor(game, 'home')
                const awayColor = teamColor(game, 'away')
                const homeWins = isFinal && game.home_score != null && game.away_score != null && game.home_score > game.away_score
                const awayWins = isFinal && game.home_score != null && game.away_score != null && game.away_score > game.home_score

                return (
                  <Link
                    key={game.id}
                    href={`/games/${game.id}`}
                    className="flex-shrink-0 group"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <div className={`w-44 rounded-xl px-3 py-2.5 transition-all duration-150 border group-hover:scale-[1.02] group-hover:-translate-y-0.5 ${
                      isLive
                        ? 'border-red-500/40 shadow-red-500/10 shadow-lg'
                        : isFinal
                        ? 'border-white/10 shadow-black/20 shadow-md'
                        : 'border-white/6'
                    }`}
                    style={{
                      background: isLive
                        ? 'rgba(239,68,68,0.08)'
                        : isFinal
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(255,255,255,0.025)',
                    }}>
                      {/* Sport icon + status */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs">{sportIcon(game)}</span>
                        <span className={`text-xs font-bold tracking-wide ${
                          isFinal ? 'text-green-400' :
                          isLive ? 'text-red-400 animate-pulse' :
                          isPpd ? 'text-yellow-500' :
                          'text-slate-500'
                        }`}>
                          {isFinal ? 'F' : isLive ? '●' : isPpd ? 'PPD' : game.game_time?.slice(0, 5) || '—'}
                        </span>
                      </div>

                      {/* Away team */}
                      <div className={`flex items-center justify-between gap-1 ${isFinal && !awayWins ? 'opacity-45' : ''}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-4 h-4 rounded flex-shrink-0"
                            style={{ backgroundColor: awayColor }} />
                          <span className={`text-xs font-bold font-display truncate ${awayWins ? 'text-white' : 'text-slate-300'}`}>
                            {awayAbbr}
                          </span>
                        </div>
                        {(isFinal || isLive) && (
                          <span className={`text-sm font-bold font-mono tabular-nums ${awayWins ? 'text-white' : 'text-slate-400'}`}>
                            {game.away_score}
                          </span>
                        )}
                      </div>

                      {/* Home team */}
                      <div className={`flex items-center justify-between gap-1 mt-0.5 ${isFinal && !homeWins ? 'opacity-45' : ''}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-4 h-4 rounded flex-shrink-0"
                            style={{ backgroundColor: homeColor }} />
                          <span className={`text-xs font-bold font-display truncate ${homeWins ? 'text-white' : 'text-slate-300'}`}>
                            {homeAbbr}
                          </span>
                        </div>
                        {(isFinal || isLive) && (
                          <span className={`text-sm font-bold font-mono tabular-nums ${homeWins ? 'text-white' : 'text-slate-400'}`}>
                            {game.home_score}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          {/* Right fade + arrow */}
          <div className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(4,8,16,0.95), transparent)' }} />
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-1 z-20 flex items-center justify-center w-7 h-7 rounded-full text-slate-300 hover:text-white transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.1)', top: '50%', transform: 'translateY(-50%)' }}
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
