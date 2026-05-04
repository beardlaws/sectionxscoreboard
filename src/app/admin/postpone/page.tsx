'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminDb } from '@/lib/adminDb'
import AdminLayout from '@/components/layout/AdminLayout'
import { CloudRain, Save } from 'lucide-react'

export default function PostponePage() {
  const supabase = createClient()
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(0)
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setDateFilter(today)
    load(today)
  }, [])

  async function load(date?: string) {
    setLoading(true)
    let q = supabase.from('games')
      .select(`id, game_date, game_time, status,
        sport:sports(sport_name),
        home_team:teams!games_home_team_id_fkey(team_name, school:schools(school_name)),
        away_team:teams!games_away_team_id_fkey(team_name, school:schools(school_name))`)
      .in('status', ['Scheduled', 'Postponed'])
      .order('game_date').order('game_time')
    if (date) q = q.eq('game_date', date)
    const { data } = await q.limit(100)
    setGames(data || [])
    setSelected(new Set())
    setLoading(false)
  }

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function selectAll() {
    setSelected(new Set(games.map(g => g.id)))
  }

  async function markPostponed() {
    if (selected.size === 0) return
    setSaving(true)
    let count = 0
    for (const id of selected) {
      await adminDb.update('games', {
        status: 'Postponed',
        notes: rescheduleDate ? `Rescheduled to ${rescheduleDate}` : 'Postponed',
        ...(rescheduleDate ? { rescheduled_date: rescheduleDate } : {}),
      }, { id })
      count++
    }
    setDone(count)
    setSaving(false)
    setSelected(new Set())
    load(dateFilter)
    setTimeout(() => setDone(0), 3000)
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <CloudRain size={22} className="text-blue-400" />
          <h1 className="text-2xl font-bold font-display text-white">Rainout Manager</h1>
        </div>
        <p className="text-slate-400 text-sm mb-5">Select games to mark as postponed. Set a reschedule date if known.</p>

        {/* Controls */}
        <div className="card p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Game Date</label>
              <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); load(e.target.value) }}
                className="input w-full" />
            </div>
            <div>
              <label className="label">Reschedule To (optional)</label>
              <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                className="input w-full" />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={selectAll} className="btn-secondary text-xs">Select All ({games.length})</button>
            <button onClick={() => setSelected(new Set())} className="btn-ghost text-xs">Clear</button>
            <span className="text-slate-500 text-xs">{selected.size} selected</span>
            {done > 0 && <span className="text-green-400 text-xs font-bold">✓ {done} games updated</span>}
            <button onClick={markPostponed} disabled={selected.size === 0 || saving}
              className="btn-primary ml-auto flex items-center gap-2">
              <CloudRain size={14} />
              {saving ? 'Saving...' : `Mark ${selected.size} as PPD`}
            </button>
          </div>
        </div>

        {/* Games list */}
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : games.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">No scheduled games on this date.</div>
        ) : (
          <div className="space-y-1.5">
            {games.map(game => {
              const ht = game.home_team?.school?.school_name || '?'
              const at = game.away_team?.school?.school_name || '?'
              const isSel = selected.has(game.id)
              const isPpd = game.status === 'Postponed'
              return (
                <button key={game.id} onClick={() => toggle(game.id)}
                  className={`w-full text-left rounded-xl px-4 py-3 transition-all border ${
                    isSel ? 'border-blue-500/40 bg-blue-500/10' :
                    isPpd ? 'border-amber-500/20 bg-amber-500/5 opacity-60' :
                    'border-white/6 hover:border-white/12 bg-white/[0.02]'
                  }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${isSel ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                        {isSel && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                          {at} at {ht}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {game.sport?.sport_name} · {game.game_time?.slice(0,5) || 'TBD'}
                          {isPpd && ' · ⚠ Already PPD'}
                        </p>
                      </div>
                    </div>
                    {isPpd && <span className="text-xs font-bold text-amber-500 flex-shrink-0"
                      style={{ fontFamily: 'var(--font-display)' }}>PPD</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
