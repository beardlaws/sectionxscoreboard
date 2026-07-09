// src/app/admin/sponsors/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Save, Plus, Trash2, ExternalLink } from 'lucide-react'

const supabase = createClient()

const PLACEMENT_TYPES = [
  { value: 'homepage', label: '🏠 Homepage — Presenting Sponsor', desc: 'Top of homepage, every visitor' },
  { value: 'school', label: '🏫 School Page', desc: 'Shows on a specific school page' },
  { value: 'sport', label: '⚽ Sport Coverage', desc: 'Shows on a specific sport page + standings' },
  { value: 'playoff', label: '🏆 Playoff Bracket', desc: 'Shows on playoff brackets' },
  { value: 'scores', label: '📅 Scores Page', desc: 'Shows on the scores/results page' },
]

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<any[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [sports, setSports] = useState<any[]>([])
  const [inquiries, setInquiries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState<'sponsors' | 'inquiries'>('sponsors')

  const blank = {
    business_name: '', website_url: '', tagline: '', logo_url: '',
    placement_type: 'homepage', school_id: '', sport_id: '',
    active: true, show_on_scores: false,
    price_monthly: '', start_date: '', end_date: '',
    contact_name: '', contact_email: '', contact_phone: '', notes: '',
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: sp }, { data: sc }, { data: st }, { data: iq }] = await Promise.all([
      supabase.from('sponsors').select('*, school:schools(school_name), sport:sports(sport_name)').order('created_at', { ascending: false }),
      supabase.from('schools').select('id, school_name').order('school_name'),
      supabase.from('sports').select('id, sport_name, gender').order('sport_name'),
      supabase.from('advertise_inquiries').select('*').order('created_at', { ascending: false }),
    ])
    setSponsors(sp || [])
    setSchools(sc || [])
    setSports(st || [])
    setInquiries(iq || [])
    setLoading(false)
  }

  async function save() {
    if (!editing?.business_name) { setMsg('Business name is required'); return }
    setSaving(true)
    const payload = {
      business_name: editing.business_name,
      website_url: editing.website_url || null,
      tagline: editing.tagline || null,
      logo_url: editing.logo_url || null,
      placement_type: editing.placement_type,
      placement: editing.placement_type, // keep legacy field in sync
      school_id: editing.school_id || null,
      sport_id: editing.sport_id || null,
      active: editing.active,
      show_on_scores: editing.show_on_scores,
      price_monthly: editing.price_monthly ? parseFloat(editing.price_monthly) : null,
      start_date: editing.start_date || null,
      end_date: editing.end_date || null,
      contact_name: editing.contact_name || null,
      contact_email: editing.contact_email || null,
      contact_phone: editing.contact_phone || null,
      notes: editing.notes || null,
    }
    if (editing.id) {
      const { error } = await supabase.from('sponsors').update(payload).eq('id', editing.id)
      if (error) { setMsg('Error: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('sponsors').insert(payload)
      if (error) { setMsg('Error: ' + error.message); setSaving(false); return }
    }
    setMsg('Saved!')
    setTimeout(() => setMsg(''), 3000)
    setEditing(null)
    load()
    setSaving(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('sponsors').update({ active: !current }).eq('id', id)
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete this sponsor?')) return
    await supabase.from('sponsors').delete().eq('id', id)
    load()
  }

  async function markInquiryReviewed(id: string) {
    await supabase.from('advertise_inquiries').update({ reviewed: true }).eq('id', id)
    load()
  }

  const activeSponsorRevenue = sponsors
    .filter(s => s.active && s.price_monthly)
    .reduce((sum, s) => sum + (s.price_monthly || 0), 0)

  return (
    <AdminLayout>
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
            💰 Sponsors
          </h1>
          {msg && <span className={`text-sm ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
        </div>

        {/* Revenue summary */}
        {activeSponsorRevenue > 0 && (
          <div className="rounded-xl p-3 mb-4 flex items-center gap-4"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div>
              <p className="text-xs text-slate-400">Active Monthly Revenue</p>
              <p className="text-2xl font-black text-green-400" style={{ fontFamily: 'var(--font-display)' }}>
                ${activeSponsorRevenue.toFixed(0)}/mo
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {sponsors.filter(s => s.active).length} active sponsor{sponsors.filter(s => s.active).length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {(['sponsors', 'inquiries'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest transition-all"
              style={{
                fontFamily: 'var(--font-display)',
                background: tab === t ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)',
                color: tab === t ? '#60a5fa' : '#4a5f7a',
                border: `1px solid ${tab === t ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              {t === 'inquiries'
                ? `Inquiries (${inquiries.filter(i => !i.reviewed).length} new)`
                : 'Active Sponsors'}
            </button>
          ))}
        </div>

        {tab === 'sponsors' && (
          <>
            {/* Add/Edit form */}
            {editing ? (
              <div className="card p-5 mb-5 space-y-4">
                <p className="text-sm font-bold text-white">{editing.id ? 'Edit Sponsor' : 'Add New Sponsor'}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Business Name *</label>
                    <input className="input w-full" placeholder="e.g. Canton Auto Group"
                      value={editing.business_name}
                      onChange={e => setEditing((p: any) => ({ ...p, business_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Website URL</label>
                    <input className="input w-full" placeholder="https://..."
                      value={editing.website_url}
                      onChange={e => setEditing((p: any) => ({ ...p, website_url: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Tagline</label>
                    <input className="input w-full" placeholder="e.g. Your local auto dealer for 30 years"
                      value={editing.tagline}
                      onChange={e => setEditing((p: any) => ({ ...p, tagline: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Logo URL (optional)</label>
                    <input className="input w-full" placeholder="https://... (PNG with transparent background recommended)"
                      value={editing.logo_url}
                      onChange={e => setEditing((p: any) => ({ ...p, logo_url: e.target.value }))} />
                  </div>
                </div>

                {/* Placement */}
                <div>
                  <label className="label">Sponsorship Type *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {PLACEMENT_TYPES.map(pt => (
                      <button key={pt.value} onClick={() => setEditing((p: any) => ({ ...p, placement_type: pt.value }))}
                        className="text-left p-3 rounded-xl border transition-all"
                        style={{
                          background: editing.placement_type === pt.value ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${editing.placement_type === pt.value ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        }}>
                        <p className="text-xs font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{pt.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{pt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* School or sport selector */}
                {editing.placement_type === 'school' && (
                  <div>
                    <label className="label">Which School?</label>
                    <select className="input w-full" value={editing.school_id}
                      onChange={e => setEditing((p: any) => ({ ...p, school_id: e.target.value }))}>
                      <option value="">Select school...</option>
                      {schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}
                    </select>
                  </div>
                )}
                {editing.placement_type === 'sport' && (
                  <div>
                    <label className="label">Which Sport?</label>
                    <select className="input w-full" value={editing.sport_id}
                      onChange={e => setEditing((p: any) => ({ ...p, sport_id: e.target.value }))}>
                      <option value="">Select sport...</option>
                      {sports.map(s => <option key={s.id} value={s.id}>{s.gender} {s.sport_name}</option>)}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Monthly Rate ($)</label>
                    <input type="number" className="input w-full" placeholder="0"
                      value={editing.price_monthly}
                      onChange={e => setEditing((p: any) => ({ ...p, price_monthly: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Start Date</label>
                    <input type="date" className="input w-full" value={editing.start_date}
                      onChange={e => setEditing((p: any) => ({ ...p, start_date: e.target.value }))}
                      style={{ colorScheme: 'dark' }} />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input type="date" className="input w-full" value={editing.end_date}
                      onChange={e => setEditing((p: any) => ({ ...p, end_date: e.target.value }))}
                      style={{ colorScheme: 'dark' }} />
                  </div>
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Contact Name</label>
                    <input className="input w-full" placeholder="John Smith"
                      value={editing.contact_name}
                      onChange={e => setEditing((p: any) => ({ ...p, contact_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Contact Email</label>
                    <input className="input w-full" placeholder="john@business.com"
                      value={editing.contact_email}
                      onChange={e => setEditing((p: any) => ({ ...p, contact_email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Contact Phone</label>
                    <input className="input w-full" placeholder="555-1234"
                      value={editing.contact_phone}
                      onChange={e => setEditing((p: any) => ({ ...p, contact_phone: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="label">Internal Notes</label>
                  <textarea className="input w-full h-16 resize-none" placeholder="Renewal date, special requests, etc."
                    value={editing.notes}
                    onChange={e => setEditing((p: any) => ({ ...p, notes: e.target.value }))} />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.active}
                      onChange={e => setEditing((p: any) => ({ ...p, active: e.target.checked }))} />
                    <span className="text-sm text-slate-300">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.show_on_scores}
                      onChange={e => setEditing((p: any) => ({ ...p, show_on_scores: e.target.checked }))} />
                    <span className="text-sm text-slate-300">Show on Scores page</span>
                  </label>
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
                  <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Sponsor'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setEditing(blank)} className="btn-primary flex items-center gap-2 mb-5">
                <Plus size={14} /> Add Sponsor
              </button>
            )}

            {/* Sponsors list */}
            {loading ? <div className="text-center py-8 text-slate-500">Loading...</div> : (
              <div className="space-y-2">
                {sponsors.length === 0 && <div className="card p-8 text-center text-slate-500">No sponsors yet.</div>}
                {sponsors.map(s => (
                  <div key={s.id} className={`card p-4 flex items-start gap-3 ${!s.active ? 'opacity-50' : ''}`}>
                    {s.logo_url && (
                      <img src={s.logo_url} alt={s.business_name}
                        className="w-12 h-12 object-contain rounded-lg flex-shrink-0 border border-white/10"
                        style={{ background: 'rgba(255,255,255,0.05)' }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{s.business_name}</p>
                        {s.active && <span className="text-xs text-green-400 font-bold">● Active</span>}
                        {!s.active && <span className="text-xs text-slate-600">Inactive</span>}
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                          {PLACEMENT_TYPES.find(p => p.value === s.placement_type)?.label || s.placement_type}
                        </span>
                        {s.school && <span className="text-xs text-blue-400">{s.school.school_name}</span>}
                        {s.sport && <span className="text-xs text-blue-400">{s.sport.sport_name}</span>}
                      </div>
                      {s.tagline && <p className="text-xs text-slate-500 mb-1">{s.tagline}</p>}
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        {s.price_monthly && <span className="text-green-400 font-bold">${s.price_monthly}/mo</span>}
                        {s.start_date && <span>{s.start_date} → {s.end_date || 'ongoing'}</span>}
                        {s.contact_email && <span>{s.contact_email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {s.website_url && (
                        <a href={s.website_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-slate-600 hover:text-blue-400">
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button onClick={() => toggleActive(s.id, s.active)}
                        className="text-xs px-2 py-1 rounded font-bold transition-all"
                        style={{ background: s.active ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: s.active ? '#f87171' : '#4ade80' }}>
                        {s.active ? 'Pause' : 'Activate'}
                      </button>
                      <button onClick={() => setEditing(s)} className="p-1.5 text-slate-400 hover:text-white text-sm">✏️</button>
                      <button onClick={() => del(s.id)} className="p-1.5 text-slate-600 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'inquiries' && (
          <div className="space-y-2">
            {inquiries.length === 0 && <div className="card p-8 text-center text-slate-500">No inquiries yet.</div>}
            {inquiries.map(inq => (
              <div key={inq.id} className={`card p-4 ${inq.reviewed ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{inq.business_name}</p>
                      {!inq.reviewed && <span className="text-xs text-blue-400 font-bold">NEW</span>}
                    </div>
                    <p className="text-xs text-slate-400 mb-1">{inq.contact_name} · {inq.email}{inq.phone ? ` · ${inq.phone}` : ''}</p>
                    {inq.package_interest && <p className="text-xs text-slate-500">Interested in: {inq.package_interest}</p>}
                    {inq.message && <p className="text-xs text-slate-500 mt-1">{inq.message}</p>}
                    <p className="text-xs text-slate-700 mt-1">{new Date(inq.created_at).toLocaleDateString()}</p>
                  </div>
                  {!inq.reviewed && (
                    <div className="flex gap-1 flex-shrink-0">
                      <a href={`mailto:${inq.email}?subject=Section X Scoreboard Sponsorship`}
                        className="text-xs px-2 py-1 rounded font-bold"
                        style={{ background: 'rgba(37,99,235,0.2)', color: '#60a5fa' }}>
                        Reply
                      </a>
                      <button onClick={() => markInquiryReviewed(inq.id)}
                        className="text-xs px-2 py-1 rounded text-slate-600 hover:text-slate-400">
                        Done
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
