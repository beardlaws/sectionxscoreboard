'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PublicLayout from '@/components/layout/PublicLayout'
import { Bell, Check, Loader2 } from 'lucide-react'

export default function FollowingClient() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    const response = await fetch(`/api/follows/manage?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const body = await response.json().catch(() => ({}))
    setData(response.ok ? body : { error: body?.error || 'Could not load your follows.' })
    setLoading(false)
  }

  useEffect(() => { if (token) load(); else { setData({ error: 'This follow link is missing its private management token.' }); setLoading(false) } }, [token])

  async function update(row: any, patch: any) {
    setMessage('Saving…')
    const response = await fetch('/api/follows/manage', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, followId: row.id, ...patch }) })
    if (response.ok) { setMessage('Saved'); await load() } else setMessage('Could not save that change.')
  }

  async function unsubscribeAll() {
    if (!confirm('Turn off all Section X follows for this email?')) return
    setMessage('Unsubscribing…')
    const response = await fetch('/api/follows/manage', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
    if (response.ok) { setMessage('All follows turned off.'); await load() } else setMessage('Could not update your follows.')
  }

  return <PublicLayout><div className="max-w-3xl mx-auto px-4 py-8">
    <div className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-300">Your Section X</div>
    <h1 className="mt-1 text-3xl font-black text-white">Follow preferences</h1>
    <p className="mt-2 text-sm text-white/45">Choose exactly what Section X sends you. No account required.</p>

    {loading ? <div className="mt-8 flex items-center gap-2 text-white/50"><Loader2 size={17} className="animate-spin" /> Loading follows…</div> : data?.error ? <div className="card mt-6 p-5 text-red-300">{data.error}</div> : <>
      <div className="mt-6 rounded-xl border border-white/[.07] bg-white/[.025] p-4 text-sm text-white/55">Managing alerts for <b className="text-white">{data.email}</b>.</div>
      <div className="mt-5 space-y-3">{(data.follows || []).map((row: any) => <div key={row.id} className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.13em] text-white/35">{row.type}</div><div className="mt-1 font-black text-white">{row.name}</div></div><button onClick={() => update(row, { active: !row.active })} className={`rounded-lg border px-3 py-2 text-xs font-black ${row.active ? 'border-emerald-400/20 bg-emerald-400/[.06] text-emerald-300' : 'border-white/10 text-white/40'}`}>{row.active ? <span className="inline-flex items-center gap-1"><Check size={13}/> Active</span> : 'Turn back on'}</button></div>
        <div className="mt-4 grid grid-cols-2 gap-2">{[['finals','Final scores'],['scheduleChanges','Schedule changes'],['live','Live updates'],['photos','New photos']].map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-white/[.06] bg-black/20 p-3 text-xs text-white/65"><input type="checkbox" disabled={!row.active} checked={Boolean(row.preferences?.[key])} onChange={e => update(row, { preferences: { ...row.preferences, [key]: e.target.checked } })}/>{label}</label>)}</div>
      </div>)}</div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={unsubscribeAll} className="rounded-lg border border-red-400/20 px-4 py-2 text-xs font-black text-red-300 hover:bg-red-400/[.05]">Unsubscribe from everything</button>{message && <span className="text-xs text-white/40">{message}</span>}</div>
      <div className="mt-6 rounded-xl border border-yellow-300/10 bg-yellow-300/[.03] p-4 text-xs leading-relaxed text-white/40"><Bell size={14} className="inline mr-1 text-yellow-300"/> Section X only sends the alert types you enable here. Every alert email links back to this private preference center.</div>
    </>}
  </div></PublicLayout>
}
