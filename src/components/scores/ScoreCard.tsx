// src/components/scores/ScoreCard.tsx
import Link from 'next/link'
import type { GameWithTeams } from '@/types'
import { STATUS_COLORS, isCloseGame } from '@/lib/constants'
import { format } from 'date-fns'

interface ScoreCardProps {
  game: GameWithTeams
  compact?: boolean
  highlightTeamId?: string
}

function TeamColorBlock({ color, name }: { color: string; name: string }) {
  const initials = name
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || name.slice(0, 2).toUpperCase()

  return (
    <div
      className="team-color-block flex-shrink-0"
      style={{ background: color || '#1e2d47', color: '#fff' }}
    >
      {initials}
    </div>
  )
}

export default function ScoreCard({ game, compact = false }: ScoreCardProps) {
  const homeTeam = game.home_team
  const awayTeam = game.away_team
  const homeSchool = homeTeam?.school
  const awaySchool = awayTeam?.school

  const homeName = homeSchool?.school_name || game.external_home?.name || 'TBD'
  const awayName = awaySchool?.school_name || game.external_away?.name || 'TBD'
  const homeAlias = homeSchool?.alias || homeName.slice(0, 4).toUpperCase()
  const awayAlias = awaySchool?.alias || awayName.slice(0, 4).toUpperCase()

  const isFinal = game.status === 'Final'
  const homeWins = isFinal && game.home_score !== null && game.away_score !== null && game.home_score > game.away_score
  const awayWins = isFinal && game.home_score !== null && game.away_score !== null && game.away_score > game.home_score
  const close = isCloseGame(game.home_score, game.away_score)

  const gameSlug = `${(awaySchool?.slug || 'away')}-vs-${(homeSchool?.slug || 'home')}-${game.sport?.slug || 'sport'}-${game.game_date}`

  if (compact) {
    return (
      <Link href={`/games/${game.id}`} className="block card-hover animate-fade-in">
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-medium truncate ${awayWins ? 'score-winner' : 'score-loser'}`}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {awayAlias}
                  </span>
                  {isFinal && (
                    <span className={`score-digit text-lg ml-2 ${awayWins ? 'score-winner' : 'score-loser'}`}>
                      {game.away_score ?? '-'}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-medium truncate ${homeWins ? 'score-winner' : 'score-loser'}`}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {homeAlias}
                  </span>
                  {isFinal && (
                    <span className={`score-digit text-lg ml-2 ${homeWins ? 'score-winner' : 'score-loser'}`}>
                      {game.home_score ?? '-'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={`badge ${game.status === 'Final' ? 'badge-final' : game.status === 'Live' ? 'badge-live' : game.status === 'Scheduled' ? 'badge-scheduled' : game.status === 'Postponed' ? 'badge-postponed' : 'badge-canceled'}`}>
                {game.status}
              </span>
              {close && isFinal && (
                <span className="text-xs" style={{ color: '#fbbf24' }}>🔥 Close</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/games/${game.id}`} className="block card-hover animate-score-in">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {game.sport?.sport_name}
              {game.game_time ? ` · ${game.game_time}` : ''}
            </span>
            {game.game_of_the_night && (
              <span className="badge" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                ⭐ Game of Night
              </span>
            )}
          </div>
          <span className={`badge ${game.status === 'Final' ? 'badge-final' : game.status === 'Live' ? 'badge-live' : game.status === 'Scheduled' ? 'badge-scheduled' : game.status === 'Postponed' ? 'badge-postponed' : 'badge-canceled'}`}>
            {game.status === 'Live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1" />}
            {game.status}
          </span>
        </div>

        {/* Teams */}
        <div className="space-y-2">
          {/* Away */}
          <div className="flex items-center gap-3">
            <TeamColorBlock color={awaySchool?.primary_color || '#1e2d47'} name={awayAlias} />
            <div className="flex-1 min-w-0">
              <div className={`font-semibold truncate ${awayWins ? 'score-winner' : 'score-loser'}`} style={{ fontFamily: 'var(--font-display)', fontSize: '15px' }}>
                {awayName}
              </div>
            </div>
            {(isFinal || game.status === 'Live') && (
              <span className={`score-digit text-2xl font-bold ${awayWins ? 'score-winner' : 'score-loser'}`}>
                {game.away_score ?? '-'}
              </span>
            )}
          </div>

          {/* Home */}
          <div className="flex items-center gap-3">
            <TeamColorBlock color={homeSchool?.primary_color || '#1e2d47'} name={homeAlias} />
            <div className="flex-1 min-w-0">
              <div className={`font-semibold truncate ${homeWins ? 'score-winner' : 'score-loser'}`} style={{ fontFamily: 'var(--font-display)', fontSize: '15px' }}>
                {homeName}
              </div>
            </div>
            {(isFinal || game.status === 'Live') && (
              <span className={`score-digit text-2xl font-bold ${homeWins ? 'score-winner' : 'score-loser'}`}>
                {game.home_score ?? '-'}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        {(game.location || close || game.notes) && (
          <div className="mt-3 pt-2 flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
            {game.location && <span>📍 {game.location}</span>}
            {close && isFinal && <span style={{ color: '#fbbf24' }}>🔥 Close game</span>}
            {game.notes && <span>{game.notes}</span>}
          </div>
        )}
      </div>
    </Link>
  )
}
