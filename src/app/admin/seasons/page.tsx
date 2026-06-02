'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Check, Archive } from 'lucide-react'

const supabase = createClient()

export default function AdminSeasonsPage() {
  const [seasons, setSeasons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [newSeason, setNewSeason] = useState({ name: '', year: new Date().getFullYear(), season_type: 'Fall', start_date: '', end_date: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('seasons').select('*').order('year', { ascending: false })
    setSeasons(data || [])
    setLoading(false)
  }

  async function setActive(id: string) {
    // Deactivate all first
    await supabase.from('seasons').update({ is_active: false }).neq('id', 'placeholder')
    // Activate selected
    await supabase.from('seasons').update({ is_active: true }).eq('id', id)
    notify('Active season updated!')
    load()
  }

  async function createSeason() {
    if (!newSeason.name || !newSeason.year) return
    setCreating(true)
    const { error } = await supabase.from('seasons').insert({
      name: newSeason.name,
      year: newSeason.year,
      season_type: newSeason.season_type,
      is_active: false,
      start_date: newSeason.start_date || null,
      end_date: newSeason.end_date || null,
    })
    if (error) alert(error.message)
    else { notify('Season created!'); load(); setNewSeason({ name: '', year: new Date().getFullYear(), season_type: 'Fall', start_date: '', end_date: '' }) }
    setCreating(false)
  }

  function notify(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const SEASON_COLORS: Record<string, string> = {
    Spring: 'rgba(34,197,94,0.15)',
    Fall: 'rgba(245,158,11,0.15)',
    Winter: 'rgba(59,130,246,0.15)',
  }
  const SEASON_TEXT: Record<string, string> = {
    Spring: '#4ade80', Fall: '#fbbf24', Winter: '#60a5fa',
  }

  return (
    <AdminLayout>
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Seasons</h1>
          {msg && <span className="text-sm text-green-400 flex items-center gap-1"><Check size={14} />{msg}</span>}
        </div>
        <p className="text-slate-400 text-sm mb-5">
          Manage seasons. Set one season as active — it's what the site shows by default.
          When a season ends, create the next one and switch the active flag.
        </p>

        {/* Create new season */}
        <div className="card p-4 mb-5">
          <p className="text-sm font-bold text-white mb-3">Create New Season</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Name</label>
              <input className="input w-full" placeholder="e.g. Fall 2026"
                value={newSeason.name}
                onChange={e => setNewSeason(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Year</label>
              <input type="number" className="input w-full" value={newSeason.year}
                onChange={e => setNewSeason(p => ({ ...p, year: parseInt(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Season Type</label>
              <select className="input w-full" value={newSeason.season_type}
                onChange={e => setNewSeason(p => ({ ...p, season_type: e.target.value }))}>
                <option value="Spring">Spring</option>
                <option value="Fall">Fall</option>
                <option value="Winter">Winter</option>
              </select>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input w-full" value={newSeason.start_date}
                onChange={e => setNewSeason(p => ({ ...p, start_date: e.target.value }))}
                style={{ colorScheme: 'dark' }} />
            </div>
          </div>
          <button onClick={createSeason} disabled={creating || !newSeason.name} className="btn-primary">
            {creating ? 'Creating...' : '+ Create Season'}
          </button>
        </div>

        {/* Seasons list */}
        {loading ? <div className="text-center py-8 text-slate-500">Loading...</div> : (
          <div className="space-y-2">
            {seasons.map(s => (
              <div key={s.id} className={`card p-4 flex items-center gap-4 ${s.is_active ? 'border-emerald-500/30' : ''}`}
                style={{ background: s.is_active ? 'rgba(34,197,94,0.04)' : undefined }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{s.name}</p>
                    {s.is_active && (
                      <span className="text-xs font-black text-emerald-400 px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.15)', fontFamily: 'var(--font-display)' }}>
                        ✓ ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{
                        background: SEASON_COLORS[s.season_type] || 'rgba(255,255,255,0.1)',
                        color: SEASON_TEXT[s.season_type] || '#94a3b8',
                        fontFamily: 'var(--font-display)',
                      }}>
                      {s.season_type}
                    </span>
                    <span className="text-xs text-slate-500">{s.year}</span>
                    {s.start_date && <span className="text-xs text-slate-600">{s.start_date} → {s.end_date || '?'}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!s.is_active && (
                    <button onClick={() => setActive(s.id)}
                      className="text-xs px-3 py-1.5 rounded-lg font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all"
                      style={{ fontFamily: 'var(--font-display)' }}>
                      Set Active
                    </button>
                  )}
                  {s.is_active && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <Check size={12} /> Current Season
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 rounded-xl p-4 border border-white/6" style={{ background: 'rgba(8,12,20,0.6)' }}>
          <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
            Season Workflow
          </p>
          <div className="space-y-1 text-xs text-slate-500">
            <p>1. At end of Spring 2026 — create "Fall 2026" season</p>
            <p>2. Click "Set Active" on Fall 2026 — site switches automatically</p>
            <p>3. Add teams to Fall 2026 via Teams admin (Football, Soccer, Volleyball)</p>
            <p>4. Import games as normal — they go into the active season</p>
            <p>5. Spring 2026 data stays in the database, just not shown by default</p>
            <p>6. Repeat for Winter 2026-27 (Basketball, Hockey, Wrestling)</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
