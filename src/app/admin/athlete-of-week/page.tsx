// src/app/admin/athlete-of-week/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Save, Plus, Star, Trash2 } from 'lucide-react'

const supabase = createClient()

export default function AthleteOfWeekAdmin() {
  const [athletes, setAthletes] = useState<any[]>([])
  const [nominations, setNominations] = useState<any[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState<'featured' | 'nominations'>('featured')

  const blank = {
    athlete_name: '', school_id: '', sport_name: '', grade: '',
    stats: '', body: '', photo_url: '', week_of: new Date().toISOString().split('T')[0],
    published: false,
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: a }, { data: n }, { data: s }] = await Promise.all([
      supabase.from('athlete_of_week').select('*, school:schools(school_name)').order('week_of', { ascending: false }),
      supabase.from('athlete_nominations').select('*').order('created_at', { ascending: false }),
      supabase.from('schools').select('id, school_name').order('school_name'),
    ])
    setAthletes(a || [])
    setNominations(n || [])
    setSchools(s || [])
    setLoading(false)
  }

  async function save() {
    if (!editing?.athlete_name || !editing?.body) { setMsg('Name and story are required.'); return }
    setSaving(true)
    if (editing.id) {
      await supabase.from('athlete_of_week').update({
        ...editing, school_id: editing.school_id || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id)
    } else {
      await supabase.from('athlete_of_week').insert({
        ...editing, school_id: editing.school_id || null,
      })
    }
    setMsg('Saved!')
    setTimeout(() => setMsg(''), 3000)
    setEditing(null)
    load()
    setSaving(false)
  }

  async function togglePublished(id: string, current: boolean) {
    if (!current) {
      // Unpublish all others first — only one published at a time
      await supabase.from('athlete_of_week').update({ published: false }).neq('id', id)
    }
    await supabase.from('athlete_of_week').update({ published: !current }).eq('id', id)
    load()
  }

  async function markNomReviewed(id: string) {
    await supabase.from('athlete_nominations').update({ reviewed: true }).eq('id', id)
    load()
  }

  async function promoteNomination(nom: any) {
    setEditing({
      ...blank,
      athlete_name: nom.athlete_name,
      sport_name: nom.sport_name,
      grade: nom.grade || '',
      body: nom.achievement,
    })
    setTab('featured')
    markNomReviewed(nom.id)
  }

  return (
    <AdminLayout>
      <div className="p-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
            🏅 Athlete of the Week
          </h1>
          {msg && <span className="text-sm text-green-400">{msg}</span>}
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Feature one athlete per week. Published athlete shows on the homepage.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {(['featured', 'nominations'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest transition-all"
              style={{
                fontFamily: 'var(--font-display)',
                background: tab === t ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)',
                color: tab === t ? '#60a5fa' : '#4a5f7a',
                border: `1px solid ${tab === t ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              {t === 'nominations' ? `Nominations (${nominations.filter(n => !n.reviewed).length})` : 'Featured Athletes'}
            </button>
          ))}
        </div>

        {tab === 'featured' && (
          <>
            {/* Add/Edit form */}
            {editing ? (
              <div className="card p-5 mb-5 space-y-3">
                <p className="text-sm font-bold text-white">{editing.id ? 'Edit Athlete' : 'Feature New Athlete'}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Athlete Name *</label>
                    <input className="input w-full" placeholder="First Last"
                      value={editing.athlete_name}
                      onChange={e => setEditing((p: any) => ({ ...p, athlete_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">School</label>
                    <select className="input w-full" value={editing.school_id}
                      onChange={e => setEditing((p: any) => ({ ...p, school_id: e.target.value }))}>
                      <option value="">Select school...</option>
                      {schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Sport</label>
                    <input className="input w-full" placeholder="e.g. Baseball"
                      value={editing.sport_name}
                      onChange={e => setEditing((p: any) => ({ ...p, sport_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Grade</label>
                    <input className="input w-full" placeholder="e.g. Senior, Junior"
                      value={editing.grade}
                      onChange={e => setEditing((p: any) => ({ ...p, grade: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Stats / Achievement</label>
                    <input className="input w-full" placeholder="e.g. 14 Ks, 2-hit shutout vs Massena"
                      value={editing.stats}
                      onChange={e => setEditing((p: any) => ({ ...p, stats: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Story *</label>
                    <textarea className="input w-full h-32 resize-none"
                      placeholder="Write 2-3 sentences about this athlete's performance..."
                      value={editing.body}
                      onChange={e => setEditing((p: any) => ({ ...p, body: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Week Of</label>
                    <input type="date" className="input w-full" value={editing.week_of}
                      onChange={e => setEditing((p: any) => ({ ...p, week_of: e.target.value }))}
                      style={{ colorScheme: 'dark' }} />
                  </div>
                  <div>
                    <label className="label">Photo URL (optional)</label>
                    <input className="input w-full" placeholder="https://..."
                      value={editing.photo_url}
                      onChange={e => setEditing((p: any) => ({ ...p, photo_url: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.published}
                      onChange={e => setEditing((p: any) => ({ ...p, published: e.target.checked }))} />
                    <span className="text-sm text-slate-300">⭐ Publish to homepage</span>
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
                  <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
                    <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setEditing(blank)} className="btn-primary flex items-center gap-2 mb-5">
                <Plus size={14} /> Feature New Athlete
              </button>
            )}

            {/* Athletes list */}
            {loading ? <div className="text-center py-8 text-slate-500">Loading...</div> : (
              <div className="space-y-2">
                {athletes.length === 0 && <div className="card p-8 text-center text-slate-500">No athletes featured yet.</div>}
                {athletes.map(a => (
                  <div key={a.id} className={`card p-4 flex items-start gap-3 ${a.published ? 'border-yellow-400/20' : ''}`}
                    style={a.published ? { background: 'rgba(251,191,36,0.04)' } : {}}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{a.athlete_name}</p>
                        {a.published && <span className="text-xs text-yellow-400">⭐ Featured</span>}
                        <span className="text-xs text-slate-500">{a.sport_name}</span>
                        <span className="text-xs text-slate-600">{a.school?.school_name}</span>
                      </div>
                      {a.stats && <p className="text-xs text-blue-400 mb-1">{a.stats}</p>}
                      <p className="text-xs text-slate-500 line-clamp-2">{a.body}</p>
                      <p className="text-xs text-slate-700 mt-1">Week of {new Date(a.week_of + 'T12:00:00').toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => togglePublished(a.id, a.published)}
                        className={`p-1.5 transition-colors ${a.published ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400'}`}
                        title="Toggle featured">
                        <Star size={14} />
                      </button>
                      <button onClick={() => setEditing(a)} className="p-1.5 text-slate-400 hover:text-white text-sm">✏️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'nominations' && (
          <div className="space-y-2">
            {nominations.length === 0 && <div className="card p-8 text-center text-slate-500">No nominations yet.</div>}
            {nominations.map(n => (
              <div key={n.id} className={`card p-4 ${n.reviewed ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{n.athlete_name}</p>
                      <span className="text-xs text-slate-500">{n.school_name} · {n.sport_name}</span>
                      {n.grade && <span className="text-xs text-slate-600">{n.grade}</span>}
                    </div>
                    <p className="text-xs text-slate-300 mb-1">{n.achievement}</p>
                    {n.nominator_name && <p className="text-xs text-slate-600">Nominated by {n.nominator_name}{n.nominator_email ? ` (${n.nominator_email})` : ''}</p>}
                    <p className="text-xs text-slate-700 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                  {!n.reviewed && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => promoteNomination(n)}
                        className="text-xs px-2 py-1 rounded font-bold"
                        style={{ background: 'rgba(37,99,235,0.2)', color: '#60a5fa' }}>
                        Feature →
                      </button>
                      <button onClick={() => markNomReviewed(n.id)}
                        className="text-xs px-2 py-1 rounded text-slate-600 hover:text-slate-400">
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
