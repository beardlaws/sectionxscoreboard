import Link from 'next/link'
import type { GameWithTeams } from '@/types'
import { isCloseGame } from '@/lib/constants'

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
  const homeWins = isFinal && game.home_score != null && game.away_score != null && game.home_score > game.away_score
  const awayWins = isFinal && game.home_score != null && game.away_score != null && game.away_score > game.home_score
  const close = isCloseGame(game.home_score, game.away_score)
  const meta = getSportMeta(game.sport?.sport_name, game.sport?.gender)

  // Left accent color = winner's team color
  const accentColor = isFinal
    ? homeWins ? homeColor : awayWins ? awayColor : 'rgba(255,255,255,0.08)'
    : isLive ? '#ef4444'
    : 'rgba(255,255,255,0.06)'

  const StatusBadge = () => {
    if (isLive) return <span className="flex items-center gap-1 text-xs font-bold text-red-400 tracking-widest uppercase"><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />LIVE</span>
    if (isFinal) return <span className="text-xs font-bold text-emerald-400 tracking-widest uppercase">Final</span>
    if (isPpd) return <span className="text-xs font-semibold text-amber-500 tracking-wider uppercase">PPD</span>
    if (game.status === 'Canceled') return <span className="text-xs text-slate-600 tracking-wider uppercase">Canceled</span>
    return game.game_time
      ? <span className="text-xs text-slate-400 font-mono">{game.game_time.slice(0,5)}</span>
      : <span className="text-xs text-slate-600 tracking-wider uppercase">TBD</span>
  }

  if (compact) {
    return (
      <Link href={`/games/${game.id}`} className="block group">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06]"
          style={{ borderLeft: `2px solid ${isFinal ? accentColor : 'transparent'}` }}>
          <span className="text-sm w-5 text-center flex-shrink-0">{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className={`flex items-center justify-between gap-2`}>
              <span className={`text-sm truncate transition-all ${awayWins ? 'text-white font-bold' : isFinal ? 'text-slate-500' : 'text-slate-300'}`}
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.03em', fontSize: awayWins ? '14px' : '13px' }}>
                {awayName}
              </span>
              {(isFinal || isLive) && (
                <span className={`font-mono font-bold tabular-nums text-sm flex-shrink-0 ${awayWins ? 'text-white' : 'text-slate-600'}`}>
                  {game.away_score}
                </span>
              )}
            </div>
            <div className={`flex items-center justify-between gap-2 mt-0.5`}>
              <span className={`text-sm truncate transition-all ${homeWins ? 'text-white font-bold' : isFinal ? 'text-slate-500' : 'text-slate-300'}`}
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.03em', fontSize: homeWins ? '14px' : '13px' }}>
                {homeName}
              </span>
              {(isFinal || isLive) && (
                <span className={`font-mono font-bold tabular-nums text-sm flex-shrink-0 ${homeWins ? 'text-white' : 'text-slate-600'}`}>
                  {game.home_score}
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 text-right min-w-[40px]">
            <StatusBadge />
            {close && isFinal && <div className="text-xs text-amber-400 mt-0.5">🔥</div>}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/games/${game.id}`} className="block group">
      <div
        className="rounded-2xl overflow-hidden transition-all duration-200 group-hover:-translate-y-0.5"
        style={{
          background: featured
            ? 'linear-gradient(135deg, rgba(234,179,8,0.07) 0%, rgba(10,15,28,0.95) 60%)'
            : 'rgba(10,15,28,0.8)',
          border: featured
            ? '1px solid rgba(234,179,8,0.25)'
            : '1px solid rgba(255,255,255,0.07)',
          borderLeft: `3px solid ${accentColor}`,
          boxShadow: featured
            ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(234,179,8,0.1) inset'
            : '0 4px 24px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.03) inset',
        }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
          <div className="flex items-center gap-2">
            <span>{meta.icon}</span>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: meta.color, fontFamily: 'var(--font-display)' }}>
              {game.sport?.sport_name}
              {game.game_number ? ` · G${game.game_number}` : ''}
            </span>
            {game.game_of_the_night && <span className="text-xs font-bold text-yellow-400 tracking-widest">⭐ GOTN</span>}
            {close && isFinal && <span className="text-xs text-amber-400">🔥</span>}
          </div>
          <StatusBadge />
        </div>

        {/* Teams */}
        <div className="px-4 pb-4 pt-3 space-y-2">
          {/* Away */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${awayColor}dd, ${awayColor}88)`, fontFamily: 'var(--font-display)', fontSize: '13px' }}>
              {initials(awayName)}
            </div>
            <span className="flex-1 truncate" style={{
              fontFamily: 'var(--font-display)',
              fontSize: awayWins ? '18px' : '15px',
              fontWeight: awayWins ? 800 : 500,
              color: awayWins ? '#f0f4ff' : isFinal ? '#384d6b' : '#7a90b8',
              letterSpacing: '0.03em',
              transition: 'all 0.15s',
            }}>
              {awayName}
            </span>
            {(isFinal || isLive) && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: awayWins ? '28px' : '22px',
                fontWeight: 700,
                color: awayWins ? '#ffffff' : '#2d3d55',
                letterSpacing: '-0.03em',
                transition: 'all 0.15s',
              }}>
                {game.away_score ?? '—'}
              </span>
            )}
            {isSched && game.game_time && (
              <span className="text-slate-600 font-mono text-sm">—</span>
            )}
          </div>

          {/* Divider */}
          <div className="ml-12 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />

          {/* Home */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${homeColor}dd, ${homeColor}88)`, fontFamily: 'var(--font-display)', fontSize: '13px' }}>
              {initials(homeName)}
            </div>
            <span className="flex-1 truncate" style={{
              fontFamily: 'var(--font-display)',
              fontSize: homeWins ? '18px' : '15px',
              fontWeight: homeWins ? 800 : 500,
              color: homeWins ? '#f0f4ff' : isFinal ? '#384d6b' : '#7a90b8',
              letterSpacing: '0.03em',
              transition: 'all 0.15s',
            }}>
              {homeName}
            </span>
            {(isFinal || isLive) && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: homeWins ? '28px' : '22px',
                fontWeight: 700,
                color: homeWins ? '#ffffff' : '#2d3d55',
                letterSpacing: '-0.03em',
                transition: 'all 0.15s',
              }}>
                {game.home_score ?? '—'}
              </span>
            )}
            {isSched && game.game_time && (
              <span className="text-slate-600 font-mono text-sm">—</span>
            )}
          </div>

          {(game.location || game.notes) && (
            <p className="ml-12 text-xs truncate" style={{ color: '#2d3d55', paddingTop: '2px' }}>
              {game.location && `📍 ${game.location}`}
              {game.notes && ` · ${game.notes}`}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
