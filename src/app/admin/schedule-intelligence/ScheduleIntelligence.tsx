'use client'

import { useEffect, useMemo, useState } from 'react'
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
    pendingChanges?:number
    writerReady:boolean
  }
}
type RunState = {
  id:string
  status:string
  summary:any
  createdAt:string
  finishedAt:string|null
  isRunning:boolean
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))

export default function ScheduleIntelligence({ seasons }:{ seasons:Season[] }) {
  const initial = seasons.find(s=>s.is_active)?.id || seasons[0]?.id || ''
  const [seasonId,setSeasonId]=useState(initial)
  const [audit,setAudit]=useState<Audit|null>(null)
  const [runState,setRunState]=useState<RunState|null>(null)
  const [syncResult,setSyncResult]=useState<any>(null)
  const [loading,setLoading]=useState(false)
  const [syncing,setSyncing]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const selected=useMemo(()=>seasons.find(s=>s.id===seasonId)||null,[seasons,seasonId])

  async function fetchStatus(id=seasonId){
    if(!id)return null
    const r=await fetch(`/api/admin/arbiter-api/sync/status?seasonId=${encodeURIComponent(id)}`,{cache:'no-store'})
    const j=await r.json()
    if(!r.ok||!j.ok)throw new Error(j.error||'Could not load sync status')
    setRunState(j.run||null)
    return j.run as RunState|null
  }

  async function runAudit(id=seasonId){
    if(!id)return
    setLoading(true);setError(null)
    try{
      const r=await fetch(`/api/admin/arbiter-api/games-dry-run?seasonId=${encodeURIComponent(id)}`,{cache:'no-store'})
      const j=await r.json()
      if(!r.ok||!j.ok)throw new Error(j.error||'Dry run failed')
      setAudit(j)
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setLoading(false)}
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
    throw new Error('Sync is taking longer than expected. The run is still protected by the server-side lock; refresh this page to check its status.')
  }

  async function runSync(){
    if(!audit?.comparison.writerReady||!seasonId)return
    const pending=audit.comparison.pendingChanges??0
    const message=pending>0
      ? `Run the CONTROLLED Arbiter sync for ${selected?.name || 'this season'}?\n\n${pending} schedule change${pending===1?'':'s'} are waiting. Quarantined rows will remain untouched.`
      : `Run a verification sync for ${selected?.name || 'this season'}?\n\nNo schedule changes are currently pending. This will verify stable identities and check Arbiter deleted-game status.`
    if(!window.confirm(message))return

    setSyncing(true);setError(null);setSyncResult(null)
    const startedAt=Date.now()
    try{
      const postPromise=fetch('/api/admin/arbiter-api/sync',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({confirm:'APPLY_ARBITER_SCHEDULE_SYNC',seasonId})
      }).then(async r=>{
        const j=await r.json()
        if(!r.ok&&r.status!==207)throw new Error(j.error||'Controlled sync failed')
        return {kind:'response',data:j}
      })

      const pollPromise=pollForRun(startedAt).then(run=>({kind:'status',data:run}))
      const winner:any=await Promise.race([postPromise,pollPromise])
      if(winner.kind==='response'){
        setSyncResult(winner.data)
        await fetchStatus()
      }else{
        setRunState(winner.data)
        setSyncResult({runId:winner.data.id,totals:winner.data.summary})
      }
      await runAudit()
    }catch(e){
      setError(e instanceof Error?e.message:String(e))
      try{await fetchStatus()}catch{}
    }finally{setSyncing(false)}
  }

  useEffect(()=>{
    if(!seasonId)return
    setAudit(null);setSyncResult(null);setError(null)
    void runAudit(seasonId)
    void fetchStatus(seasonId).then(run=>{
      if(run?.status==='running')setSyncing(true)
    }).catch(()=>{})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[seasonId])

  useEffect(()=>{
    if(!syncing||!seasonId)return
    const timer=setInterval(()=>{
      void fetchStatus().then(run=>{
        if(run&&run.status!=='running'){
          setSyncing(false)
          setSyncResult({runId:run.id,totals:run.summary})
          void runAudit()
        }
      }).catch(()=>{})
    },2500)
    return()=>clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[syncing,seasonId])

  const counts=audit?.comparison.counts||{}
  const stable=counts['stable-id-match']||0
  const stableUpdates=counts['stable-id-update']||0
  const exact=counts['exact-match']||0
  const probable=counts['probable-match']||0
  const newGames=counts['new-game']||0
  const external=counts['external-create']||0
  const pending=audit?.comparison.pendingChanges??(stableUpdates+exact+probable+newGames+external)
  const unlinked=exact+probable
  const scheduleUpdates=stableUpdates+probable
  const synchronized=Boolean(audit&&pending===0&&stable>0&&audit.comparison.trueBlockers===0)
  const progress=runState?.status==='running'?runState.summary?.progress:null
  const displayTotals=syncResult?.totals||((runState&&runState.status!=='running')?runState.summary:null)

  const cards=[
    ['Synced / Stable',audit?stable:'—'],
    ['Changes Pending',audit?pending:'—'],
    ['Unlinked Matches',audit?unlinked:'—'],
    ['Schedule Updates',audit?scheduleUpdates:'—'],
    ['New Games',audit?newGames:'—'],
    ['External Creates',audit?external:'—'],
    ['Quarantined',audit?.comparison.quarantined??'—'],
    ['Global Blockers',audit?.comparison.trueBlockers??'—'],
  ]

  return <div className="p-4 max-w-6xl space-y-5">
    <div>
      <div className="flex items-center gap-2"><ShieldCheck size={24} style={{color:'var(--accent-bright)'}}/><h1 className="text-2xl font-bold text-white" style={{fontFamily:'var(--font-display)'}}>Schedule Intelligence</h1></div>
      <p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Arbiter Partner API → normalize → reconcile → stable identity → quarantine ambiguity → controlled upsert.</p>
    </div>

    <div className="card p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <label className="flex-1 text-sm"><span className="block mb-1" style={{color:'var(--text-muted)'}}>Season</span>
          <select value={seasonId} onChange={e=>setSeasonId(e.target.value)} disabled={syncing} className="w-full rounded-lg px-3 py-2 bg-black/30 border border-white/10 text-white disabled:opacity-50">
            {seasons.map(s=><option key={s.id} value={s.id}>{s.name}{s.is_active?' — ACTIVE':''}</option>)}
          </select>
        </label>
        <button onClick={()=>runAudit()} disabled={loading||syncing||!seasonId} className="admin-action-btn justify-center md:min-w-[180px] disabled:opacity-40">
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
            <div className="font-bold text-white">{synchronized?'Schedule synchronized':audit.comparison.writerReady?'Controlled writer ready':'Writer not ready'}</div>
            <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>
              {synchronized
                ? `${stable} Arbiter games are linked by permanent identity. No schedule changes are currently waiting to be applied.`
                : audit.comparison.writerReady
                  ? `${pending} change${pending===1?'':'s'} can be safely processed while TBA, event sports, title/type conflicts and other uncertain records remain quarantined.`
                  : 'A global identity blocker must be resolved before controlled writes can run.'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="card p-4"><h2 className="font-semibold text-white mb-3">Quarantine breakdown</h2><div className="space-y-2 text-sm">{['manual-review','event-sport','title-type-conflict','ambiguous-match','mapping-needed','orphaned-link','source-cancelled','other-season'].map(k=><div key={k} className="flex justify-between"><span style={{color:'var(--text-secondary)'}}>{k}</span><strong className="text-white">{counts[k]||0}</strong></div>)}</div></div>
        <div className="card p-4"><h2 className="font-semibold text-white mb-3">Write safety</h2><div className="space-y-2 text-sm" style={{color:'var(--text-secondary)'}}><p>• Stable Arbiter IDs are permanent identities.</p><p>• Existing matches update instead of duplicating.</p><p>• New external opponents are safely reused or created.</p><p>• Same-day doubleheaders are time-aware.</p><p>• Event sports and uncertain records stay quarantined.</p><p>• Deleted Arbiter games are canceled, never hard-deleted.</p><p>• Concurrent sync runs are server-side locked.</p><p>• Every controlled action is audit logged.</p></div></div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div>
            <h2 className="font-semibold text-white">Controlled Sync</h2>
            <p className="text-sm" style={{color:'var(--text-muted)'}}>{pending>0?`${pending} change${pending===1?'':'s'} pending. Explicit confirmation is required.`:'No schedule changes pending. A verification run can still check stable links and Arbiter deletions.'}</p>
            {syncing&&progress&&<p className="text-sm mt-2 text-blue-300">Processing {progress.processed||0} of {progress.total||0} records…</p>}
          </div>
          <button onClick={runSync} disabled={!audit.comparison.writerReady||syncing} className="admin-action-btn justify-center md:min-w-[220px] disabled:opacity-40">
            {syncing?<RefreshCw size={18} className="animate-spin"/>:<Play size={18}/>}<span>{syncing?'Sync running…':pending>0?'Run Controlled Sync':'Run Verification Sync'}</span>
          </button>
        </div>
      </div>
    </>}

    {displayTotals&&<div className="card p-4">
      <div className="flex items-center justify-between gap-3 mb-3"><h2 className="font-semibold text-white">Latest controlled run</h2>{runState?.status&&<span className="text-xs px-2 py-1 rounded bg-black/30" style={{color:'var(--text-muted)'}}>{runState.status}</span>}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {['linked','updated','created','externalCreated','verifiedStable','quarantined','ignoredOtherSeason','deletedMarked','failed'].map(k=>displayTotals[k]!==undefined&&<div key={k} className="rounded-lg bg-black/20 p-3"><div className="text-xl font-bold text-white">{String(displayTotals[k])}</div><div style={{color:'var(--text-muted)'}}>{k}</div></div>)}
      </div>
      {(syncResult?.runId||runState?.id)&&<div className="text-xs mt-3" style={{color:'var(--text-muted)'}}>Run ID: {syncResult?.runId||runState?.id}</div>}
    </div>}
  </div>
}
