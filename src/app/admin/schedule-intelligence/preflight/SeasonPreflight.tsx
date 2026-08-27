'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react'

type Season={id:string;name:string;year:number;season_type:string;is_active:boolean}
type Row={arbiterGameId:number|null;bucket:string;sport:string|null;gender:string|null;date:string|null;time:string|null;title:string|null;status:string|null;location:string|null;home:string|null;away:string|null;existingGameId:string|null;existing:any;driftReasons:string[];mappingIssues:string[];warnings:string[]}

type Result={
  ok:boolean
  season:{id:string;name:string;year:number;type:string}
  adoption:{existingToLink:number;stableUpdates:number;newGames:number;externalGames:number;quarantined:number;blockers:number;totalActionable:number;writerReady:boolean;alreadyStable:number}
  breakdowns:{actionableBuckets:{label:string;count:number}[];sports:{label:string;count:number}[];quarantineBuckets:{label:string;count:number}[];quarantineSports:{label:string;count:number}[]}
  groups:{unlinked:Row[];updates:Row[];newGames:Row[];external:Row[];quarantines:Row[]}
}

function readable(v:string){return v.replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
function fmt(v:any){return v===null||v===undefined||v===''?'—':String(v)}

export default function SeasonPreflight({seasons}:{seasons:Season[]}){
  const initial=seasons.find(s=>s.season_type==='Winter')?.id||seasons.find(s=>s.is_active)?.id||seasons[0]?.id||''
  const [seasonId,setSeasonId]=useState(initial)
  const [result,setResult]=useState<Result|null>(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [tab,setTab]=useState<'unlinked'|'newGames'|'external'|'updates'|'quarantines'>('unlinked')
  const [sport,setSport]=useState('All')
  const selected=useMemo(()=>seasons.find(s=>s.id===seasonId)||null,[seasons,seasonId])

  async function load(id=seasonId){
    if(!id)return
    setLoading(true);setError(null)
    try{
      const r=await fetch(`/api/admin/arbiter-api/preflight?seasonId=${encodeURIComponent(id)}`,{cache:'no-store'})
      const j=await r.json()
      if(!r.ok||!j.ok)throw new Error(j.error||'Preflight failed')
      setResult(j);setSport('All')
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setLoading(false)}
  }

  useEffect(()=>{void load(seasonId)},[seasonId])

  const rows=result?.groups?.[tab]||[]
  const filtered=sport==='All'?rows:rows.filter(r=>(r.sport||'Unknown')===sport)
  const sportOptions=['All',...Array.from(new Set(rows.map(r=>r.sport||'Unknown'))).sort()]
  const a=result?.adoption
  const firstAdoption=Boolean(a&&a.alreadyStable===0&&a.totalActionable>0)

  const tabs:[typeof tab,string,number][]=[
    ['unlinked','Existing Matches',result?.groups.unlinked.length||0],
    ['newGames','New Games',result?.groups.newGames.length||0],
    ['external','External Games',result?.groups.external.length||0],
    ['updates','Schedule Updates',result?.groups.updates.length||0],
    ['quarantines','Quarantine',result?.groups.quarantines.length||0],
  ]

  return <div className="p-4 max-w-6xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><ShieldCheck size={24} style={{color:'var(--accent-bright)'}}/><h1 className="text-2xl font-bold text-white" style={{fontFamily:'var(--font-display)'}}>Season Adoption Preflight</h1></div>
        <p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Read-only risk review before a season is adopted into stable Arbiter identity.</p>
      </div>
      <Link href="/admin/schedule-intelligence" className="admin-action-btn">← Schedule Intelligence</Link>
    </div>

    <div className="card p-4 flex flex-col md:flex-row md:items-end gap-3">
      <label className="flex-1 text-sm"><span className="block mb-1" style={{color:'var(--text-muted)'}}>Season</span><select value={seasonId} onChange={e=>setSeasonId(e.target.value)} className="w-full rounded-lg px-3 py-2 bg-black/30 border border-white/10 text-white">{seasons.map(s=><option key={s.id} value={s.id}>{s.name}{s.is_active?' — ACTIVE':''}</option>)}</select></label>
      <button onClick={()=>load()} disabled={loading} className="admin-action-btn justify-center md:min-w-[180px] disabled:opacity-40"><RefreshCw size={18} className={loading?'animate-spin':''}/><span>{loading?'Reading…':'Refresh Preflight'}</span></button>
    </div>

    {error&&<div className="rounded-lg p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm"><AlertTriangle className="inline mr-2" size={16}/>{error}</div>}

    {result&&a&&<>
      <div className={`rounded-xl p-4 border ${a.blockers>0?'border-red-500/30 bg-red-500/10':firstAdoption?'border-amber-500/30 bg-amber-500/10':'border-emerald-500/30 bg-emerald-500/10'}`}>
        <div className="flex items-start gap-3">{a.blockers>0?<AlertTriangle className="text-red-400"/>:<CheckCircle2 className={firstAdoption?'text-amber-300':'text-emerald-400'}/>}<div><div className="font-bold text-white">{a.blockers>0?'Adoption blocked':firstAdoption?'First-season adoption preflight':'Season reconciliation preflight'}</div><div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>{a.existingToLink} existing games would be linked, {a.newGames} new internal games would be created, {a.externalGames} external-opponent games would be created/reused, {a.stableUpdates} stable games need schedule updates, and {a.quarantined} uncertain records would remain untouched.</div></div></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Existing to Link',a.existingToLink],['New Games',a.newGames],['External Games',a.externalGames],['Stable Updates',a.stableUpdates],['Quarantined',a.quarantined],['Already Stable',a.alreadyStable],['Total Actionable',a.totalActionable],['Blockers',a.blockers]
        ].map(([label,value])=><div key={String(label)} className="card p-4"><div className="text-2xl font-bold text-white">{value}</div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{label}</div></div>)}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="card p-4"><h2 className="font-semibold text-white mb-3">Actionable by sport</h2><div className="space-y-2 text-sm">{result.breakdowns.sports.length?result.breakdowns.sports.map(x=><div key={x.label} className="flex justify-between"><span style={{color:'var(--text-secondary)'}}>{x.label}</span><strong className="text-white">{x.count}</strong></div>):<div style={{color:'var(--text-muted)'}}>No actionable rows.</div>}</div></div>
        <div className="card p-4"><h2 className="font-semibold text-white mb-3">Quarantine by reason</h2><div className="space-y-2 text-sm">{result.breakdowns.quarantineBuckets.length?result.breakdowns.quarantineBuckets.map(x=><div key={x.label} className="flex justify-between"><span style={{color:'var(--text-secondary)'}}>{readable(x.label)}</span><strong className="text-white">{x.count}</strong></div>):<div style={{color:'var(--text-muted)'}}>No quarantined rows.</div>}</div></div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap gap-2">{tabs.map(([key,label,count])=><button key={key} onClick={()=>{setTab(key);setSport('All')}} className={`px-3 py-2 rounded-lg text-sm border ${tab===key?'border-blue-400/50 bg-blue-500/10 text-white':'border-white/10 text-slate-300'}`}>{label} <strong>{count}</strong></button>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm" style={{color:'var(--text-secondary)'}}>{filtered.length} record{filtered.length===1?'':'s'} shown</div><select value={sport} onChange={e=>setSport(e.target.value)} className="rounded-lg px-3 py-2 bg-black/30 border border-white/10 text-white text-sm">{sportOptions.map(s=><option key={s}>{s}</option>)}</select></div>
        <div className="space-y-3 max-h-[760px] overflow-auto pr-1">{filtered.length===0?<div className="text-sm text-emerald-300">Nothing in this bucket.</div>:filtered.map(r=><div key={`${r.arbiterGameId}-${r.bucket}`} className="rounded-lg border border-white/10 bg-black/20 p-3"><div className="flex flex-wrap justify-between gap-2"><div><strong className="text-white">{fmt(r.away)} at {fmt(r.home)}</strong><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>{fmt(r.sport)} · {fmt(r.date)} · {fmt(r.time)} · {readable(r.bucket)}</div></div><span className="text-xs text-amber-300">Arbiter #{fmt(r.arbiterGameId)}</span></div>{r.existingGameId&&<div className="text-xs mt-2 text-blue-300">Existing Section X game: {r.existingGameId}</div>}{(r.driftReasons||[]).length>0&&<div className="text-xs mt-2 text-amber-200">Changes: {r.driftReasons.map(readable).join(', ')}</div>}{(r.mappingIssues||[]).length>0&&<div className="text-xs mt-2 text-red-300">Issues: {r.mappingIssues.map(readable).join(', ')}</div>}{(r.warnings||[]).length>0&&<div className="text-xs mt-2" style={{color:'var(--text-muted)'}}>Warnings: {r.warnings.map(readable).join(', ')}</div>}</div>)}</div>
      </div>

      {firstAdoption&&<div className="rounded-xl p-4 border border-amber-500/30 bg-amber-500/10"><h2 className="font-semibold text-white">First Adoption Safety</h2><p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Do not run the season writer until the Existing Matches bucket and Quarantine bucket have been reviewed. The normal Schedule Intelligence writer remains the only place that can apply changes; this preflight page is read-only.</p></div>}
    </>}
  </div>
}
