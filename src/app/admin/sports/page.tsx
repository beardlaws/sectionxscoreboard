'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Save, Plus, Trash2 } from 'lucide-react'

const supabase = createClient()

const SEASON_TYPES = ['Spring', 'Fall', 'Winter']
const GENDERS = ['Boys', 'Girls', 'Both']

export default function AdminSportsPage() {
  const [sports, setSports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const blank = {
    sport_name: '', gender: 'Boys', season_type: 'Fall', slug: '',
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('sports')
      .select('*')
      .order('season_type')
      .order('sport_name')
    setSports(data || [])
    setLoading(false)
  }

  function makeSlug(name: string, gender: string) {
    const prefix = gender === 'Boys' ? 'boys-' : gender === 'Girls' ? 'girls-' : ''
    return prefix + name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  async function save() {
    if (!editing?.sport_name) { setMsg('Sport name is required'); return }
    setSaving(true)
    const slug = editing.slug || makeSlug(editing.sport_name, editing.gender)
    if (editing.id) {
      const { error } = await supabase.from('sports').update({
        sport_name: editing.sport_name,
        gender: editing.gender,
        season_type: editing.season_type,
        slug,
      }).eq('id', editing.id)
      if (error) { setMsg('Error: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('sports').insert({
        sport_name: editing.sport_name,
        gender: editing.gender,
        season_type: editing.season_type,
        slug,
      })
      if (error) { setMsg('Error: ' + error.message); setSaving(false); return }
    }
    setMsg('Saved!')
    setTimeout(() => setMsg(''), 3000)
    setEditing(null)
    load()
    setSaving(false)
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete ${name}? This will also delete all associated teams and games.`)) return
    await supabase.from('sports').delete().eq('id', id)
    load()
  }

  const grouped = SEASON_TYPES.reduce((acc, s) => {
    acc[s] = sports.filter(sp => sp.season_type === s)
    return acc
  }, {} as Record<string, any[]>)

  const SEASON_COLORS: Record<string, string> = {
    Spring: '#4ade80', Fall: '#fbbf24', Winter: '#60a5fa',
  }

  return (
    <AdminLayout>
      <div className="p-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Sports</h1>
          {msg && <span className={`text-sm ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
        </div>
        <p className="text-slate-400 text-sm mb-5">Manage all sports. Adding a sport here makes it available for teams and games.</p>

        {/* Add/Edit form */}
        {editing ? (
          <div className="card p-5 mb-5 space-y-3">
            <p className="text-sm font-bold text-white">{editing.id ? 'Edit Sport' : 'Add New Sport'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Sport Name *</label>
                <input className="input w-full" placeholder="e.g. Baseball, Swimming"
                  value={editing.sport_name}
                  onChange={e => setEditing((p: any) => ({
                    ...p,
                    sport_name: e.target.value,
                    slug: makeSlug(e.target.value, p.gender)
                  }))} />
              </div>
              <div>
                <label className="label">Gender</label>
                <select className="input w-full" value={editing.gender}
                  onChange={e => setEditing((p: any) => ({
                    ...p,
                    gender: e.target.value,
                    slug: makeSlug(p.sport_name, e.target.value)
                  }))}>
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Season</label>
                <select className="input w-full" value={editing.season_type}
                  onChange={e => setEditing((p: any) => ({ ...p, season_type: e.target.value }))}>
                  {SEASON_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Slug (auto-generated)</label>
                <input className="input w-full" value={editing.slug}
                  onChange={e => setEditing((p: any) => ({ ...p, slug: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
                <Save size={14} /> {saving ? 'Saving...' : 'Save Sport'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditing(blank)} className="btn-primary flex items-center gap-2 mb-5">
            <Plus size={14} /> Add Sport
          </button>
        )}

        {/* Sports list grouped by season */}
        {loading ? <div className="text-center py-8 text-slate-500">Loading...</div> : (
          <div className="space-y-6">
            {SEASON_TYPES.map(season => (
              <div key={season}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{
                      color: SEASON_COLORS[season],
                      background: `${SEASON_COLORS[season]}18`,
                      fontFamily: 'var(--font-display)',
                    }}>
                    {season}
                  </span>
                  <div className="flex-1 h-px bg-white/6" />
                </div>
                {grouped[season].length === 0 && (
                  <p className="text-xs text-slate-600 pl-2">No {season.toLowerCase()} sports yet.</p>
                )}
                <div className="space-y-1">
                  {grouped[season].map(sport => (
                    <div key={sport.id} className="card p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                            {sport.gender !== 'Both' ? `${sport.gender} ` : ''}{sport.sport_name}
                          </p>
                          <span className="text-xs text-slate-600 font-mono">{sport.slug}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setEditing(sport)}
                          className="p-1.5 text-slate-400 hover:text-white text-sm">✏️</button>
                        <button onClick={() => del(sport.id, sport.sport_name)}
                          className="p-1.5 text-slate-600 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
