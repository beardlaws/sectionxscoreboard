'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell, Check, X } from 'lucide-react'

type Props = {
  targetType: 'team' | 'athlete'
  targetId: string
  targetName: string
  compact?: boolean
  buttonLabel?: string
}

export default function FollowButton({ targetType, targetId, targetName, compact = false, buttonLabel }: Props) {
  const storageKey = `sx-follow:${targetType}:${targetId}`
  const manageKey = `${storageKey}:manage`
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [knownFollowing, setKnownFollowing] = useState(false)
  const [manageToken, setManageToken] = useState('')
  const [error, setError] = useState('')
  const [prefs, setPrefs] = useState({ finals: true, scheduleChanges: true, live: false, photos: true })

  useEffect(() => {
    try {
      setKnownFollowing(window.localStorage.getItem(storageKey) === '1')
      setManageToken(window.localStorage.getItem(manageKey) || '')
    } catch {}
  }, [storageKey, manageKey])

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
      try {
        window.localStorage.setItem(storageKey, '1')
        if (body.manageToken) window.localStorage.setItem(manageKey, body.manageToken)
      } catch {}
      setKnownFollowing(true)
      setManageToken(body.manageToken || manageToken)
      setDone(true)
    } catch (e: any) {
      setError(e?.message || 'Could not save follow.')
    } finally {
      setLoading(false)
    }
  }

  const visibleLabel = knownFollowing ? `Following${buttonLabel ? ` ${buttonLabel.replace(/^Follow\s+/i, '')}` : ''}` : (buttonLabel || 'Follow')

  return <>
    <button
      type="button"
      onClick={() => { setDone(false); setOpen(true) }}
      className={`inline-flex items-center gap-2 rounded-xl border font-black transition-colors ${knownFollowing ? 'border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-200' : 'border-yellow-300/25 bg-yellow-300/[0.07] text-yellow-200 hover:bg-yellow-300/[0.12]'} ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'}`}
    >
      {knownFollowing ? <Check size={15} /> : <Bell size={15} />}
      {visibleLabel}
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
          <p className="mt-1 text-xs text-emerald-100/60">Your follow is active. You can change or turn off any alert from your private preference center.</p>
          {manageToken && <Link href={`/following?token=${encodeURIComponent(manageToken)}`} className="mt-3 inline-flex rounded-lg border border-emerald-300/20 px-3 py-2 text-xs font-black text-emerald-200">Manage all follows</Link>}
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
          <p className="mt-3 text-[11px] leading-relaxed text-white/30">Your selections are stored per follow. Email delivery activates through the Section X fan-alert dispatcher when the site email provider is configured.</p>
          {manageToken && <Link href={`/following?token=${encodeURIComponent(manageToken)}`} className="mt-3 inline-block text-xs font-bold text-yellow-200/70 hover:text-yellow-200">Manage existing follows →</Link>}
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
          <button onClick={save} disabled={loading} className="mt-4 w-full rounded-xl bg-yellow-300 px-4 py-3 text-sm font-black text-black disabled:opacity-50">{loading ? 'Saving…' : knownFollowing ? 'Update preferences' : `Follow ${targetType}`}</button>
        </>}
      </div>
    </div>}
  </>
}
