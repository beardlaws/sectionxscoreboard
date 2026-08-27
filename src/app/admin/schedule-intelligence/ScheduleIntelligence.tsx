'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, History, Play, RefreshCw, SearchCheck, ShieldCheck } from 'lucide-react'

type Season = { id:string; name:string; year:number; season_type:string; is_active:boolean }
type Audit = {
  ok:boolean
  season:{id:string;name:string;year:number;type:string}
  comparison:{
    counts:Record<string,number>
    eligible:number
    quarantined:number
    trueBlockers:number
    pendingChanges?:number
    writerReady:boolean
  }
  rows?:any[]
}
type RunState = { id:string; status:string; summary:any; createdAt:string; finishedAt:string|null; isRunning:boolean }
type HistoryState = { checks:any[]; runs:any[] }

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
const PENDING=new Set(['stable-id-update','exact-match','probable-match','new-game','external-create'])

function fmt(v:any){
  if(v===null||v===undefined||v==='')return '—'
  return String(v)
}
function readable(k:string){return k.replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}

export default function ScheduleIntelligence({ seasons }:{ seasons:Season[] }) {
  const initial=seasons.find(s=>s.is_active)?.id||seasons[0]?.id||''
  const [seasonId,setSeasonId]=useState(initial)
  const [audit,setAudit]=useState<Audit|null>(null)
  const [runState,setRunState]=useState<RunState|null>(null)
  const [syncResult,setSyncResult]=useState<any>(null)
  const [history,setHistory]=useState<HistoryState>({checks:[],runs:[]})
  const [loading,setLoading]=useState(false)
  const [fullChecking,setFullChecking]=useState(false)
  const [allChecking,setAllChecking]=useState(false)
  const [allSeasonResults,setAllSeasonResults]=useState<any[]>([])
  const [syncing,setSyncing]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [showReview,setShowReview]=useState(true)
  const [showQuarantine,setShowQuarantine]=useState(false)
  const selected=useMemo(()=>seasons.find(s=>s.id===seasonId)||null,[seasons,seasonId])

  async function fetchStatus(id=seasonId){
    if(!id)return null
    const r=await fetch(`/api/admin/arbiter-api/sync/status?seasonId=${encodeURIComponent(id)}`,{cache:'no-store'})
    const j=await r.json()
    if(!r.ok||!j.ok)throw new Error(j.error||'Could not load sync status')
    setRunState(j.run||null)
    return j.run as RunState|null
  }

  async function fetchHistory(id=seasonId){
    if(!id)return
    const r=await fetch(`/api/admin/arbiter-api/history?seasonId=${encodeURIComponent(id)}&limit=8`,{cache:'no-store'})
    const j=await r.json()
    if(!r.ok||!j.ok)throw new Error(j.error||'Could not load history')
    setHistory({checks:j.checks||[],runs:j.runs||[]})
  }

  async function runAudit(id=seasonId){
    if(!id)return null
    setLoading(true);setError(null)
    try{
      const r=await fetch(`/api/admin/arbiter-api/games-dry-run?seasonId=${encodeURIComponent(id)}`,{cache:'no-store'})
      const j=await r.json()
      if(!r.ok||!j.ok)throw new Error(j.error||'Dry run failed')
      if(id===seasonId)setAudit(j)
      return j as Audit
    }catch(e){setError(e instanceof Error?e.message:String(e));return null}finally{setLoading(false)}
  }

  async function runFullCheck(id=seasonId,quiet=false){
    if(!id)return null
    if(!quiet)setFullChecking(true)
    setError(null)
    try{
      const r=await fetch(`/api/admin/arbiter-api/health-check?seasonId=${encodeURIComponent(id)}`,{cache:'no-store'})
      const j=await r.json()
      if(!r.ok||!j.ok)throw new Error(j.error||'Full read check failed')
      if(id===seasonId){
        setAudit(j.audit)
        await fetchHistory(id)
      }
      return j
    }catch(e){if(!quiet)setError(e instanceof Error?e.message:String(e));return null}finally{if(!quiet)setFullChecking(false)}
  }

  async function checkAllSeasons(){
    setAllChecking(true);setError(null);setAllSeasonResults([])
    const results:any[]=[]
    try{
      for(const season of seasons){
        const j=await runFullCheck(season.id,true)
        results.push({season:season.name,status:j?.status||'error',summary:j?.summary||null})
        setAllSeasonResults([...results])
      }
      await fetchHistory()
      await runAudit()
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setAllChecking(false)}
  }

  async function pollForRun(startedAt:number){
    for(let i=0;i<180;i++){
      await sleep(2000)
      const run=await fetchStatus()
      if(!run)continue
      const created=new Date(run.createdAt).getTime()
      if(created<startedAt-5000)continue
      if(run.status!=='running')return run
    }
    throw new Error('Sync is taking longer than expected. Refresh this page to check its protected run status.')
  }

  async function runSync(){
    if(!audit?.comparison.writerReady||!seasonId)return
    const pending=audit.comparison.pendingChanges??0
    const message=pending>0
      ? `Run the CONTROLLED Arbiter sync for ${selected?.name||'this season'}?\n\n${pending} schedule change${pending===1?'':'s'} are waiting. Quarantined rows will remain untouched.`
      : `Run a verification sync for ${selected?.name||'this season'}?\n\nNo schedule changes are currently pending. This will verify stable identities and check Arbiter deleted-game status.`
    if(!window.confirm(message))return
    setSyncing(true);setError(null);setSyncResult(null)
    const startedAt=Date.now()
    try{
      const postPromise=fetch('/api/admin/arbiter-api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:'APPLY_ARBITER_SCHEDULE_SYNC',seasonId})}).then(async r=>{
        const j=await r.json();if(!r.ok&&r.status!==207)throw new Error(j.error||'Controlled sync failed');return{kind:'response',data:j}
      })
      const pollPromise=pollForRun(startedAt).then(run=>({kind:'status',data:run}))
      const winner:any=await Promise.race([postPromise,pollPromise])
      if(winner.kind==='response'){setSyncResult(winner.data);await fetchStatus()}
      else{setRunState(winner.data);setSyncResult({runId:winner.data.id,totals:winner.data.summary})}
      await runFullCheck()
    }catch(e){setError(e instanceof Error?e.message:String(e));try{await fetchStatus()}catch{}}finally{setSyncing(false)}
  }

  useEffect(()=>{
    if(!seasonId)return
    setAudit(null);setSyncResult(null);setError(null);setAllSeasonResults([])
    void runAudit(seasonId)
    void fetchHistory(seasonId).catch(()=>{})
    void fetchStatus(seasonId).then(run=>{if(run?.status==='running')setSyncing(true)}).catch(()=>{})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[seasonId])

  useEffect(()=>{
    if(!syncing||!seasonId)return
    const timer=setInterval(()=>{void fetchStatus().then(run=>{if(run&&run.status!=='running'){setSyncing(false);setSyncResult({runId:run.id,totals:run.summary});void runFullCheck()}}).catch(()=>{})},2500)
    return()=>clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[syncing,seasonId])

  const counts=audit?.comparison.counts||{}
  const stable=counts['stable-id-match']||0,stableUpdates=counts['stable-id-update']||0,exact=counts['exact-match']||0,probable=counts['probable-match']||0,newGames=counts['new-game']||0,external=counts['external-create']||0
  const pending=audit?.comparison.pendingChanges??(stableUpdates+exact+probable+newGames+external)
  const unlinked=exact+probable,scheduleUpdates=stableUpdates+probable
  const synchronized=Boolean(audit&&pending===0&&stable>0&&audit.comparison.trueBlockers===0)
  const progress=runState?.status==='running'?runState.summary?.progress:null
  const displayTotals=syncResult?.totals||((runState&&runState.status!=='running')?runState.summary:null)
  const pendingRows=(audit?.rows||[]).filter((r:any)=>PENDING.has(r.bucket))
  const quarantineRows=(audit?.rows||[]).filter((r:any)=>r.quarantined&&r.bucket!=='other-season')
  const latestCheck=history.checks?.[0]||null
  const cards=[['Synced / Stable',audit?stable:'—'],['Changes Pending',audit?pending:'—'],['Unlinked Matches',audit?unlinked:'—'],['Schedule Updates',audit?scheduleUpdates:'—'],['New Games',audit?newGames:'—'],['External Creates',audit?external:'—'],['Quarantined',audit?.comparison.quarantined??'—'],['Global Blockers',audit?.comparison.trueBlockers??'—']]

  return <div className="p-4 max-w-6xl space-y-5">
    <div>
      <div className="flex items-center gap-2"><ShieldCheck size={24} style={{color:'var(--accent-bright)'}}/><h1 className="text-2xl font-bold text-white" style={{fontFamily:'var(--font-display)'}}>Schedule Intelligence</h1></div>
      <p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Arbiter Partner API → read everything → normalize → reconcile → explain changes → quarantine ambiguity → controlled upsert.</p>
    </div>

    <div className="card p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <label className="flex-1 text-sm"><span className="block mb-1" style={{color:'var(--text-muted)'}}>Season</span><select value={seasonId} onChange={e=>setSeasonId(e.target.value)} disabled={syncing||allChecking} className="w-full rounded-lg px-3 py-2 bg-black/30 border border-white/10 text-white disabled:opacity-50">{seasons.map(s=><option key={s.id} value={s.id}>{s.name}{s.is_active?' — ACTIVE':''}</option>)}</select></label>
        <button onClick={()=>runAudit()} disabled={loading||syncing||fullChecking||allChecking||!seasonId} className="admin-action-btn justify-center md:min-w-[160px] disabled:opacity-40"><RefreshCw size={18} className={loading?'animate-spin':''}/><span>{loading?'Checking…':'Quick Dry Check'}</span></button>
        <button onClick={()=>runFullCheck()} disabled={fullChecking||syncing||allChecking||!seasonId} className="admin-action-btn justify-center md:min-w-[180px] disabled:opacity-40"><SearchCheck size={18} className={fullChecking?'animate-pulse':''}/><span>{fullChecking?'Reading…':'Full Read Check'}</span></button>
        <button onClick={checkAllSeasons} disabled={allChecking||syncing||fullChecking} className="admin-action-btn justify-center md:min-w-[180px] disabled:opacity-40"><ShieldCheck size={18}/><span>{allChecking?'Checking Seasons…':'Check All Seasons'}</span></button>
      </div>
      {latestCheck&&<div className="text-xs" style={{color:'var(--text-muted)'}}>Last persisted full read: {new Date(latestCheck.created_at).toLocaleString()} · {readable(latestCheck.status)}</div>}
    </div>

    {allSeasonResults.length>0&&<div className="grid md:grid-cols-3 gap-3">{allSeasonResults.map(r=><div key={r.season} className="card p-4"><div className="flex justify-between gap-2"><strong className="text-white">{r.season}</strong><span className={`text-xs ${r.status==='healthy'?'text-emerald-400':r.status==='blocked'||r.status==='error'?'text-red-400':'text-amber-300'}`}>{readable(r.status)}</span></div><div className="text-xs mt-2 space-y-1" style={{color:'var(--text-secondary)'}}><div>Synced: {r.summary?.syncedStable??'—'}</div><div>Pending: {r.summary?.pendingChanges??'—'}</div><div>Quarantined: {r.summary?.quarantined??'—'}</div><div>Blockers: {r.summary?.trueBlockers??'—'}</div></div></div>)}</div>}

    {error&&<div className="rounded-lg p-3 text-sm border border-red-500/30 bg-red-500/10 text-red-300"><AlertTriangle className="inline mr-2" size={16}/>{error}</div>}

    {audit&&<>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{cards.map(([label,value])=><div className="card p-4" key={String(label)}><div className="text-2xl font-bold text-white">{value}</div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{label}</div></div>)}</div>

      <div className={`rounded-xl p-4 border ${audit.comparison.writerReady?'border-emerald-500/30 bg-emerald-500/10':'border-red-500/30 bg-red-500/10'}`}><div className="flex items-start gap-3">{audit.comparison.writerReady?<CheckCircle2 className="text-emerald-400"/>:<AlertTriangle className="text-red-400"/>}<div className="flex-1"><div className="font-bold text-white">{synchronized?'Schedule synchronized':audit.comparison.writerReady?'Controlled writer ready':'Writer not ready'}</div><div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>{synchronized?`${stable} Arbiter games are linked by permanent identity. No schedule changes are currently waiting to be applied.`:audit.comparison.writerReady?`${pending} change${pending===1?'':'s'} can be safely processed while uncertain records remain quarantined.`:'A global identity blocker must be resolved before controlled writes can run.'}</div></div></div></div>

      <div className="card overflow-hidden">
        <button onClick={()=>setShowReview(v=>!v)} className="w-full p-4 flex items-center justify-between text-left"><div><h2 className="font-semibold text-white">Change Review</h2><p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{pendingRows.length?`${pendingRows.length} Arbiter record${pendingRows.length===1?'':'s'} waiting for controlled action.`:'Nothing waiting. This is what we want.'}</p></div>{showReview?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>
        {showReview&&<div className="border-t border-white/10 p-4 space-y-3">{pendingRows.length===0?<div className="text-sm text-emerald-300">No pending schedule changes.</div>:pendingRows.map((r:any)=><div key={`${r.uniqueGameId}-${r.bucket}`} className="rounded-lg border border-white/10 bg-black/20 p-3"><div className="flex flex-wrap justify-between gap-2"><div><strong className="text-white">{fmt(r.away?.mapped||r.away?.arbiter)} at {fmt(r.home?.mapped||r.home?.arbiter)}</strong><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>{fmt(r.sport)} · {fmt(r.date)} · {fmt(r.time)} · {readable(r.bucket)}</div></div><span className="text-xs text-amber-300">Arbiter #{fmt(r.uniqueGameId)}</span></div>{(r.driftReasons||[]).length>0&&<div className="mt-3 flex flex-wrap gap-2">{r.driftReasons.map((d:string)=><span key={d} className="text-xs rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-amber-200">{readable(d)}</span>)}</div>}{r.existing&&<div className="grid md:grid-cols-2 gap-2 mt-3 text-xs"><div className="rounded bg-black/20 p-2"><div className="font-semibold text-white mb-1">Section X now</div><div style={{color:'var(--text-secondary)'}}>{fmt(r.existing.gameDate)} · {fmt(String(r.existing.gameTime||'').slice(0,5))} · {fmt(r.existing.location)} · {fmt(r.existing.status)}</div></div><div className="rounded bg-black/20 p-2"><div className="font-semibold text-white mb-1">Arbiter source</div><div style={{color:'var(--text-secondary)'}}>{fmt(r.date)} · {fmt(r.time)} · {fmt(r.location)} · {fmt(r.status)}</div></div></div>}</div>)}</div>}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="card overflow-hidden"><button onClick={()=>setShowQuarantine(v=>!v)} className="w-full p-4 flex justify-between items-center"><div className="text-left"><h2 className="font-semibold text-white">Quarantine Review</h2><p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{quarantineRows.length} records intentionally withheld from automatic writing.</p></div>{showQuarantine?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>{showQuarantine&&<div className="border-t border-white/10 p-4 max-h-[520px] overflow-auto space-y-2">{quarantineRows.map((r:any)=><div key={`${r.uniqueGameId}-${r.bucket}`} className="rounded bg-black/20 p-3 text-xs"><div className="flex justify-between gap-2"><strong className="text-white">{fmt(r.away?.mapped||r.away?.arbiter)} at {fmt(r.home?.mapped||r.home?.arbiter)}</strong><span className="text-amber-300">{readable(r.bucket)}</span></div><div className="mt-1" style={{color:'var(--text-secondary)'}}>{fmt(r.sport)} · {fmt(r.date)} · {fmt(r.time)}</div>{[...(r.mappingIssues||[]),...(r.warnings||[])].length>0&&<div className="mt-2" style={{color:'var(--text-muted)'}}>{[...(r.mappingIssues||[]),...(r.warnings||[])].map(readable).join(' · ')}</div>}</div>)}</div>}</div>
        <div className="card p-4"><h2 className="font-semibold text-white mb-3">Write safety</h2><div className="space-y-2 text-sm" style={{color:'var(--text-secondary)'}}><p>• Stable Arbiter IDs are permanent identities.</p><p>• Existing matches update instead of duplicating.</p><p>• New external opponents are safely reused or created.</p><p>• Same-day doubleheaders are time-aware.</p><p>• Event sports and uncertain records stay quarantined.</p><p>• Deleted Arbiter games are canceled, never hard-deleted.</p><p>• Concurrent sync runs are database locked.</p><p>• Every controlled action and full read check is audit logged.</p></div></div>
      </div>

      <div className="card p-4"><div className="flex flex-col md:flex-row md:items-center gap-3 justify-between"><div><h2 className="font-semibold text-white">Controlled Sync</h2><p className="text-sm" style={{color:'var(--text-muted)'}}>{pending>0?`${pending} change${pending===1?'':'s'} pending. Explicit confirmation is required.`:'No schedule changes pending. A verification run can still check stable links and Arbiter deletions.'}</p>{syncing&&progress&&<p className="text-sm mt-2 text-blue-300">Processing {progress.processed||0} of {progress.total||0} records…</p>}</div><button onClick={runSync} disabled={!audit.comparison.writerReady||syncing} className="admin-action-btn justify-center md:min-w-[220px] disabled:opacity-40">{syncing?<RefreshCw size={18} className="animate-spin"/>:<Play size={18}/>}<span>{syncing?'Sync running…':pending>0?'Run Controlled Sync':'Run Verification Sync'}</span></button></div></div>
    </>}

    <div className="grid md:grid-cols-2 gap-3">
      {displayTotals&&<div className="card p-4"><div className="flex items-center justify-between gap-3 mb-3"><h2 className="font-semibold text-white">Latest controlled run</h2>{runState?.status&&<span className="text-xs px-2 py-1 rounded bg-black/30" style={{color:'var(--text-muted)'}}>{runState.status}</span>}</div><div className="grid grid-cols-2 gap-3 text-sm">{['linked','updated','created','externalCreated','verifiedStable','quarantined','ignoredOtherSeason','deletedMarked','failed'].map(k=>displayTotals[k]!==undefined&&<div key={k} className="rounded-lg bg-black/20 p-3"><div className="text-xl font-bold text-white">{String(displayTotals[k])}</div><div style={{color:'var(--text-muted)'}}>{k}</div></div>)}</div>{(syncResult?.runId||runState?.id)&&<div className="text-xs mt-3" style={{color:'var(--text-muted)'}}>Run ID: {syncResult?.runId||runState?.id}</div>}</div>}
      <div className="card p-4"><div className="flex items-center gap-2 mb-3"><History size={18}/><h2 className="font-semibold text-white">Health history</h2></div>{history.checks.length===0?<p className="text-sm" style={{color:'var(--text-muted)'}}>Run a Full Read Check to start the health ledger.</p>:<div className="space-y-2">{history.checks.slice(0,6).map((h:any)=><div key={h.id} className="rounded bg-black/20 p-3 flex justify-between gap-3 text-xs"><div><div className="text-white">{new Date(h.created_at).toLocaleString()}</div><div style={{color:'var(--text-muted)'}}>{h.summary?.pendingChanges||0} pending · {h.summary?.quarantined||0} quarantined · {h.summary?.trueBlockers||0} blockers</div></div><span className={h.status==='healthy'?'text-emerald-400':h.status==='blocked'?'text-red-400':'text-amber-300'}>{readable(h.status)}</span></div>)}</div>}</div>
    </div>
  </div>
}
