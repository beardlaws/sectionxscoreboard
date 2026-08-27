'use client'

import { useEffect,useState } from 'react'
import Link from 'next/link'
import { AlertTriangle,CheckCircle2,RefreshCw } from 'lucide-react'

export default function DailyResults(){
  const [date,setDate]=useState(()=>new Date().toISOString().slice(0,10)),[data,setData]=useState<any>(null),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null)
  async function load(){setLoading(true);setError(null);try{const r=await fetch(`/api/admin/score-intelligence/day?date=${date}`,{cache:'no-store'}),j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Results check failed');setData(j)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setLoading(false)}}
  useEffect(()=>{void load()},[date])
  return <div className="p-4 max-w-6xl space-y-5">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-white" style={{fontFamily:'var(--font-display)'}}>Today’s Results</h1><p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>One game-night view of what is final, what has a reported score, and what is still missing.</p></div><div className="flex gap-2"><Link href="/admin/score-intelligence" className="admin-action-btn justify-center">Score Intelligence</Link><Link href="/admin/fall-operations" className="admin-action-btn justify-center">Fall Operations</Link></div></div>
    <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-end"><label className="text-sm"><span style={{color:'var(--text-muted)'}}>Game date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="block mt-1 rounded border border-white/10 bg-black/30 px-3 py-2 text-white"/></label><button onClick={load} disabled={loading} className="admin-action-btn justify-center"><RefreshCw size={18} className={loading?'animate-spin':''}/>{loading?'Checking…':'Refresh'}</button></div>
    {error&&<div className="rounded-lg p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm"><AlertTriangle size={16} className="inline mr-2"/>{error}</div>}
    {data&&<><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['Games',data.summary.games],['Final',data.summary.final],['Score reported',data.summary.reported],['Missing result',data.summary.missing]].map(([l,v]:any)=><div key={l} className="card p-4"><div className="text-xl font-bold text-white">{v}</div><div className="text-xs" style={{color:'var(--text-muted)'}}>{l}</div></div>)}</div>
      <div className="card p-4"><div className="space-y-2">{data.rows.length===0?<div className="text-sm" style={{color:'var(--text-muted)'}}>No games scheduled for this date.</div>:data.rows.map((g:any)=><div key={g.id} className="rounded border border-white/10 bg-black/20 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><b className="text-white">{g.away} {g.awayScore??'—'} at {g.home} {g.homeScore??'—'}</b><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{g.sport}{g.gender?` · ${g.gender}`:''} · {g.time||'TBA'} · {g.source||'unknown source'}</div></div><div className={`text-xs font-semibold ${g.resultState==='final'?'text-emerald-300':g.resultState==='score-reported'?'text-sky-300':'text-amber-300'}`}>{g.resultState==='final'?<><CheckCircle2 size={14} className="inline mr-1"/>Final</>:g.resultState==='score-reported'?'Score Reported':'Missing Result'}</div></div>)}</div></div>
    </>}
  </div>
}
