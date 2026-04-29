// src/components/scores/ScoreCard.tsx
import Link from 'next/link'
import type { GameWithTeams } from '@/types'
import { isCloseGame } from '@/lib/constants'

interface ScoreCardProps {
  game: GameWithTeams
  compact?: boolean
  highlightTeamId?: string
  featured?: boolean
}

// Sport identity: icon + accent color
const SPORT_META: Record<string, { icon: string; color: string }> = {
  'Baseball':        { icon: '⚾', color: '#b45309' },
  'Softball':        { icon: '🥎', color: '#c2410c' },
  'Boys Lacrosse':   { icon: '🥍', color: '#1d4ed8' },
  'Girls Lacrosse':  { icon: '🥍', color: '#7c3aed' },
  'Football':        { icon: '🏈', color: '#92400e' },
  'Boys Basketball': { icon: '🏀', color: '#ea580c' },
  'Girls Basketball':{ icon: '🏀', color: '#db2777' },
  'Boys Hockey':     { icon: '🏒', color: '#0284c7' },
  'Girls Hockey':    { icon: '🏒', color: '#0891b2' },
  'Boys Soccer':     { icon: '⚽', color: '#16a34a' },
  'Girls Soccer':    { icon: '⚽', color: '#059669' },
  'Volleyball':      { icon: '🏐', color: '#4f46e5' },
  'Boys Wrestling':  { icon: '🤼', color: '#9f1239' },
  'Girls Wrestling': { icon: '🤼', color: '#be123c' },
  'Boys Track':      { icon: '🏃', color: '#ca8a04' },
  'Girls Track':     { icon: '🏃', color: '#d97706' },
  'Boys Cross Country': { icon: '🏃', color: '#65a30d' },
  'Girls Cross Country': { icon: '🏃', color: '#4d7c0f' },
  'Boys Golf':       { icon: '⛳', color: '#15803d' },
  'Boys Swimming':   { icon: '🏊', color: '#0369a1' },
  'Girls Swimming':  { icon: '🏊', color: '#0e7490' },
  'Boys Indoor Track': { icon: '🏃', color: '#ca8a04' },
  'Girls Indoor Track': { icon: '🏃', color: '#d97706' },
}

function getSportMeta(sportName?: string, gender?: string) {
  if (!sportName) return { icon: '🏆', color: '#334155' }
  const full = gender && gender !== 'Both' ? `${gender} ${sportName}` : sportName
  return SPORT_META[full] || SPORT_META[sportName] || { icon: '🏆', color: '#334155' }
}

function TeamInitials(name: string): string {
  return name.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    || name.slice(0, 2).toUpperCase()
}

export default function ScoreCard({ game, compact = false, featured = false }: ScoreCardProps) {
  const homeTeam = game.home_team
  const awayTeam = game.away_team
  const homeSchool = homeTeam?.school
  const awaySchool = awayTeam?.school

  const homeName = homeSchool?.school_name || game.external_home?.name || 'TBD'
  const awayName = awaySchool?.school_name || game.external_away?.name || 'TBD'

  const isFinal = game.status === 'Final'
  const isLive = game.status === 'Live'
  const isScheduled = game.status === 'Scheduled'
  const homeWins = isFinal && game.home_score != null && game.away_score != null && game.home_score > game.away_score
  const awayWins = isFinal && game.home_score != null && game.away_score != null && game.away_score > game.home_score
  const close = isCloseGame(game.home_score, game.away_score)
  const sportMeta = getSportMeta(game.sport?.sport_name, game.sport?.gender)

  const statusBadge = () => {
    if (isLive) return <span className="flex items-center gap-1 text-xs font-bold text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />LIVE</span>
    if (isFinal) return <span className="text-xs font-semibold text-green-400 tracking-wide">FINAL</span>
    if (game.status === 'Postponed') return <span className="text-xs font-medium text-yellow-500">PPD</span>
    if (game.status === 'Canceled') return <span className="text-xs font-medium text-red-500/70">CANCELED</span>
    return game.game_time
      ? <span className="text-xs text-slate-400">{game.game_time}</span>
      : <span className="text-xs text-slate-500">SCHEDULED</span>
  }

  // COMPACT — used in recent results lists
  if (compact) {
    return (
      <Link href={`/games/${game.id}`} className="block group">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
          <div className="text-base w-5 text-center flex-shrink-0">{sportMeta.icon}</div>
          <div className="flex-1 min-w-0">
            <div className={`flex items-center justify-between gap-2 ${awayWins ? '' : isFinal ? 'opacity-50' : ''}`}>
              <span className={`text-sm truncate ${awayWins ? 'text-white font-semibold' : 'text-slate-400'}`}>{awayName}</span>
              {(isFinal || isLive) && <span className={`font-mono font-bold text-sm tabular-nums ${awayWins ? 'text-white' : 'text-slate-500'}`}>{game.away_score}</span>}
            </div>
            <div className={`flex items-center justify-between gap-2 mt-0.5 ${homeWins ? '' : isFinal ? 'opacity-50' : ''}`}>
              <span className={`text-sm truncate ${homeWins ? 'text-white font-semibold' : 'text-slate-400'}`}>{homeName}</span>
              {(isFinal || isLive) && <span className={`font-mono font-bold text-sm tabular-nums ${homeWins ? 'text-white' : 'text-slate-500'}`}>{game.home_score}</span>}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            {statusBadge()}
            {close && isFinal && <div className="text-xs text-amber-400 mt-0.5">🔥</div>}
          </div>
        </div>
      </Link>
    )
  }

  // FULL card
  return (
    <Link href={`/games/${game.id}`} className="block group">
      <div
        className={`rounded-xl overflow-hidden border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 ${
          featured
            ? 'border-yellow-500/30'
            : 'border-white/8 hover:border-white/16'
        }`}
        style={{
          background: featured
            ? 'linear-gradient(135deg, rgba(234,179,8,0.06), rgba(255,255,255,0.02))'
            : 'rgba(255,255,255,0.025)',
          borderLeft: isFinal
            ? `3px solid ${homeWins ? (homeSchool?.primary_color || '#1e3a5f') : awayWins ? (awaySchool?.primary_color || '#1e3a5f') : 'rgba(255,255,255,0.08)'}`
            : isLive
            ? '3px solid #ef4444'
            : '3px solid rgba(255,255,255,0.06)',
        }}
      >

        {/* Sport + status bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{sportMeta.icon}</span>
            <span className="text-xs font-medium" style={{ color: sportMeta.color }}>
              {game.sport?.sport_name}
              {game.game_number ? ` · Game ${game.game_number}` : ''}
            </span>
            {game.game_of_the_night && (
              <span className="text-xs text-yellow-400 font-medium">⭐ GOTN</span>
            )}
            {close && isFinal && (
              <span className="text-xs text-amber-400">🔥 Close</span>
            )}
          </div>
          <div className="flex-shrink-0">{statusBadge()}</div>
        </div>

        {/* Teams + scores */}
        <div className="px-4 pb-4 pt-2 space-y-1.5">
          {/* Away */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: awaySchool?.primary_color || '#1e3a5f' }}
            >
              {TeamInitials(awayName)}
            </div>
            <span className={`flex-1 truncate font-display transition-colors ${
              awayWins ? 'text-white font-bold text-base' :
              isFinal ? 'text-slate-500 font-medium text-sm' :
              'text-slate-200 font-medium text-sm'
            }`}>
              {awayName}
            </span>
            {(isFinal || isLive) && (
              <span className={`font-mono tabular-nums flex-shrink-0 ${
                awayWins ? 'text-white font-bold text-2xl' : 'text-slate-500 text-xl font-semibold'
              }`}>
                {game.away_score ?? '—'}
              </span>
            )}
            {isScheduled && game.game_time && !isFinal && (
              <span className="text-slate-500 text-sm">—</span>
            )}
          </div>

          {/* Divider */}
          <div className="ml-11 h-px bg-white/5" />

          {/* Home */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: homeSchool?.primary_color || '#1e3a5f' }}
            >
              {TeamInitials(homeName)}
            </div>
            <span className={`flex-1 truncate font-display transition-colors ${
              homeWins ? 'text-white font-bold text-base' :
              isFinal ? 'text-slate-500 font-medium text-sm' :
              'text-slate-200 font-medium text-sm'
            }`}>
              {homeName}
            </span>
            {(isFinal || isLive) && (
              <span className={`font-mono tabular-nums flex-shrink-0 ${
                homeWins ? 'text-white font-bold text-2xl' : 'text-slate-500 text-xl font-semibold'
              }`}>
                {game.home_score ?? '—'}
              </span>
            )}
            {isScheduled && game.game_time && !isFinal && (
              <span className="text-slate-500 text-sm">—</span>
            )}
          </div>

          {/* Location / notes */}
          {(game.location || game.notes) && (
            <p className="ml-11 text-xs text-slate-600 pt-1 truncate">
              {game.location && `📍 ${game.location}`}
              {game.notes && ` · ${game.notes}`}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
