'use client'

interface PlayoffGame {
  id: string
  round: number
  position: number
  seed_home: number | null
  seed_away: number | null
  home_name: string | null
  away_name: string | null
  home_score: number | null
  away_score: number | null
  status: string
  game_date: string | null
  game_time: string | null
  location: string | null
}

interface Tournament {
  id: string
  name: string
  class: string
  status: string
}

interface Props {
  tournament: Tournament
  games: PlayoffGame[]
}

function formatDate(d: string | null) {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(t: string | null) {
  if (!t) return ''
  try {
    const [h, m] = t.split(':').map(Number)
    const pm = h < 8 || h >= 12
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`
  } catch { return t }
}

function MatchupCard({ game, label }: { game: PlayoffGame | null, label: string }) {
  const isFinal = game?.status === 'final'
  const homeName = game?.home_name || (game?.seed_home ? `#${game.seed_home} Seed` : 'TBD')
  const awayName = game?.away_name || (game?.seed_away ? `#${game.seed_away} Seed` : 'TBD')
  const homeWins = isFinal && game.home_score != null && game.away_score != null && game.home_score > game.away_score
  const awayWins = isFinal && game.home_score != null && game.away_score != null && game.away_score > game.home_score

  return (
    <div className="rounded-xl overflow-hidden border"
      style={{
        background: 'rgba(8,12,20,0.85)',
        border: isFinal ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.08)',
      }}>
      {/* Round label */}
      <div className="px-3 py-1.5 border-b flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <span className="text-xs font-black text-slate-500 uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-display)' }}>{label}</span>
        {isFinal
          ? <span className="text-xs font-black text-emerald-400" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>FINAL</span>
          : game?.game_date
          ? <span className="text-xs text-blue-400">{formatDate(game.game_date)}{game.game_time ? ` · ${formatTime(game.game_time)}` : ''}</span>
          : <span className="text-xs text-slate-700">TBD</span>
        }
      </div>

      {/* Away */}
      <div className={`flex items-center px-3 py-2.5 border-b ${isFinal && !awayWins ? 'opacity-40' : ''}`}
        style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {game?.seed_away && (
          <span className="w-6 text-xs font-bold text-slate-600 flex-shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
            #{game.seed_away}
          </span>
        )}
        <span className="flex-1 text-sm font-bold truncate"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em', color: awayWins ? '#f0f4ff' : isFinal ? '#6b7a8d' : '#cbd5e1' }}>
          {awayName}
        </span>
        {isFinal && (
          <span className="font-mono font-black text-lg ml-3 flex-shrink-0"
            style={{ color: awayWins ? '#ffffff' : '#374151' }}>
            {game.away_score}
          </span>
        )}
      </div>

      {/* Home */}
      <div className={`flex items-center px-3 py-2.5 ${isFinal && !homeWins ? 'opacity-40' : ''}`}>
        {game?.seed_home && (
          <span className="w-6 text-xs font-bold text-slate-600 flex-shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
            #{game.seed_home}
          </span>
        )}
        <span className="flex-1 text-sm font-bold truncate"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em', color: homeWins ? '#f0f4ff' : isFinal ? '#6b7a8d' : '#cbd5e1' }}>
          {homeName}
        </span>
        {isFinal && (
          <span className="font-mono font-black text-lg ml-3 flex-shrink-0"
            style={{ color: homeWins ? '#ffffff' : '#374151' }}>
            {game.home_score}
          </span>
        )}
      </div>

      {game?.location && (
        <div className="px-3 pb-2 text-xs text-slate-700">📍 {game.location}</div>
      )}
    </div>
  )
}

export default function BracketView({ tournament, games }: Props) {
  const rounds = [1, 2, 3, 4].filter(r => games.some(g => g.round === r))
  const maxRound = Math.max(...rounds, 1)

  const roundLabels: Record<number, string> = {
    1: maxRound >= 3 ? 'Quarterfinal' : 'Semifinal',
    2: maxRound >= 3 ? 'Semifinal' : 'Final',
    3: maxRound >= 4 ? 'Semifinal' : 'Final',
    4: 'Final',
  }

  const getGame = (round: number, position: number) =>
    games.find(g => g.round === round && g.position === position) || null

  return (
    <div className="rounded-2xl overflow-hidden border border-white/8"
      style={{ background: 'rgba(5,8,15,0.8)' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'linear-gradient(135deg, rgba(37,99,235,0.1), transparent)' }}>
        <div>
          <span className="text-xs font-black text-blue-400 uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-display)' }}>Class {tournament.class}</span>
          <h3 className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
            {tournament.name}
          </h3>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider`}
          style={{
            fontFamily: 'var(--font-display)',
            background: tournament.status === 'complete' ? 'rgba(34,197,94,0.15)' :
              tournament.status === 'active' ? 'rgba(239,68,68,0.15)' : 'rgba(37,99,235,0.15)',
            color: tournament.status === 'complete' ? '#4ade80' :
              tournament.status === 'active' ? '#f87171' : '#60a5fa',
          }}>
          {tournament.status}
        </div>
      </div>

      {/* Bracket */}
      <div className="p-4">
        {rounds.length === 0 && (
          <p className="text-center text-slate-600 text-sm py-4">No games set yet.</p>
        )}

        {/* Show bracket rounds */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {rounds.map(round => {
            const positionsInRound = games.filter(g => g.round === round).map(g => g.position)
            const maxPos = Math.max(...positionsInRound, 0)
            const positions = Array.from({ length: Math.max(maxPos, 1) }, (_, i) => i + 1)

            return (
              <div key={round} className="flex-shrink-0" style={{ minWidth: '200px' }}>
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 text-center"
                  style={{ fontFamily: 'var(--font-display)' }}>
                  {roundLabels[round] || `Round ${round}`}
                </p>
                <div className="space-y-3">
                  {positions.map(pos => (
                    <MatchupCard
                      key={pos}
                      game={getGame(round, pos)}
                      label={`Game ${pos}`}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
