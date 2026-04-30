'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, addDays, subDays } from 'date-fns'
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

// Team records cache: teamId+seasonId → "W-L"
const recordCache: Record<string, string> = {}

function teamAbbr(game: TickerGame, side: 'home' | 'away'): string {
  const s = side === 'home' ? game.home_team?.school : game.away_team?.school
  const ext = side === 'home' ? game.external_home : game.external_away
  if (s?.alias) return s.alias.toUpperCase()
  if (s?.school_name) return s.school_name.split(' ').filter((w: string) => w.length > 2).map((w: string) => w[0]).join('').toUpperCase().slice(0, 4)
  return ext?.name?.slice(0, 4).toUpperCase() || 'TBD'
}

function teamColor(game: TickerGame, side: 'home' | 'away'): string {
  return (side === 'home' ? game.home_team?.school?.primary_color : game.away_team?.school?.primary_color) || '#334155'
}

function formatTime(t: string) {
  try {
    const [h, m] = t.split(':').map(Number)
    const isPM = h < 8 || h >= 12
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`
  } catch { return t }
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
  const [records, setRecords] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const fetchGames = useCallback(async (d: string) => {
    setLoading(true)
    const isPast = d < format(new Date(), 'yyyy-MM-dd')
    let q = supabase
      .from('games')
      .select(`
        id, game_date, game_time, home_score, away_score, status,
        sport:sports(sport_name, gender),
        home_team:teams!games_home_team_id_fkey(id, team_name, sport_id, school:schools(school_name, alias, primary_color)),
        away_team:teams!games_away_team_id_fkey(id, team_name, sport_id, school:schools(school_name, alias, primary_color)),
        external_home:external_opponents!games_external_home_opponent_id_fkey(name),
        external_away:external_opponents!games_external_away_opponent_id_fkey(name),
        season_id, sport_id
      `)
      .eq('game_date', d)
      .neq('status', 'Canceled')
      .order('game_time', { ascending: true })
    if (isPast) q = (q as any).eq('status', 'Final')
    const { data } = await q
    const gamesData = (data as any) || []
    setGames(gamesData)
    setLoading(false)

    // Fetch records for all teams in these games
    const teamIds = new Set<string>()
    const teamSeasonSport: Record<string, { seasonId: string; sportId: string }> = {}
    for (const g of gamesData) {
      if (g.home_team?.id && g.season_id && g.sport_id) {
        teamIds.add(g.home_team.id)
        teamSeasonSport[g.home_team.id] = { seasonId: g.season_id, sportId: g.sport_id }
      }
      if (g.away_team?.id && g.season_id && g.sport_id) {
        teamIds.add(g.away_team.id)
        teamSeasonSport[g.away_team.id] = { seasonId: g.season_id, sportId: g.sport_id }
      }
    }

    const newRecords: Record<string, string> = {}
    for (const teamId of teamIds) {
      const cacheKey = `${teamId}-${teamSeasonSport[teamId]?.seasonId}`
      if (recordCache[cacheKey]) { newRecords[teamId] = recordCache[cacheKey]; continue }

      const { seasonId, sportId } = teamSeasonSport[teamId]
      const { data: tgames } = await supabase
        .from('games')
        .select('home_team_id, away_team_id, home_score, away_score')
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('season_id', seasonId)
        .eq('sport_id', sportId)
        .eq('status', 'Final')

      const isGolf = gamesData.find((g: any) => g.home_team?.id === teamId || g.away_team?.id === teamId)?.sport?.sport_name?.toLowerCase().includes('golf')
      let w = 0, l = 0
      for (const tg of (tgames || [])) {
        if (tg.home_score == null || tg.away_score == null) continue
        const isHome = tg.home_team_id === teamId
        const mine = isHome ? tg.home_score : tg.away_score
        const opp = isHome ? tg.away_score : tg.home_score
        if (isGolf ? mine < opp : mine > opp) w++
        else if (mine !== opp) l++
      }
      const rec = `${w}-${l}`
      recordCache[cacheKey] = rec
      newRecords[teamId] = rec
    }
    setRecords(newRecords)
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
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' })
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const dateLabel = (d: string) => d === today ? 'Today' : d === yesterday ? 'Yesterday' : d === tomorrow ? 'Tomorrow' : format(new Date(d + 'T12:00:00'), 'MMM d')

  return (
    <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.5)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Date tabs */}
        <div className="flex items-center gap-1.5 px-4 pt-2 pb-1.5">
          {[yesterday, today, tomorrow].map(d => (
            <button key={d} onClick={() => setDate(d)}
              className={`px-3 py-1 text-xs font-black rounded-full transition-all uppercase tracking-widest`}
              style={{
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.1em',
                background: date === d ? 'rgba(96,165,250,0.15)' : 'transparent',
                color: date === d ? '#60a5fa' : '#374151',
                border: date === d ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
              }}>
              {dateLabel(d)}
            </button>
          ))}
          {games.length > 0 && (
            <span className="ml-auto text-xs text-slate-700" style={{ fontFamily: 'var(--font-display)' }}>
              {games.length} game{games.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Strip */}
        <div className="relative flex items-center">
          <div className="absolute left-0 top-0 bottom-0 w-10 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.8), transparent)' }} />
          {canScrollLeft && (
            <button onClick={() => scroll('left')}
              className="absolute left-1.5 z-20 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all"
              style={{ top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)' }}>
              <ChevronLeft size={14} />
            </button>
          )}

          <div ref={scrollRef} className="flex gap-2 overflow-x-auto py-2 px-4 no-scrollbar"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40 h-[72px] rounded-xl animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.04)', scrollSnapAlign: 'start' }} />
              ))
            ) : games.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-600" style={{ fontFamily: 'var(--font-display)' }}>
                No games {dateLabel(date).toLowerCase()}
              </div>
            ) : games.map(game => {
              const isFinal = game.status === 'Final'
              const isLive = game.status === 'Live'
              const isPpd = game.status === 'Postponed'
              const isGolf = game.sport?.sport_name?.toLowerCase().includes('golf')
              const homeId = (game.home_team as any)?.id
              const awayId = (game.away_team as any)?.id
              const homeAbbr = teamAbbr(game, 'home')
              const awayAbbr = teamAbbr(game, 'away')
              const homeColor = teamColor(game, 'home')
              const awayColor = teamColor(game, 'away')
              const homeWins = isFinal && game.home_score != null && game.away_score != null &&
                (isGolf ? game.home_score < game.away_score : game.home_score > game.away_score)
              const awayWins = isFinal && game.home_score != null && game.away_score != null &&
                (isGolf ? game.away_score < game.home_score : game.away_score > game.home_score)
              const homeRec = homeId ? records[homeId] : null
              const awayRec = awayId ? records[awayId] : null

              return (
                <Link key={game.id} href={`/games/${game.id}`} className="flex-shrink-0 group"
                  style={{ scrollSnapAlign: 'start' }}>
                  <div className="w-44 rounded-xl px-3 py-2 transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-lg"
                    style={{
                      background: isLive ? 'rgba(239,68,68,0.08)' : isFinal ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.025)',
                      border: isLive ? '1px solid rgba(239,68,68,0.35)' : isFinal ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                    {/* Sport + status */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs leading-none">{sportIcon(game)}</span>
                      <span className="text-xs font-black tracking-wider" style={{ fontFamily: 'var(--font-display)' , color:
                        isFinal ? '#4ade80' : isLive ? '#f87171' : isPpd ? '#f59e0b' : '#374151' }}>
                        {isFinal ? 'FINAL' : isLive ? '● LIVE' : isPpd ? 'PPD' : game.game_time ? formatTime(game.game_time) : '—'}
                      </span>
                    </div>

                    {/* Away */}
                    <div className={`flex items-center justify-between gap-1 ${isFinal && !awayWins ? 'opacity-40' : ''}`}>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: awayColor }} />
                        <div className="min-w-0">
                          <div className="text-xs font-black leading-none truncate" style={{
                            fontFamily: 'var(--font-display)',
                            color: awayWins ? '#ffffff' : '#94a3b8',
                            letterSpacing: '0.04em',
                          }}>{awayAbbr}</div>
                          {awayRec && <div className="text-xs leading-none mt-0.5" style={{ color: '#374151', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{awayRec}</div>}
                        </div>
                      </div>
                      {(isFinal || isLive) && (
                        <span className="font-mono font-black tabular-nums text-sm flex-shrink-0"
                          style={{ color: awayWins ? '#ffffff' : '#374151' }}>
                          {game.away_score}
                        </span>
                      )}
                    </div>

                    {/* Home */}
                    <div className={`flex items-center justify-between gap-1 mt-1 ${isFinal && !homeWins ? 'opacity-40' : ''}`}>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: homeColor }} />
                        <div className="min-w-0">
                          <div className="text-xs font-black leading-none truncate" style={{
                            fontFamily: 'var(--font-display)',
                            color: homeWins ? '#ffffff' : '#94a3b8',
                            letterSpacing: '0.04em',
                          }}>{homeAbbr}</div>
                          {homeRec && <div className="text-xs leading-none mt-0.5" style={{ color: '#374151', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{homeRec}</div>}
                        </div>
                      </div>
                      {(isFinal || isLive) && (
                        <span className="font-mono font-black tabular-nums text-sm flex-shrink-0"
                          style={{ color: homeWins ? '#ffffff' : '#374151' }}>
                          {game.home_score}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="absolute right-0 top-0 bottom-0 w-10 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.8), transparent)' }} />
          {canScrollRight && (
            <button onClick={() => scroll('right')}
              className="absolute right-1.5 z-20 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all"
              style={{ top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)' }}>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
