'use client'

import { useEffect, useMemo, useState } from 'react'

type Game = { id:string; gameDate:string; gameTime:string|null; sport:string|null; gender:string|null; home:string; away:string; label:string }
type Contributor = { id:string; subjectId:string; name:string; email:string|null }
type Readiness = { d1:boolean; realtimeKitConfigured:boolean; publisherPreset:string; listenerPreset:string }
type Broadcast = {
  id:string; gameId:string; title:string; status:string; publicEnabled:boolean; rightsStatus:string; rightsHolder:string|null;
  rightsApprovedBy:string|null; rightsApprovedAt:string|null; rightsDocumentUrl:string|null; rightsNotes:string|null;
  assignments:string; sport:string|null; gender:string|null; home:string; away:string; scheduledAt:string|null
}

export default function LiveAudioAdmin(){
  const [games,setGames]=useState<Game[]>([])
  const [contributors,setContributors]=useState<Contributor[]>([])
  const [broadcasts,setBroadcasts]=useState<Broadcast[]>([])
  const [readiness,setReadiness]=useState<Readiness|null>(null)
  const [gameId,setGameId]=useState('')
  const [working,setWorking]=useState(false)
  const [error,setError]=useState('')

  async function load(){
    setError('')
    const response=await fetch('/api/admin/live-audio',{cache:'no-store'})
    const data=await response.json()
    if(!response.ok)throw new Error(data.error||'Could not load live audio admin.')
    setGames(data.games||[]);setContributors(data.contributors||[]);setBroadcasts(data.broadcasts||[]);setReadiness(data.readiness||null)
    setGameId((current)=>current||data.games?.[0]?.id||'')
  }

  useEffect(()=>{load().catch((e)=>setError(e.message))},[])

  const availableGames=useMemo(()=>{
    const used=new Set(broadcasts.filter((b)=>b.status!=='canceled').map((b)=>b.gameId))
    return games.filter((g)=>!used.has(g.id))
  },[games,broadcasts])

  async function action(payload:any){
    setWorking(true);setError('')
    try{
      const response=await fetch('/api/admin/live-audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      const data=await response.json()
      if(!response.ok)throw new Error(data.error||'Live audio action failed.')
      await load()
      return data
    }catch(e:any){setError(e?.message||'Live audio action failed.');throw e}
    finally{setWorking(false)}
  }

  async function createBroadcast(){if(gameId)await action({action:'create',gameId})}

  return <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Section X Live</div>
      <h1 className="text-2xl md:text-3xl font-black text-white mt-1">Live Audio Control Room</h1>
      <p className="text-sm text-slate-400 mt-2 max-w-3xl">Create broadcasts from existing games, assign approved contributors, and clear broadcast rights before the microphone can ever go live.</p>
    </div>

    {error?<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>:null}

    {readiness?<div className={`rounded-xl border p-4 ${readiness.d1&&readiness.realtimeKitConfigured?'border-emerald-500/30 bg-emerald-500/10':'border-amber-500/30 bg-amber-500/10'}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className={`text-sm font-black ${readiness.d1&&readiness.realtimeKitConfigured?'text-emerald-200':'text-amber-200'}`}>
            {readiness.d1&&readiness.realtimeKitConfigured?'BROADCAST ENGINE READY':'BROADCAST ENGINE NEEDS CONFIGURATION'}
          </div>
          <div className="mt-1 text-xs text-slate-300">D1: {readiness.d1?'ready':'missing'} • RealtimeKit: {readiness.realtimeKitConfigured?'configured':'missing credentials'}</div>
        </div>
        <div className="text-[11px] text-slate-400">Publisher: {readiness.publisherPreset} • Listener: {readiness.listenerPreset}</div>
      </div>
    </div>:null}

    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
      <h2 className="font-black text-white">Create Broadcast</h2>
      <div className="mt-4 flex flex-col md:flex-row gap-3">
        <select value={gameId} onChange={(e)=>setGameId(e.target.value)} className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-3 text-sm text-white">
          {availableGames.length?availableGames.map((game)=><option key={game.id} value={game.id}>{game.gameDate} {game.gameTime||''} | {game.label} {game.sport?`| ${game.sport}`:''}</option>):<option value="">No upcoming games without a broadcast</option>}
        </select>
        <button onClick={createBroadcast} disabled={!gameId||working} className="rounded-lg bg-red-600 px-5 py-3 font-black text-white disabled:opacity-40">CREATE BROADCAST</button>
      </div>
    </section>

    <section className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-black text-white">Upcoming Broadcasts</h2><span className="text-xs text-slate-500">{broadcasts.length} total</span></div>
      {!broadcasts.length?<div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">No broadcasts created yet.</div>:broadcasts.map((broadcast)=><BroadcastCard key={broadcast.id} broadcast={broadcast} contributors={contributors} working={working} action={action}/>) }
    </section>
  </div>
}

function BroadcastCard({broadcast,contributors,working,action}:{broadcast:Broadcast;contributors:Contributor[];working:boolean;action:(payload:any)=>Promise<any>}){
  const [subjectId,setSubjectId]=useState(contributors[0]?.subjectId||'')
  const [role,setRole]=useState('broadcaster')
  const [rightsStatus,setRightsStatus]=useState(broadcast.rightsStatus||'pending')
  const [rightsHolder,setRightsHolder]=useState(broadcast.rightsHolder||'')
  const [approvedBy,setApprovedBy]=useState(broadcast.rightsApprovedBy||'')
  const [notes,setNotes]=useState(broadcast.rightsNotes||'')
  const [documentUrl,setDocumentUrl]=useState(broadcast.rightsDocumentUrl||'')
  const cleared=['approved','not_required'].includes(broadcast.rightsStatus)

  useEffect(()=>{if(!subjectId&&contributors[0])setSubjectId(contributors[0].subjectId)},[contributors,subjectId])

  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase text-slate-300">{broadcast.status}</span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${cleared?'bg-emerald-500/15 text-emerald-300':'bg-amber-500/15 text-amber-200'}`}>Rights: {broadcast.rightsStatus.replace('_',' ')}</span>
        </div>
        <div className="text-lg font-black text-white">{broadcast.title}</div>
        <div className="text-xs text-slate-500 mt-1">{broadcast.sport||'Sport'} {broadcast.scheduledAt?`• ${broadcast.scheduledAt.replace('T',' ')}`:''}</div>
        {broadcast.assignments?<div className="text-sm text-slate-300 mt-3">Assigned: {broadcast.assignments}</div>:<div className="text-sm text-amber-200 mt-3">No broadcaster assigned yet.</div>}
      </div>
      <a href={`/live/${broadcast.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5">PUBLIC PLAYER</a>
    </div>

    <div className="mt-5 grid md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="text-sm font-black text-white">Assign Contributor</div>
        <div className="mt-3 space-y-2">
          <select value={subjectId} onChange={(e)=>setSubjectId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white">
            {contributors.length?contributors.map((c)=><option key={c.subjectId} value={c.subjectId}>{c.name}{c.email?` (${c.email})`:''}</option>):<option value="">No approved contributors</option>}
          </select>
          <select value={role} onChange={(e)=>setRole(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white">
            <option value="broadcaster">Play-by-Play Broadcaster</option><option value="producer">Producer</option><option value="color">Color Commentary</option><option value="sideline">Sideline</option><option value="scorekeeper">Scorekeeper</option>
          </select>
          <button disabled={!subjectId||working} onClick={()=>action({action:'assign',broadcastId:broadcast.id,subjectId,role})} className="w-full rounded-lg bg-white px-3 py-2.5 text-sm font-black text-black disabled:opacity-40">ASSIGN</button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="text-sm font-black text-white">Broadcast Rights</div>
        <div className="mt-3 space-y-2">
          <select value={rightsStatus} onChange={(e)=>setRightsStatus(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white">
            <option value="pending">Pending</option><option value="approved">Approved</option><option value="not_required">Not Required</option><option value="denied">Denied</option><option value="expired">Expired</option>
          </select>
          <input value={rightsHolder} onChange={(e)=>setRightsHolder(e.target.value)} placeholder="Rights holder, school or Section X" className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white"/>
          <input value={approvedBy} onChange={(e)=>setApprovedBy(e.target.value)} placeholder="Approved by" className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white"/>
          <input value={documentUrl} onChange={(e)=>setDocumentUrl(e.target.value)} placeholder="Approval document/link (optional)" className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white"/>
          <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Rights notes" rows={2} className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white"/>
          <button disabled={working} onClick={()=>action({action:'rights',broadcastId:broadcast.id,rightsStatus,rightsHolder,approvedBy,documentUrl,notes})} className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-black text-white disabled:opacity-40">SAVE RIGHTS</button>
        </div>
      </div>
    </div>

    {broadcast.status!=='canceled'&&broadcast.status!=='ended'?<div className="mt-4 flex justify-end"><button disabled={working} onClick={()=>{if(confirm('Cancel this broadcast?'))action({action:'cancel',broadcastId:broadcast.id})}} className="text-xs font-bold text-red-300 hover:text-red-200">Cancel broadcast</button></div>:null}
  </div>
}
