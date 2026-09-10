'use client'

import { useEffect, useMemo, useState } from 'react'

export default function PhotoAthleteTagger({ photoId, gameId }: { photoId: string; gameId?: string | null }) {
  const [athletes, setAthletes] = useState<any[]>([])
  const [tagged, setTagged] = useState<Set<string>>(new Set())
  const [suggested, setSuggested] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(Boolean(gameId))
  const [savingId, setSavingId] = useState<string | null>(null)
  const [approvingAll, setApprovingAll] = useState(false)

  async function load() {
    if (!gameId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/photos/tags?photoId=${encodeURIComponent(photoId)}&gameId=${encodeURIComponent(gameId)}`, { credentials:'include', cache:'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not load game roster')
      setAthletes(json.athletes || [])
      setTagged(new Set(json.tagged || []))
      setSuggested(new Set((json.suggestions || []).map((tag:any) => tag.athlete_id)))
    } catch {
      setAthletes([])
      setTagged(new Set())
      setSuggested(new Set())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [gameId, photoId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return athletes
    return athletes.filter(row => {
      const athlete = Array.isArray(row.athlete) ? row.athlete[0] : row.athlete
      return `${athlete?.display_name || ''} ${row.jersey_number || ''}`.toLowerCase().includes(q)
    })
  }, [athletes, search])

  async function mutate(action:string, athleteId?:string, athleteIds?:string[]) {
    const res = await fetch('/api/admin/photos/tags', {
      method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ photoId, action, athleteId, athleteIds }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Could not update athlete tag')
  }

  async function toggle(row: any) {
    const athleteId = row.athlete_id
    if (!athleteId) return
    const isTagged = tagged.has(athleteId)
    setSavingId(athleteId)
    try {
      await mutate(isTagged ? 'remove' : 'add', athleteId)
      if (isTagged) setTagged(prev => { const next = new Set(prev); next.delete(athleteId); return next })
      else {
        setTagged(prev => new Set(prev).add(athleteId))
        setSuggested(prev => { const next = new Set(prev); next.delete(athleteId); return next })
      }
    } catch (e: any) { alert(e.message || 'Could not update athlete tag') }
    finally { setSavingId(null) }
  }

  async function approveAllSuggested() {
    const ids=[...suggested]
    if(!ids.length)return
    setApprovingAll(true)
    try {
      await mutate('approveAll', undefined, ids)
      setTagged(prev=>new Set([...prev,...ids]))
      setSuggested(new Set())
    } catch(e:any) { alert(e.message||'Could not approve suggested tags') }
    finally { setApprovingAll(false) }
  }

  if (!gameId) return <p className="text-xs text-slate-600 mt-3">Tie this photo to a game to enable athlete tagging.</p>
  if (loading) return <p className="text-xs text-slate-500 mt-3">Loading game roster...</p>
  if (!athletes.length) return <p className="text-xs text-slate-600 mt-3">No rostered athletes found for this game yet.</p>

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div><div className="text-xs font-bold text-slate-300">Tag athletes in this photo</div>{suggested.size>0&&<div className="text-[10px] text-amber-300 mt-1">{suggested.size} tag suggestion{suggested.size===1?'':'s'} from the submitter</div>}</div>
        <div className="text-[10px] text-slate-500">{tagged.size} approved</div>
      </div>
      {suggested.size>0&&<button type="button" onClick={approveAllSuggested} disabled={approvingAll} className="w-full mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 px-3 py-2 text-xs font-bold">{approvingAll?'Approving suggested tags…':`Approve All ${suggested.size} Suggested Tag${suggested.size===1?'':'s'}`}</button>}
      <input className="input w-full text-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search player or number..." />
      <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-white/10">
        {filtered.map(row => {
          const athlete = Array.isArray(row.athlete) ? row.athlete[0] : row.athlete
          const isTagged = tagged.has(row.athlete_id), isSuggested=suggested.has(row.athlete_id)
          return (
            <button key={row.athlete_id} type="button" onClick={() => toggle(row)} disabled={savingId === row.athlete_id} className={`w-full flex items-center gap-3 px-3 py-2 text-left border-b border-white/5 last:border-0 ${isTagged ? 'bg-blue-500/10' : isSuggested ? 'bg-amber-500/[0.07]' : 'hover:bg-white/[0.03]'}`}>
              <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${isTagged ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/20'}`}>{isTagged ? '✓' : ''}</span>
              <span className="text-sm text-white flex-1">{athlete?.display_name || 'Athlete'}{isSuggested&&!isTagged&&<span className="ml-2 text-[10px] text-amber-300 uppercase">suggested</span>}</span>
              {row.jersey_number && <span className="text-xs text-slate-500">#{row.jersey_number}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
