'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, X } from 'lucide-react'

type Props = {
  targetType: 'team' | 'athlete'
  targetId: string
  targetName: string
  compact?: boolean
}

export default function FollowButton({ targetType, targetId, targetName, compact = false }: Props) {
  const storageKey = `sx-follow:${targetType}:${targetId}`
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [knownFollowing, setKnownFollowing] = useState(false)
  const [error, setError] = useState('')
  const [prefs, setPrefs] = useState({ finals: true, scheduleChanges: true, live: false, photos: true })

  useEffect(() => {
    try { setKnownFollowing(window.localStorage.getItem(storageKey) === '1') } catch {}
  }, [storageKey])

  async function save() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          teamId: targetType === 'team' ? targetId : null,
          athleteId: targetType === 'athlete' ? targetId : null,
          preferences: prefs,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Could not save follow.')
      try { window.localStorage.setItem(storageKey, '1') } catch {}
      setKnownFollowing(true)
      setDone(true)
    } catch (e: any) {
      setError(e?.message || 'Could not save follow.')
    } finally {
      setLoading(false)
    }
  }

  return <>
    <button
      type="button"
      onClick={() => { setDone(false); setOpen(true) }}
      className={`inline-flex items-center gap-2 rounded-xl border font-black transition-colors ${knownFollowing ? 'border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-200' : 'border-yellow-300/25 bg-yellow-300/[0.07] text-yellow-200 hover:bg-yellow-300/[0.12]'} ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'}`}
    >
      {knownFollowing ? <Check size={15} /> : <Bell size={15} />}
      {knownFollowing ? 'Following' : 'Follow'}
    </button>

    {open && <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={() => setOpen(false)}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0b101b] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.16em] text-yellow-300">Follow on Section X</div>
            <h3 className="mt-1 text-xl font-black text-white">{targetName}</h3>
          </div>
          <button onClick={() => setOpen(false)} className="p-2 text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        {done ? <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[.07] p-4 text-sm text-emerald-200">
          <div className="flex items-center gap-2 font-black"><Check size={16} /> Preferences saved.</div>
          <p className="mt-1 text-xs text-emerald-100/60">You can reopen Following anytime on this device to update what you want to hear about.</p>
        </div> : <>
          <p className="mt-3 text-sm text-white/50">No account required. Enter your email and choose what matters to you.</p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="input mt-4 w-full" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              ['finals', 'Final scores'],
              ['scheduleChanges', 'Schedule changes'],
              ['live', 'Live updates'],
              ['photos', 'New photos'],
            ].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-white/[.07] bg-white/[.025] p-3 text-xs text-white/70">
              <input type="checkbox" checked={(prefs as any)[key]} onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))} />
              {label}
            </label>)}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/30">Final-score follows also connect to the existing school score-alert list when available. Other preferences are being stored now for the expanded fan-alert delivery system.</p>
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
          <button onClick={save} disabled={loading} className="mt-4 w-full rounded-xl bg-yellow-300 px-4 py-3 text-sm font-black text-black disabled:opacity-50">{loading ? 'Saving…' : knownFollowing ? 'Update preferences' : `Follow ${targetType}`}</button>
        </>}
      </div>
    </div>}
  </>
}
