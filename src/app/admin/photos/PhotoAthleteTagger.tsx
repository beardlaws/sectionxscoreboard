'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminDb } from '@/lib/adminDb'

export default function PhotoAthleteTagger({ photoId, gameId }: { photoId: string; gameId?: string | null }) {
  const supabase = createClient()
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
    const [gameResult, tagsResult, suggestionResult] = await Promise.all([
      supabase.from('games').select('home_team_id, away_team_id, season_id').eq('id', gameId).single(),
      supabase.from('photo_athletes').select('athlete_id').eq('photo_id', photoId),
      fetch(`/api/admin/photos/tag-suggestions?photoId=${encodeURIComponent(photoId)}`, { credentials: 'include', cache: 'no-store' })
        .then(async r => {
          const j = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(j.error || 'Could not load tag suggestions')
          return j
        })
        .catch(() => ({ suggestions: [] })),
    ])
    const game = gameResult.data
    const tags = tagsResult.data
    setTagged(new Set((tags || []).map((tag: any) => tag.athlete_id)))
    setSuggested(new Set((suggestionResult.suggestions || []).map((tag: any) => tag.athlete_id)))
    if (!game) { setLoading(false); return }
    const teamIds = [game.home_team_id, game.away_team_id].filter(Boolean)
    if (!teamIds.length) { setLoading(false); return }
    let q = supabase.from('roster_entries').select('athlete_id, jersey_number, team_id, athlete:athletes(id, display_name)').in('team_id', teamIds).eq('active', true)
    if (game.season_id) q = q.eq('season_id', game.season_id)
    const { data: roster } = await q
    const seen = new Set<string>()
    setAthletes((roster || []).filter((row: any) => { if (!row.athlete_id || seen.has(row.athlete_id)) return false; seen.add(row.athlete_id); return true }))
    setLoading(false)
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

  async function approveSuggestion(athleteId:string) {
    await adminDb.update('photo_tag_suggestions', { status:'approved', reviewed_at:new Date().toISOString(), reviewed_by:'admin' }, { photo_id:photoId, athlete_id:athleteId })
    setSuggested(prev => { const next=new Set(prev); next.delete(athleteId); return next })
  }

  async function toggle(row: any) {
    const athleteId = row.athlete_id
    if (!athleteId) return
    const isTagged = tagged.has(athleteId)
    setSavingId(athleteId)
    try {
      if (isTagged) {
        await adminDb.delete('photo_athletes', { photo_id: photoId, athlete_id: athleteId })
        setTagged(prev => { const next = new Set(prev); next.delete(athleteId); return next })
      } else {
        await adminDb.upsert('photo_athletes', { photo_id: photoId, athlete_id: athleteId }, 'photo_id,athlete_id')
        setTagged(prev => new Set(prev).add(athleteId))
        if (suggested.has(athleteId)) await approveSuggestion(athleteId)
      }
    } catch (e: any) { alert(e.message || 'Could not update athlete tag') }
    finally { setSavingId(null) }
  }

  async function approveAllSuggested() {
    const ids=[...suggested]
    if(!ids.length)return
    setApprovingAll(true)
    try {
      for(const athleteId of ids){
        await adminDb.upsert('photo_athletes',{photo_id:photoId,athlete_id:athleteId},'photo_id,athlete_id')
        await approveSuggestion(athleteId)
      }
      setTagged(prev=>new Set([...prev,...ids]))
    }catch(e:any){alert(e.message||'Could not approve suggested tags')}
    finally{setApprovingAll(false)}
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
