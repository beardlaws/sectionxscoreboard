import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'

export const dynamic = 'force-dynamic'

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data: t } = await supabase.from('playoff_tournaments').select('name').eq('id', params.id).single()
  return { title: t ? `${t.name} | Section X Playoffs` : 'Playoffs' }
}

function fmt(d: string | null, t: string | null) {
  if (!d) return null
  const date = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!t) return date
  try {
    const [h, m] = t.split(':').map(Number)
    const pm = h < 8 || h >= 12
    return `${date} · ${h % 12 || 12}:${String(m).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`
  } catch { return date }
}

function MatchupCard({ game }: { game: any }) {
  const isFinal = game?.status === 'final'
  const away = game?.away_name || (game?.seed_away ? `#${game.seed_away} Seed` : 'TBD')
  const home = game?.home_name || (game?.seed_home ? `#${game.seed_home} Seed` : 'TBD')
  const homeWins = isFinal && game.home_score != null && game.away_score != null && game.home_score > game.away_score
  const awayWins = isFinal && game.home_score != null && game.away_score != null && game.away_score > game.home_score
  const when = fmt(game?.game_date, game?.game_time)

  return (
    <div className="rounded-xl overflow-hidden w-56 flex-shrink-0"
      style={{ border: isFinal ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.1)', background: 'rgba(8,12,20,0.95)' }}>
      {when && (
        <div className="px-3 py-1 text-xs border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', color: isFinal ? '#4ade80' : '#60a5fa' }}>
          {isFinal ? 'FINAL' : when}
        </div>
      )}
      {!when && isFinal && (
        <div className="px-3 py-1 text-xs border-b text-emerald-400 font-black" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(34,197,94,0.05)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>FINAL</div>
      )}
      {/* Away */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${isFinal && !awayWins ? 'opacity-35' : ''}`}
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {game?.seed_away != null && <span className="text-xs font-black text-slate-500 w-5 flex-shrink-0 text-center">#{game.seed_away}</span>}
        <span className="flex-1 text-sm font-bold truncate" style={{ fontFamily: 'var(--font-display)', color: awayWins ? '#f0f4ff' : isFinal ? '#52637a' : '#cbd5e1' }}>{away}</span>
        {isFinal && <span className="font-mono font-black text-base flex-shrink-0" style={{ color: awayWins ? '#ffffff' : '#2d3d55' }}>{game.away_score}</span>}
      </div>
      {/* Home */}
      <div className={`flex items-center gap-2 px-3 py-2.5 ${isFinal && !homeWins ? 'opacity-35' : ''}`}>
        {game?.seed_home != null && <span className="text-xs font-black text-slate-500 w-5 flex-shrink-0 text-center">#{game.seed_home}</span>}
        <span className="flex-1 text-sm font-bold truncate" style={{ fontFamily: 'var(--font-display)', color: homeWins ? '#f0f4ff' : isFinal ? '#52637a' : '#cbd5e1' }}>{home}</span>
        {isFinal && <span className="font-mono font-black text-base flex-shrink-0" style={{ color: homeWins ? '#ffffff' : '#2d3d55' }}>{game.home_score}</span>}
      </div>
      {game?.location && <div className="px-3 pb-2 text-xs text-slate-700 truncate">📍 {game.location}</div>}
    </div>
  )
}

export default async function BracketPage({ params }: Props) {
  const supabase = createClient()
  const { data: tournament } = await supabase
    .from('playoff_tournaments')
    .select('*, sport:sports(sport_name,gender), season:seasons(name)')
    .eq('id', params.id).single()
  if (!tournament) notFound()

  const { data: games } = await supabase
    .from('playoff_games').select('*')
    .eq('tournament_id', params.id)
    .order('round').order('position')

  const rounds = [...new Set((games || []).map(g => g.round))].sort((a, b) => a - b)
  const ROUND_NAMES: Record<number, string> = { 0: 'Play-in', 1: 'Quarterfinals', 2: 'Semifinals', 3: 'Final' }

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <Link href="/playoffs" className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-1 block">← All Brackets</Link>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <div>
                <p className="text-xs font-black text-blue-400 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
                  Class {tournament.class} · {tournament.sport?.gender} {tournament.sport?.sport_name}
                </p>
                <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
                  {tournament.name}
                </h1>
                <p className="text-slate-500 text-sm">{tournament.season?.name}</p>
              </div>
            </div>
          </div>
          <span className="text-sm font-black px-3 py-1.5 rounded-full uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              background: tournament.status === 'complete' ? 'rgba(34,197,94,0.15)' : tournament.status === 'active' ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.12)',
              color: tournament.status === 'complete' ? '#4ade80' : tournament.status === 'active' ? '#f87171' : '#60a5fa',
            }}>{tournament.status}</span>
        </div>

        {rounds.length === 0 ? (
          <div className="rounded-2xl p-16 text-center border border-white/6" style={{ background: 'rgba(8,12,20,0.7)' }}>
            <p className="text-5xl mb-3">🏆</p>
            <p className="text-white font-black text-lg" style={{ fontFamily: 'var(--font-display)' }}>Bracket Coming Soon</p>
            <p className="text-slate-500 text-sm mt-1">Matchups will appear here once seedings are set.</p>
          </div>
        ) : (
          /* Bracket layout - rounds side by side with visual connectors */
          <div className="relative">
            {/* Mobile: stacked rounds */}
            <div className="md:hidden space-y-6">
              {rounds.map(round => {
                const roundGames = (games || []).filter(g => g.round === round).sort((a, b) => a.position - b.position)
                return (
                  <div key={round}>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3"
                      style={{ fontFamily: 'var(--font-display)' }}>{ROUND_NAMES[round] || `Round ${round}`}</p>
                    <div className="space-y-3">
                      {roundGames.map(g => <MatchupCard key={g.id} game={g} />)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop: horizontal bracket */}
            <div className="hidden md:flex gap-0 overflow-x-auto pb-4">
              {rounds.map((round, roundIdx) => {
                const roundGames = (games || []).filter(g => g.round === round).sort((a, b) => a.position - b.position)
                const isLast = roundIdx === rounds.length - 1
                const gamesInRound = roundGames.length
                const totalGames = Math.max(...rounds.map(r => (games || []).filter(g => g.round === r).length))

                return (
                  <div key={round} className="flex flex-shrink-0" style={{ minWidth: '240px' }}>
                    <div className="flex-1">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 text-center px-4"
                        style={{ fontFamily: 'var(--font-display)' }}>
                        {ROUND_NAMES[round] || `Round ${round}`}
                      </p>
                      <div className="flex flex-col justify-around" style={{ minHeight: `${totalGames * 120}px` }}>
                        {roundGames.map((g, i) => (
                          <div key={g.id} className="flex items-center px-4">
                            <MatchupCard game={g} />
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Connector lines between rounds */}
                    {!isLast && (
                      <div className="flex flex-col justify-around w-8 flex-shrink-0" style={{ minHeight: `${totalGames * 120}px` }}>
                        {roundGames.map((_, i) => (
                          <div key={i} className="flex items-center">
                            <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Champion display */}
        {tournament.status === 'complete' && (() => {
          const finalRound = Math.max(...rounds)
          const finalGame = (games || []).find(g => g.round === finalRound)
          if (!finalGame || finalGame.status !== 'final') return null
          const champion = finalGame.home_score > finalGame.away_score ? finalGame.home_name : finalGame.away_name
          return champion ? (
            <div className="mt-8 rounded-2xl p-6 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(8,12,20,0.9))', border: '1px solid rgba(234,179,8,0.3)' }}>
              <p className="text-yellow-400 text-4xl mb-2">🏆</p>
              <p className="text-xs font-black text-yellow-500 uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                {tournament.season?.name} Class {tournament.class} Champion
              </p>
              <p className="text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>{champion}</p>
            </div>
          ) : null
        })()}
      </div>
    </PublicLayout>
  )
}
