'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, ExternalLink, SlidersHorizontal } from 'lucide-react'
import AdminLayout from '@/components/layout/AdminLayout'
import { createClient } from '@/lib/supabase/client'

export default function GameCenterAdminIndex() {
  const supabase = createClient()
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('Final')

  useEffect(() => {
    async function load() {
      setLoading(true)
      let q = supabase
        .from('games')
        .select(`
          id, game_date, game_time, status, home_score, away_score, recap,
          sport:sports(sport_name),
          home_team:teams!games_home_team_id_fkey(school:schools(school_name)),
          away_team:teams!games_away_team_id_fkey(school:schools(school_name)),
          external_home:external_opponents!games_external_home_opponent_id_fkey(name),
          external_away:external_opponents!games_external_away_opponent_id_fkey(name)
        `)
        .order('game_date', { ascending: false })
        .order('game_time', { ascending: false })
        .limit(150)
      if (status) q = q.eq('status', status)
      const { data } = await q
      setGames(data || [])
      setLoading(false)
    }
    load()
  }, [status])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return games
    return games.filter(game => {
      const home = game.home_team?.school?.school_name || game.external_home?.name || ''
      const away = game.away_team?.school?.school_name || game.external_away?.name || ''
      return home.toLowerCase().includes(q) || away.toLowerCase().includes(q) || (game.sport?.sport_name || '').toLowerCase().includes(q)
    })
  }, [games, search])

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="mb-5">
          <div className="text-xs uppercase tracking-[0.18em] text-blue-400 font-black mb-1">Content + Data</div>
          <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Game Center Editor</h1>
          <p className="text-sm text-slate-400 mt-1">Add period scoring, team stats, player stats and recaps without changing the final score or standings.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 mb-5">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input w-full pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search school or sport..." />
          </div>
          <select className="input w-full" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="Final">Final Games</option>
            <option value="Scheduled">Scheduled Games</option>
            <option value="Live">Live Games</option>
            <option value="">All Games</option>
          </select>
        </div>

        {loading ? <div className="card p-10 text-center text-slate-500">Loading games...</div> : filtered.length === 0 ? <div className="card p-10 text-center text-slate-500">No games found.</div> : (
          <div className="space-y-2">
            {filtered.map(game => {
              const home = game.home_team?.school?.school_name || game.external_home?.name || 'TBD'
              const away = game.away_team?.school?.school_name || game.external_away?.name || 'TBD'
              return (
                <div key={game.id} className="card p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs uppercase tracking-widest text-blue-400 font-black">{game.sport?.sport_name || 'Sport'}</span>
                      <span className="text-xs text-slate-600">{game.game_date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${game.status === 'Final' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'}`}>{game.status}</span>
                      {game.recap && <span className="text-xs text-emerald-400">Recap ✓</span>}
                    </div>
                    <div className="mt-1 text-base font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{away} at {home}</div>
                    <div className="text-sm text-slate-500 mt-0.5">{game.away_score ?? '—'} - {game.home_score ?? '—'}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/admin/game-center/${game.id}`} className="btn-primary flex items-center gap-2"><SlidersHorizontal size={14} /> Edit Game Center</Link>
                    <Link href={`/game-center/${game.id}`} target="_blank" className="btn-ghost flex items-center gap-2"><ExternalLink size={14} /> View</Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
