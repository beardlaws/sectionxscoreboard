// src/app/admin/alerts/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Download } from 'lucide-react'

const supabase = createClient()

export default function AlertsAdmin() {
  const [subs, setSubs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('score_alert_subscriptions')
      .select('*, school:schools(school_name, slug)')
      .order('created_at', { ascending: false })
    setSubs(data || [])
    setLoading(false)
  }

  async function deleteSub(id: string) {
    await supabase.from('score_alert_subscriptions').delete().eq('id', id)
    load()
  }

  function exportCSV() {
    const rows = [
      ['Email', 'School', 'All Section X', 'Signed Up'],
      ...filtered.map(s => [
        s.email,
        s.school?.school_name || (s.all_section_x ? 'All Section X' : ''),
        s.all_section_x ? 'Yes' : 'No',
        new Date(s.created_at).toLocaleDateString(),
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'score_alert_subscribers.csv'; a.click()
  }

  const filtered = subs.filter(s =>
    !filter || s.email.includes(filter) || s.school?.school_name?.toLowerCase().includes(filter.toLowerCase())
  )

  const bySchool = subs.reduce((acc, s) => {
    const key = s.school?.school_name || 'All Section X'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <AdminLayout>
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
            🔔 Score Alert Subscribers
          </h1>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Export CSV
          </button>
        </div>
        <p className="text-slate-400 text-sm mb-5">
          {subs.length} subscriber{subs.length !== 1 ? 's' : ''} total
        </p>

        {/* Stats by school */}
        {Object.keys(bySchool).length > 0 && (
          <div className="card p-4 mb-5">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
              style={{ fontFamily: 'var(--font-display)' }}>By School</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(bySchool).sort((a, b) => b[1] - a[1]).map(([school, count]) => (
                <div key={school} className="flex items-center justify-between px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-xs text-slate-300 truncate">{school}</span>
                  <span className="text-xs font-black text-white ml-2">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <input className="input w-full mb-4" placeholder="Filter by email or school..."
          value={filter} onChange={e => setFilter(e.target.value)} />

        {/* List */}
        {loading ? <div className="text-center py-8 text-slate-500">Loading...</div> : (
          <div className="space-y-1">
            {filtered.length === 0 && (
              <div className="card p-8 text-center text-slate-500">No subscribers yet.</div>
            )}
            {filtered.map(s => (
              <div key={s.id} className="card p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-mono">{s.email}</p>
                  <p className="text-xs text-slate-500">
                    {s.school?.school_name || 'All Section X'} ·{' '}
                    {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => deleteSub(s.id)}
                  className="text-xs text-slate-600 hover:text-red-400 px-2 py-1">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
