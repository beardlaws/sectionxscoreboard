import Link from 'next/link'
import type { GameWithTeams } from '@/types'
import { isCloseGame } from '@/lib/constants'
import { format } from 'date-fns'

interface ScoreCardProps {
  game: GameWithTeams
  compact?: boolean
  highlightTeamId?: string
  featured?: boolean
}

const SPORT_META: Record<string, { icon: string; color: string }> = {
  'Baseball':          { icon: '⚾', color: '#b45309' },
  'Softball':          { icon: '🥎', color: '#c2410c' },
  'Boys Lacrosse':     { icon: '🥍', color: '#1d4ed8' },
  'Girls Lacrosse':    { icon: '🥍', color: '#7c3aed' },
  'Football':          { icon: '🏈', color: '#92400e' },
  'Boys Basketball':   { icon: '🏀', color: '#ea580c' },
  'Girls Basketball':  { icon: '🏀', color: '#db2777' },
  'Boys Hockey':       { icon: '🏒', color: '#0284c7' },
  'Girls Hockey':      { icon: '🏒', color: '#0891b2' },
  'Boys Soccer':       { icon: '⚽', color: '#16a34a' },
  'Girls Soccer':      { icon: '⚽', color: '#059669' },
  'Volleyball':        { icon: '🏐', color: '#4f46e5' },
  'Boys Wrestling':    { icon: '🤼', color: '#9f1239' },
  'Girls Wrestling':   { icon: '🤼', color: '#be123c' },
  'Boys Track':        { icon: '🏃', color: '#ca8a04' },
  'Girls Track':       { icon: '🏃', color: '#d97706' },
  'Boys Golf':         { icon: '⛳', color: '#15803d' },
  'Girls Swimming':    { icon: '🏊', color: '#0e7490' },
  'Boys Cross Country':{ icon: '🏃', color: '#65a30d' },
  'Girls Cross Country':{ icon: '🏃', color: '#4d7c0f' },
}

function getSportMeta(name?: string, gender?: string) {
  if (!name) return { icon: '🏆', color: '#334155' }
  const full = (gender === 'Boys' || gender === 'Girls') ? `${gender} ${name}` : name
  return SPORT_META[full] || SPORT_META[name] || { icon: '🏆', color: '#334155' }
}

function initials(name: string) {
  return name.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    || name.slice(0, 2).toUpperCase()
}

function formatTime(t: string) {
  // "04:30:00" → "4:30 PM"
  // High school games are afternoon/evening - if hour < 8 with no AM/PM indicator, it's PM
  try {
    const [h, m] = t.split(':').map(Number)
    // Times stored without AM/PM: 1-7 = PM (1:00-7:59 PM), 8-11 = AM (morning games), 12+ = PM
    const isPM = h < 8 || h >= 12
    const ampm = isPM ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  } catch { return t }
}

export default function ScoreCard({ game, compact = false, featured = false }: ScoreCardProps) {
  const ht = game.home_team
  const at = game.away_team
  const hs = ht?.school
  const as_ = at?.school

  const homeName = hs?.school_name || (game as any).external_home?.name || 'TBD'
  const awayName = as_?.school_name || (game as any).external_away?.name || 'TBD'
  const homeColor = hs?.primary_color || '#1e3a5f'
  const awayColor = as_?.primary_color || '#334155'

  const isFinal = game.status === 'Final'
  const isLive  = game.status === 'Live'
  const isSched = game.status === 'Scheduled'
  const isPpd   = game.status === 'Postponed'
  const isCanceled = game.status === 'Canceled'

  const hasScore = game.home_score != null && game.away_score != null
  const homeWins = isFinal && hasScore && game.home_score! > game.away_score!
  const awayWins = isFinal && hasScore && game.away_score! > game.home_score!
  const close = isCloseGame(game.home_score, game.away_score)
  const meta = getSportMeta(game.sport?.sport_name, game.sport?.gender)

  const accentColor = isFinal
    ? homeWins ? homeColor : awayWins ? awayColor : 'rgba(255,255,255,0.08)'
    : isLive ? '#ef4444'
    : 'rgba(255,255,255,0.05)'

  // ── COMPACT ──────────────────────────────────────────────
  if (compact) {
    return (
      <Link href={`/games/${game.id}`} className="block group">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150
          hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06]"
          style={{ borderLeft: `2px solid ${isFinal ? accentColor : 'transparent'}` }}>
          <span className="text-base w-5 text-center flex-shrink-0 leading-none">{meta.icon}</span>
          <div className="flex-1 min-w-0 space-y-0.5">
            {/* Away */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm truncate transition-all"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: awayWins ? 800 : 500,
                  color: awayWins ? '#f0f4ff' : isFinal ? '#384d6b' : '#7a90b8',
                  fontSize: awayWins ? '14px' : '13px',
                  letterSpacing: '0.02em',
                }}>
                {awayName}
              </span>
              {(isFinal || isLive) && (
                <span className="font-mono font-bold tabular-nums text-sm flex-shrink-0"
                  style={{ color: awayWins ? '#ffffff' : '#2d3d55' }}>
                  {game.away_score}
                </span>
              )}
              {isSched && game.game_time && (
                <span className="text-xs text-slate-500 flex-shrink-0 font-mono">{formatTime(game.game_time)}</span>
              )}
            </div>
            {/* Home */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm truncate transition-all"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: homeWins ? 800 : 500,
                  color: homeWins ? '#f0f4ff' : isFinal ? '#384d6b' : '#7a90b8',
                  fontSize: homeWins ? '14px' : '13px',
                  letterSpacing: '0.02em',
                }}>
                {homeName}
              </span>
              {(isFinal || isLive) && (
                <span className="font-mono font-bold tabular-nums text-sm flex-shrink-0"
                  style={{ color: homeWins ? '#ffffff' : '#2d3d55' }}>
                  {game.home_score}
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 text-right min-w-[36px]">
            {isLive && <span className="text-xs font-bold text-red-400 animate-pulse">LIVE</span>}
            {isFinal && <span className="text-xs font-bold text-emerald-400" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>F</span>}
            {isPpd && <span className="text-xs text-amber-500 font-semibold">PPD</span>}
            {isCanceled && <span className="text-xs text-slate-600">CXL</span>}
            {close && isFinal && <div className="text-xs text-amber-400 leading-none mt-0.5">🔥</div>}
          </div>
        </div>
      </Link>
    )
  }

  // ── FULL CARD ─────────────────────────────────────────────
  // Scheduled games look and feel completely different from final games
  if (isSched || isPpd || isCanceled) {
    const timeDisplay = game.game_time ? formatTime(game.game_time) : 'TBD'
    return (
      <Link href={`/games/${game.id}`} className="block group">
        <div className="rounded-2xl overflow-hidden transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-black/40"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{meta.icon}</span>
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: meta.color, fontFamily: 'var(--font-display)' }}>
                {game.sport?.sport_name}{game.game_number ? ` · G${game.game_number}` : ''}
              </span>
            </div>
            {isPpd ? (
              <span className="text-xs font-bold text-amber-500 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>Postponed</span>
            ) : isCanceled ? (
              <span className="text-xs text-slate-600 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>Canceled</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(37,99,235,0.2)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em', border: '1px solid rgba(37,99,235,0.3)' }}>
                  {timeDisplay}
                </span>
              </div>
            )}
          </div>
          {/* Teams */}
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                  style={{ background: awayColor, fontFamily: 'var(--font-display)' }}>
                  {initials(awayName)}
                </div>
                <span className="text-slate-300 font-semibold text-sm truncate" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
                  {awayName}
                </span>
                <span className="text-slate-600 text-xs ml-auto flex-shrink-0">Away</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                  style={{ background: homeColor, fontFamily: 'var(--font-display)' }}>
                  {initials(homeName)}
                </div>
                <span className="text-slate-300 font-semibold text-sm truncate" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
                  {homeName}
                </span>
                <span className="text-slate-600 text-xs ml-auto flex-shrink-0">Home</span>
              </div>
            </div>
          </div>
          {game.location && (
            <div className="px-4 pb-2.5 text-xs text-slate-600">📍 {game.location}</div>
          )}
        </div>
      </Link>
    )
  }

  // ── FINAL / LIVE card — make the score the STAR ───────────
  const winnerColor = homeWins ? homeColor : awayWins ? awayColor : '#334155'
  const winnerName = homeWins ? homeName : awayWins ? awayName : null

  return (
    <Link href={`/games/${game.id}`} className="block group">
      <div className="rounded-2xl overflow-hidden transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-2xl"
        style={{
          background: featured
            ? `linear-gradient(135deg, ${winnerColor}22 0%, rgba(8,12,20,0.97) 50%)`
            : `linear-gradient(135deg, ${winnerColor}12 0%, rgba(8,12,20,0.95) 40%)`,
          border: featured
            ? `1px solid ${winnerColor}40`
            : `1px solid ${winnerColor}20`,
          borderLeft: `4px solid ${accentColor}`,
          boxShadow: featured
            ? `0 0 40px ${winnerColor}20, 0 8px 32px rgba(0,0,0,0.5)`
            : `0 4px 24px rgba(0,0,0,0.4)`,
        }}>
        {/* Sport + badges */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{meta.icon}</span>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: meta.color, fontFamily: 'var(--font-display)' }}>
              {game.sport?.sport_name}{game.game_number ? ` · G${game.game_number}` : ''}
            </span>
            {game.game_of_the_night && <span className="text-xs font-black text-yellow-400" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>⭐ GOTN</span>}
            {close && <span className="text-amber-400 text-xs">🔥</span>}
          </div>
          {isLive
            ? <span className="flex items-center gap-1 text-xs font-black text-red-400" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />LIVE</span>
            : <span className="text-xs font-black text-emerald-400" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>FINAL</span>
          }
        </div>

        {/* The scores — make them HUGE */}
        <div className="px-4 pb-4 pt-2">
          {/* Away row */}
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${awayColor}ff, ${awayColor}99)`,
                fontFamily: 'var(--font-display)',
                boxShadow: awayWins ? `0 4px 16px ${awayColor}60` : 'none',
              }}>
              {initials(awayName)}
            </div>
            <span className="flex-1 truncate transition-all"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: awayWins ? 900 : 400,
                fontSize: awayWins ? '19px' : '15px',
                color: awayWins ? '#f8faff' : '#2d3d55',
                letterSpacing: awayWins ? '0.02em' : '0.03em',
              }}>
              {awayName}
            </span>
            <span className="font-mono font-black tabular-nums flex-shrink-0 transition-all"
              style={{
                fontSize: awayWins ? '36px' : '26px',
                color: awayWins ? '#ffffff' : '#1e2d45',
                letterSpacing: '-0.04em',
                lineHeight: 1,
                textShadow: awayWins ? `0 0 30px ${awayColor}80` : 'none',
              }}>
              {game.away_score}
            </span>
          </div>

          {/* Divider */}
          <div className="ml-13 h-px my-1.5" style={{ background: 'rgba(255,255,255,0.04)', marginLeft: '52px' }} />

          {/* Home row */}
          <div className="flex items-center gap-3 mt-1.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${homeColor}ff, ${homeColor}99)`,
                fontFamily: 'var(--font-display)',
                boxShadow: homeWins ? `0 4px 16px ${homeColor}60` : 'none',
              }}>
              {initials(homeName)}
            </div>
            <span className="flex-1 truncate transition-all"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: homeWins ? 900 : 400,
                fontSize: homeWins ? '19px' : '15px',
                color: homeWins ? '#f8faff' : '#2d3d55',
                letterSpacing: homeWins ? '0.02em' : '0.03em',
              }}>
              {homeName}
            </span>
            <span className="font-mono font-black tabular-nums flex-shrink-0 transition-all"
              style={{
                fontSize: homeWins ? '36px' : '26px',
                color: homeWins ? '#ffffff' : '#1e2d45',
                letterSpacing: '-0.04em',
                lineHeight: 1,
                textShadow: homeWins ? `0 0 30px ${homeColor}80` : 'none',
              }}>
              {game.home_score}
            </span>
          </div>

          {game.location && (
            <p className="text-xs mt-2 truncate" style={{ color: '#1e2d45', marginLeft: '52px' }}>📍 {game.location}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
