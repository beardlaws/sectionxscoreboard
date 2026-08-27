'use client'

import { useMemo,useState } from 'react'
import Link from 'next/link'
import { AlertTriangle,CheckCircle2,ClipboardPaste,RefreshCw,ShieldCheck,Upload } from 'lucide-react'

const SOURCES=[
  {id:'manual-batch',label:'Manual / Other'},
  {id:'highschoolsportstats',label:'HighSchoolSportStats'},
  {id:'northcountrysports',label:'North Country Sports'},
  {id:'other',label:'Other Trusted Source'},
]
const EXAMPLE=`Date,Sport,Away,Away Score,Home,Home Score\n2026-09-01,Girls Soccer,Potsdam,1,Canton,3\n2026-09-01,Football,Gouverneur,14,Ogdensburg,21`
const readable=(v:string)=>String(v||'').replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase())

export default function ScoreIntelligence(){
  const [source,setSource]=useState('manual-batch'),[text,setText]=useState(''),[preview,setPreview]=useState<any>(null),[loading,setLoading]=useState(false),[applying,setApplying]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null)
  async function runPreview(){setLoading(true);setError(null);setMessage(null);try{const r=await fetch('/api/admin/score-intelligence/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source,text})}),j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Preview failed');setPreview(j)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setLoading(false)}}
  async function applySafe(){const rows=preview?.rows?.filter((r:any)=>r.safeToApply)||[];if(!rows.length)return;if(!confirm(`Apply ${rows.length} safe result${rows.length===1?'':'s'} from ${SOURCES.find(s=>s.id===source)?.label}? Existing protected conflicting scores will not be overwritten.`))return;setApplying(true);setError(null);setMessage(null);try{const r=await fetch('/api/admin/score-intelligence/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:'APPLY_SCORE_INTELLIGENCE_RESULTS',source,rows})}),j=await r.json();if(!r.ok&&r.status!==207)throw new Error(j.error||'Apply failed');setMessage(`Applied ${j.updated} result${j.updated===1?'':'s'}; ${j.skipped} protected/skipped; ${j.failed} failed.`);await runPreview()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setApplying(false)}}
  const rows=preview?.rows||[]
  const grouped=useMemo(()=>({safe:rows.filter((r:any)=>r.safeToApply),verified:rows.filter((r:any)=>r.bucket==='verified'),conflicts:rows.filter((r:any)=>r.bucket==='conflict'),unmatched:rows.filter((r:any)=>['unmatched','ambiguous'].includes(r.bucket))}),[rows])
  return <div className="p-4 max-w-6xl space-y-5">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div className="flex items-center gap-2"><ShieldCheck size={24} style={{color:'var(--accent-bright)'}}/><h1 className="text-2xl font-bold text-white" style={{fontFamily:'var(--font-display)'}}>Score Intelligence</h1></div><p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Backup score intake that only matches existing Section X games and protects trusted manual results.</p></div><Link href="/admin/fall-operations" className="admin-action-btn justify-center">← Fall Operations</Link></div>
    {error&&<div className="rounded-lg p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm"><AlertTriangle size={16} className="inline mr-2"/>{error}</div>}
    {message&&<div className="rounded-lg p-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm"><CheckCircle2 size={16} className="inline mr-2"/>{message}</div>}
    <div className="card p-4 space-y-4">
      <div className="flex flex-col md:flex-row gap-3"><label className="flex-1 text-sm"><span style={{color:'var(--text-muted)'}}>Source</span><select value={source} onChange={e=>{setSource(e.target.value);setPreview(null)}} className="w-full mt-1 rounded border border-white/10 bg-black/30 px-3 py-2 text-white">{SOURCES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><button onClick={()=>setText(EXAMPLE)} className="admin-action-btn justify-center md:self-end"><ClipboardPaste size={18}/>Load Example</button></div>
      <div><div className="text-sm font-semibold text-white mb-1">Paste score rows</div><div className="text-xs mb-2" style={{color:'var(--text-muted)'}}>CSV, tabs, or pipes. Preferred columns: Date, Sport, Away, Away Score, Home, Home Score. Nothing is written during preview.</div><textarea value={text} onChange={e=>setText(e.target.value)} rows={9} className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white font-mono" placeholder={EXAMPLE}/></div>
      <button onClick={runPreview} disabled={loading||!text.trim()} className="admin-action-btn justify-center w-full disabled:opacity-40">{loading?<RefreshCw size={18} className="animate-spin"/>:<ShieldCheck size={18}/>} {loading?'Matching existing games…':'Preview & Match Results'}</button>
    </div>
    {preview&&<>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">{[
        ['Received',preview.summary.received],['Matched',preview.summary.matched],['Safe',preview.summary.safe],['Verified',preview.summary.verified],['Conflicts',preview.summary.conflicts],['Unmatched',preview.summary.unmatched+preview.summary.ambiguous]
      ].map(([label,value]:any)=><div key={label} className="card p-4"><div className="text-xl font-bold text-white">{value}</div><div className="text-xs" style={{color:'var(--text-muted)'}}>{label}</div></div>)}</div>
      {preview.parseErrors?.length>0&&<div className="card p-4"><h2 className="font-semibold text-amber-300 mb-2">Rows that could not be parsed</h2>{preview.parseErrors.map((x:string,i:number)=><div key={i} className="text-xs" style={{color:'var(--text-muted)'}}>{x}</div>)}</div>}
      <div className="card p-4 space-y-3"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Review</h2><p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Safe fills/updates can be applied. Conflicts and ambiguous matches stay untouched.</p></div><button onClick={applySafe} disabled={!grouped.safe.length||applying} className="admin-action-btn justify-center disabled:opacity-40">{applying?<RefreshCw size={18} className="animate-spin"/>:<Upload size={18}/>} {applying?'Applying…':`Apply ${grouped.safe.length} Safe`}</button></div>
        <div className="max-h-[620px] overflow-auto space-y-2">{rows.map((r:any,i:number)=><div key={`${r.gameId||'x'}-${i}`} className="rounded border border-white/10 bg-black/20 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><b className="text-white">{r.away} {r.awayScore} at {r.home} {r.homeScore}</b><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{r.date}{r.sport?` · ${r.sport}`:''}{r.matched?` · matched ${r.matched.away} at ${r.matched.home}`:''}</div></div><span className={`text-xs font-semibold ${r.safeToApply?'text-emerald-300':r.bucket==='verified'?'text-sky-300':r.bucket==='conflict'?'text-red-300':'text-amber-300'}`}>{readable(r.bucket)}</span></div>{r.matched&&<div className="text-xs mt-2" style={{color:'var(--text-muted)'}}>Section X currently: {r.matched.currentAway??'—'}-{r.matched.currentHome??'—'} · source {r.matched.currentSource||'unknown'}</div>}{r.candidateGameIds?.length>0&&<div className="text-xs mt-2 text-amber-300">{r.candidateGameIds.length} possible games matched. Left untouched.</div>}</div>)}</div>
      </div>
    </>}
    <div className="card p-4 text-sm"><h2 className="font-semibold text-white mb-2">Source rules</h2><p style={{color:'var(--text-muted)'}}>This tool never creates a game. It only matches results to games already in Section X. Blank scores are safe fills. Matching results are verified. Conflicting existing scores remain protected unless they were already owned by the same source or Arbiter.</p></div>
  </div>
}
