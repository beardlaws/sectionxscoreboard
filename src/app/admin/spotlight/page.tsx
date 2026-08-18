'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Save, Plus, Trash2, Star } from 'lucide-react'

const supabase = createClient()

export default function SpotlightAdmin() {
  const [stories, setStories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const blank = {
    title: '',
    body: '',
    author: 'Section X Scoreboard',
    school_slug: '',
    sport_name: '',
    published: true,
    featured: false,
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('spotlights')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setMsg('Load error: ' + error.message)
    setStories(data || [])
    setLoading(false)
  }

  async function save() {
    if (!editing?.title || !editing?.body) {
      setMsg('Title and body are required.')
      return
    }
    setSaving(true)
    setMsg('')

    if (editing.id) {
      const { error } = await supabase.from('spotlights').update({
        title: editing.title,
        body: editing.body,
        author: editing.author,
        school_slug: editing.school_slug || null,
        sport_name: editing.sport_name || null,
        published: editing.published,
        featured: editing.featured,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id)
      if (error) {
        setMsg('Save failed: ' + error.message)
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase.from('spotlights').insert({
        title: editing.title,
        body: editing.body,
        author: editing.author,
        school_slug: editing.school_slug || null,
        sport_name: editing.sport_name || null,
        published: editing.published,
        featured: editing.featured,
      })
      if (error) {
        setMsg('Save failed: ' + error.message)
        setSaving(false)
        return
      }
    }

    setMsg('Saved!')
    setTimeout(() => setMsg(''), 3000)
    setEditing(null)
    load()
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm('Delete this story?')) return
    const { error } = await supabase.from('spotlights').delete().eq('id', id)
    if (error) { setMsg('Delete failed: ' + error.message); return }
    load()
  }

  async function toggleFeatured(id: string, current: boolean) {
    // Only one featured at a time
    if (!current) {
      await supabase.from('spotlights').update({ featured: false }).neq('id', id)
    }
    await supabase.from('spotlights').update({ featured: !current }).eq('id', id)
    load()
  }

  return (
    <AdminLayout>
      <div className="p-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
            📰 Section X Spotlight
          </h1>
          {msg && (
            <span className={`text-sm font-bold ${msg.startsWith('Save failed') || msg.startsWith('Load') || msg.startsWith('Delete') ? 'text-red-400' : 'text-green-400'}`}>
              {msg}
            </span>
          )}
        </div>
        <p className="text-slate-400 text-sm mb-5">
          Write stories, athlete features, and recaps. The featured story appears on the homepage.
        </p>

        {/* Add / Edit form */}
        {editing ? (
          <div className="card p-5 mb-5 space-y-3">
            <p className="text-sm font-bold text-white mb-1">
              {editing.id ? 'Edit Story' : 'New Story'}
            </p>
            <div>
              <label className="label">Headline *</label>
              <input
                className="input w-full"
                placeholder="Canton's Roiger dominates in Class A championship..."
                value={editing.title}
                onChange={e => setEditing((p: any) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Story *</label>
              <textarea
                className="input w-full resize-none"
                style={{ height: '160px' }}
                placeholder="Write the story here..."
                value={editing.body}
                onChange={e => setEditing((p: any) => ({ ...p, body: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Author</label>
                <input
                  className="input w-full"
                  value={editing.author}
                  onChange={e => setEditing((p: any) => ({ ...p, author: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Sport (optional)</label>
                <input
                  className="input w-full"
                  placeholder="e.g. Baseball"
                  value={editing.sport_name}
                  onChange={e => setEditing((p: any) => ({ ...p, sport_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={e => setEditing((p: any) => ({ ...p, published: e.target.checked }))}
                />
                <span className="text-sm text-slate-300">Published</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.featured}
                  onChange={e => setEditing((p: any) => ({ ...p, featured: e.target.checked }))}
                />
                <span className="text-sm text-slate-300">⭐ Featured on homepage</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => { setEditing(null); setMsg('') }} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                <Save size={14} />
                {saving ? 'Saving...' : 'Save Story'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditing({ ...blank })}
            className="btn-primary flex items-center gap-2 mb-5"
          >
            <Plus size={14} /> New Story
          </button>
        )}

        {/* Stories list */}
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : (
          <div className="space-y-2">
            {stories.length === 0 && (
              <div className="card p-8 text-center text-slate-500">No stories yet.</div>
            )}
            {stories.map(s => (
              <div key={s.id} className="card p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-bold text-white text-sm truncate"
                      style={{ fontFamily: 'var(--font-display)' }}>
                      {s.title}
                    </p>
                    {s.featured && <span className="text-xs text-yellow-400">⭐ Featured</span>}
                    {!s.published && <span className="text-xs text-slate-600">Draft</span>}
                    {s.sport_name && <span className="text-xs text-slate-500">{s.sport_name}</span>}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{s.body}</p>
                  <p className="text-xs text-slate-700 mt-1">
                    by {s.author} · {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleFeatured(s.id, s.featured)}
                    className={`p-1.5 transition-colors ${s.featured ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400'}`}
                    title="Toggle featured"
                  >
                    <Star size={14} />
                  </button>
                  <button
                    onClick={() => setEditing({ ...s })}
                    className="p-1.5 text-slate-400 hover:text-white text-sm"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => del(s.id)}
                    className="p-1.5 text-slate-600 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
