'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Play, RefreshCw, ShieldCheck } from 'lucide-react'

type Season = { id:string; name:string; year:number; season_type:string; is_active:boolean }

type Audit = {
  ok:boolean
  season:{id:string;name:string;year:number;type:string}
  comparison:{
    counts:Record<string,number>
    eligible:number
    quarantined:number
    trueBlockers:number
    writerReady:boolean
    otherSeasonSkipped?:number
    samples?:Record<string,any[]>
  }
}

export default function ScheduleIntelligence({ seasons }:{ seasons:Season[] }) {
  const initial = seasons.find(s=>s.is_active)?.id || seasons[0]?.id || ''
  const [seasonId,setSeasonId]=useState(initial)
  const [audit,setAudit]=useState<Audit|null>(null)
  const [syncResult,setSyncResult]=useState<any>(null)
  const [loading,setLoading]=useState(false)
  const [syncing,setSyncing]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const selected=useMemo(()=>seasons.find(s=>s.id===seasonId)||null,[seasons,seasonId])

  async function runAudit(){
    if(!seasonId)return
    setLoading(true);setError(null);setSyncResult(null)
    try{
      const r=await fetch(`/api/admin/arbiter-api/games-dry-run?seasonId=${encodeURIComponent(seasonId)}`,{cache:'no-store'})
      const j=await r.json()
      if(!r.ok||!j.ok)throw new Error(j.error||'Dry run failed')
      setAudit(j)
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setLoading(false)}
  }

  async function runSync(){
    if(!audit?.comparison.writerReady||!seasonId)return
    const ok=window.confirm(`Run the CONTROLLED Arbiter sync for ${selected?.name || 'this season'}?\n\nOnly eligible rows will be written. Quarantined rows will be skipped and logged.`)
    if(!ok)return
    setSyncing(true);setError(null);setSyncResult(null)
    try{
      const r=await fetch('/api/admin/arbiter-api/sync',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({confirm:'APPLY_ARBITER_SCHEDULE_SYNC',seasonId})
      })
      const j=await r.json()
      if(!r.ok&&r.status!==207)throw new Error(j.error||'Controlled sync failed')
      setSyncResult(j)
      await runAudit()
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setSyncing(false)}
  }

  const counts=audit?.comparison.counts||{}
  const cards=[
    ['Eligible',audit?.comparison.eligible??'—'],
    ['Quarantined',audit?.comparison.quarantined??'—'],
    ['Exact matches',counts['exact-match']??'—'],
    ['Probable matches',counts['probable-match']??'—'],
    ['New games',counts['new-game']??'—'],
    ['External create',counts['external-create']??'—'],
    ['Stable ID matches',counts['stable-id-match']??'—'],
    ['True blockers',audit?.comparison.trueBlockers??'—'],
  ]

  return <div className="p-4 max-w-6xl space-y-5">
    <div>
      <div className="flex items-center gap-2"><ShieldCheck size={24} style={{color:'var(--accent-bright)'}}/><h1 className="text-2xl font-bold text-white" style={{fontFamily:'var(--font-display)'}}>Schedule Intelligence</h1></div>
      <p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Arbiter Partner API → normalize → reconcile → quarantine ambiguity → controlled upsert.</p>
    </div>

    <div className="card p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <label className="flex-1 text-sm"><span className="block mb-1" style={{color:'var(--text-muted)'}}>Season</span>
          <select value={seasonId} onChange={e=>{setSeasonId(e.target.value);setAudit(null);setSyncResult(null)}} className="w-full rounded-lg px-3 py-2 bg-black/30 border border-white/10 text-white">
            {seasons.map(s=><option key={s.id} value={s.id}>{s.name}{s.is_active?' — ACTIVE':''}</option>)}
          </select>
        </label>
        <button onClick={runAudit} disabled={loading||!seasonId} className="admin-action-btn justify-center md:min-w-[180px]">
          <RefreshCw size={18} className={loading?'animate-spin':''}/><span>{loading?'Checking…':'Run Dry Check'}</span>
        </button>
      </div>
    </div>

    {error&&<div className="rounded-lg p-3 text-sm border border-red-500/30 bg-red-500/10 text-red-300"><AlertTriangle className="inline mr-2" size={16}/>{error}</div>}

    {audit&&<>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(([label,value])=><div className="card p-4" key={String(label)}><div className="text-2xl font-bold text-white">{value}</div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{label}</div></div>)}
      </div>

      <div className={`rounded-xl p-4 border ${audit.comparison.writerReady?'border-emerald-500/30 bg-emerald-500/10':'border-red-500/30 bg-red-500/10'}`}>
        <div className="flex items-start gap-3">
          {audit.comparison.writerReady?<CheckCircle2 className="text-emerald-400"/>:<AlertTriangle className="text-red-400"/>}
          <div className="flex-1">
            <div className="font-bold text-white">{audit.comparison.writerReady?'Controlled writer ready':'Writer not ready'}</div>
            <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Eligible rows can be processed while TBA, event sports, title/type conflicts and other quarantined records remain untouched.</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="card p-4"><h2 className="font-semibold text-white mb-3">Quarantine breakdown</h2><div className="space-y-2 text-sm">{['manual-review','event-sport','title-type-conflict','ambiguous-match','mapping-needed','orphaned-link','source-cancelled','other-season'].map(k=><div key={k} className="flex justify-between"><span style={{color:'var(--text-secondary)'}}>{k}</span><strong className="text-white">{counts[k]||0}</strong></div>)}</div></div>
        <div className="card p-4"><h2 className="font-semibold text-white mb-3">Write safety</h2><div className="space-y-2 text-sm" style={{color:'var(--text-secondary)'}}><p>• Stable Arbiter IDs are permanent identities.</p><p>• Existing matches update instead of duplicating.</p><p>• New external opponents are safely reused or created.</p><p>• Event sports and uncertain records stay quarantined.</p><p>• Deleted Arbiter games are canceled, never hard-deleted.</p><p>• Every controlled action is audit logged.</p></div></div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div><h2 className="font-semibold text-white">Controlled Sync</h2><p className="text-sm" style={{color:'var(--text-muted)'}}>Requires explicit confirmation. No autonomous schedule writes are enabled.</p></div>
          <button onClick={runSync} disabled={!audit.comparison.writerReady||syncing} className="admin-action-btn justify-center md:min-w-[220px] disabled:opacity-40">
            <Play size={18}/><span>{syncing?'Syncing…':'Run Controlled Sync'}</span>
          </button>
        </div>
      </div>
    </>}

    {syncResult&&<div className="card p-4"><h2 className="font-semibold text-white mb-3">Last controlled run</h2><div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">{Object.entries(syncResult.totals||{}).map(([k,v])=><div key={k} className="rounded-lg bg-black/20 p-3"><div className="text-xl font-bold text-white">{String(v)}</div><div style={{color:'var(--text-muted)'}}>{k}</div></div>)}</div>{syncResult.runId&&<div className="text-xs mt-3" style={{color:'var(--text-muted)'}}>Run ID: {syncResult.runId}</div>}</div>}
  </div>
}
