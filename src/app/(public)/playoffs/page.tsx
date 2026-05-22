import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'

export const metadata: Metadata = {
  title: 'Playoffs | Section X Scoreboard',
  description: 'Section X playoff brackets.',
}
export const dynamic = 'force-dynamic'

function formatDate(d: string | null) {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(t: string | null) {
  if (!t) return ''
  try {
    const [h, m] = t.split(':').map(Number)
    const pm = h < 8 || h >= 12
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`
  } catch { return t }
}

function Matchup({ game, label }: { game: any, label: string }) {
  const isFinal = game?.status === 'final'
  const away = game?.away_name || (game?.seed_away ? `#${game.seed_away} Seed` : 'TBD')
  const home = game?.home_name || (game?.seed_home ? `#${game.seed_home} Seed` : 'TBD')
  const homeWins = isFinal && game.home_score != null && game.away_score != null && game.home_score > game.away_score
  const awayWins = isFinal && game.home_score != null && game.away_score != null && game.away_score > game.home_score

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(8,12,20,0.9)', border: isFinal ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
        <span className="text-xs font-black text-slate-600 uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-display)' }}>{label}</span>
        {isFinal
          ? <span className="text-xs font-black text-emerald-400" style={{ fontFamily: 'var(--font-display)' }}>FINAL</span>
          : game?.game_date
          ? <span className="text-xs text-blue-400">{formatDate(game.game_date)}{game.game_time ? ` · ${formatTime(game.game_time)}` : ''}</span>
          : <span className="text-xs text-slate-700">TBD</span>
        }
      </div>
      {/* Away */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${isFinal && !awayWins ? 'opacity-40' : ''}`}
        style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {game?.seed_away && <span className="text-xs font-bold text-slate-600 w-5 flex-shrink-0">#{game.seed_away}</span>}
        <span className="flex-1 text-sm font-bold truncate"
          style={{ fontFamily: 'var(--font-display)', color: awayWins ? '#f0f4ff' : isFinal ? '#6b7a8d' : '#cbd5e1' }}>
          {away}
        </span>
        {isFinal && <span className="font-mono font-black text-lg ml-2" style={{ color: awayWins ? '#fff' : '#374151' }}>{game.away_score}</span>}
      </div>
      {/* Home */}
      <div className={`flex items-center gap-2 px-3 py-2.5 ${isFinal && !homeWins ? 'opacity-40' : ''}`}>
        {game?.seed_home && <span className="text-xs font-bold text-slate-600 w-5 flex-shrink-0">#{game.seed_home}</span>}
        <span className="flex-1 text-sm font-bold truncate"
          style={{ fontFamily: 'var(--font-display)', color: homeWins ? '#f0f4ff' : isFinal ? '#6b7a8d' : '#cbd5e1' }}>
          {home}
        </span>
        {isFinal && <span className="font-mono font-black text-lg ml-2" style={{ color: homeWins ? '#fff' : '#374151' }}>{game.home_score}</span>}
      </div>
      {game?.location && <div className="px-3 pb-2 text-xs text-slate-700">📍 {game.location}</div>}
    </div>
  )
}

export default async function PlayoffsPage() {
  const supabase = createClient()
  const { data: tournaments } = await supabase
    .from('playoff_tournaments')
    .select('*, sport:sports(sport_name,gender), season:seasons(name)')
    .order('class')
  const { data: allGames } = await supabase
    .from('playoff_games').select('*').order('round').order('position')

  const ICONS: Record<string, string> = {
    'Girls Softball': '🥎', 'Boys Baseball': '⚾',
    'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
    'Boys Basketball': '🏀', 'Girls Basketball': '🏀',
  }

  // Group by sport
  const bySport: Record<string, any[]> = {}
  for (const t of (tournaments || [])) {
    const key = `${t.sport?.gender} ${t.sport?.sport_name}`
    if (!bySport[key]) bySport[key] = []
    bySport[key].push(t)
  }

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🏆</span>
          <div>
            <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              Section X Playoffs
            </h1>
            <p className="text-slate-400 text-sm">Single elimination · Seeded by BTM</p>
          </div>
        </div>

        {Object.keys(bySport).length === 0 && (
          <div className="rounded-2xl p-16 text-center border border-white/6" style={{ background: 'rgba(8,12,20,0.7)' }}>
            <p className="text-5xl mb-4">🏆</p>
            <p className="text-white font-black text-xl" style={{ fontFamily: 'var(--font-display)' }}>Brackets Coming Soon</p>
            <p className="text-slate-500 text-sm mt-2">Playoff brackets will appear here once seedings are announced.</p>
          </div>
        )}

        {Object.entries(bySport).map(([sport, ts]) => (
          <div key={sport} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{ICONS[sport] || '🏆'}</span>
              <h2 className="text-2xl font-black text-white uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-display)' }}>{sport}</h2>
              <div className="flex-1 h-px bg-white/8 ml-2" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {ts.sort((a, b) => a.class.localeCompare(b.class)).map(t => {
                const tGames = (allGames || []).filter(g => g.tournament_id === t.id)
                const rounds = [...new Set(tGames.map(g => g.round))].sort((a,b) => a-b)
                const maxRound = rounds.length > 0 ? Math.max(...rounds) : 1

                const roundLabel = (r: number) => {
                  if (maxRound <= 2) return r === 1 ? 'Semifinals' : 'Final'
                  if (maxRound <= 3) return r === 1 ? 'Quarterfinals' : r === 2 ? 'Semifinals' : 'Final'
                  return r === 1 ? 'First Round' : r === 2 ? 'Quarterfinals' : r === 3 ? 'Semifinals' : 'Final'
                }

                return (
                  <div key={t.id} className="rounded-2xl overflow-hidden border border-white/8"
                    style={{ background: 'rgba(5,8,15,0.8)' }}>
                    {/* Header */}
                    <div className="px-5 py-4 border-b"
                      style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'linear-gradient(135deg,rgba(37,99,235,0.1),transparent)' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-0.5"
                            style={{ fontFamily: 'var(--font-display)' }}>Class {t.class}</p>
                          <h3 className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{t.name}</h3>
                        </div>
                        <span className="text-xs font-black px-2.5 py-1 rounded-full uppercase"
                          style={{
                            fontFamily: 'var(--font-display)',
                            background: t.status === 'complete' ? 'rgba(34,197,94,0.15)' : t.status === 'active' ? 'rgba(239,68,68,0.15)' : 'rgba(37,99,235,0.15)',
                            color: t.status === 'complete' ? '#4ade80' : t.status === 'active' ? '#f87171' : '#60a5fa',
                          }}>{t.status}</span>
                      </div>
                    </div>

                    {/* Rounds */}
                    <div className="p-4">
                      {rounds.length === 0 && (
                        <p className="text-center text-slate-600 text-sm py-6">Bracket coming soon.</p>
                      )}
                      <div className="flex gap-4 overflow-x-auto pb-1">
                        {rounds.map(round => {
                          const roundGames = tGames.filter(g => g.round === round).sort((a,b) => a.position - b.position)
                          return (
                            <div key={round} className="flex-shrink-0" style={{ minWidth: '220px' }}>
                              <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2 text-center"
                                style={{ fontFamily: 'var(--font-display)' }}>{roundLabel(round)}</p>
                              <div className="space-y-3">
                                {roundGames.map((g, i) => (
                                  <Matchup key={g.id} game={g} label={`Game ${i + 1}`} />
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </PublicLayout>
  )
}
