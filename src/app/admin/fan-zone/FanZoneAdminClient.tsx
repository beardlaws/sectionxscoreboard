'use client'
import { useMemo, useState } from 'react'

function sportLabel(s:any){
 const gender=String(s?.gender||'').trim()
 let name=String(s?.sport_name||'').trim()
 if(gender && name.toLowerCase().startsWith(gender.toLowerCase()+' ')) return name
 return [gender,name].filter(Boolean).join(' ')
}
function pollLabel(s:any){
 const group=String(s.group_value||'').trim()
 const all=s.group_type==='all'||group.toLowerCase()==='all'
 return sportLabel(s.sport)+(all?' · Overall':' · '+group)
}
function plural(n:number,one:string,many=one+'s'){return n+' '+(n===1?one:many)}
function weekName(value:string){
 if(!value)return 'Unknown week'
 const d=new Date(value+'T12:00:00')
 return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})
}

export default function FanZoneAdminClient({plays,snapshots,ballots}:{plays:any[];snapshots:any[];ballots:any[]}){
 const weeks=useMemo(()=>Array.from(new Set([...snapshots.map(s=>s.week_start),...ballots.map(b=>b.week_start)].filter(Boolean))).sort().reverse(),[snapshots,ballots])
 const [selectedWeek,setSelectedWeek]=useState(weeks[0]||'')
 const [items,setItems]=useState(plays)
 const weekBallots=ballots.filter(b=>!selectedWeek||b.week_start===selectedWeek)
 const weekSnapshots=snapshots.filter(s=>!selectedWeek||s.week_start===selectedWeek)
 const uniquePolls=new Set(weekBallots.map(b=>[b.sport_id,b.group_type,b.group_value].join('|'))).size
 const counts=weekBallots.reduce((a:any,b:any)=>{const label=sportLabel(b.sport);a[label]=(a[label]||0)+1;return a},{})
 const topSport=Object.entries(counts).sort((a:any,b:any)=>b[1]-a[1])[0]
 const pending=items.filter(x=>x.status==='pending').length
 async function setStatus(id:string,status:string){const r=await fetch('/api/admin/fan-zone/top-plays',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,status})});const d=await r.json();if(d.ok)setItems(p=>p.map(x=>x.id===id?{...x,status}:x))}
 return <div className="space-y-8">
  <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
   <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
    <div><div className="text-[10px] uppercase tracking-[.2em] font-black text-yellow-300">Weekly command center</div><div className="text-xl font-black text-white mt-1">Fan Zone {selectedWeek?'· Week of '+weekName(selectedWeek):''}</div><div className="text-xs text-slate-500 mt-1">Current voting stays clean. Older ballots remain available for history and week-to-week comparisons.</div></div>
    <select value={selectedWeek} onChange={e=>setSelectedWeek(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">{weeks.map((w,i)=><option key={w} value={w}>{i===0?'Current week · ':''}{weekName(w)}</option>)}</select>
   </div>
  </section>
  <section><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
   <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-2xl font-black text-white">{weekBallots.length}</div><div className="text-xs text-slate-500">{weekBallots.length===1?'Ballot captured':'Ballots captured'}</div></div>
   <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-2xl font-black text-white">{uniquePolls}</div><div className="text-xs text-slate-500">{uniquePolls===1?'Active poll':'Active polls'}</div></div>
   <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-lg font-black text-white truncate">{topSport?.[0]||'—'}</div><div className="text-xs text-slate-500">Most active sport</div></div>
   <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-2xl font-black text-white">{pending}</div><div className="text-xs text-slate-500">{pending===1?'Play nomination waiting':'Play nominations waiting'}</div></div>
  </div><p className="mt-3 text-xs text-slate-600">Ballots stay anonymous. The Control Room shows the fan consensus without identifying individual voters.</p></section>
  <section><div className="flex items-center justify-between mb-3"><h2 className="font-black text-white">Top 5 Play Inbox</h2><span className="text-xs text-slate-500">{plural(pending,'pending nomination','pending nominations')}</span></div><div className="space-y-3">{items.length?items.map(p=><div key={p.id} className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="flex flex-col md:flex-row gap-4 md:items-start md:justify-between"><div><div className="text-xs text-blue-300">{sportLabel(p.sport)} · {p.school?.school_name||'School not selected'} · {p.game_date||'Date not supplied'}</div><div className="text-lg font-black text-white mt-1">{p.athlete_name}</div><div className="text-sm text-slate-300 mt-2">{p.play_description}</div>{p.why_top_five&&<div className="text-xs text-slate-500 mt-2">Why Top 5: {p.why_top_five}</div>}<div className="text-[11px] text-slate-600 mt-2">{p.opponent?'vs '+p.opponent+' · ':''}submitted {new Date(p.created_at).toLocaleString()}</div></div><div className="flex gap-2 flex-wrap"><button onClick={()=>setStatus(p.id,'featured')} className="px-3 py-2 rounded-lg text-xs font-black bg-yellow-300 text-black">Top 5</button><button onClick={()=>setStatus(p.id,'approved')} className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300">Approve</button><button onClick={()=>setStatus(p.id,'rejected')} className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-300">Reject</button></div></div><div className="mt-2 text-[10px] uppercase tracking-widest text-slate-500">Status: {p.status}</div></div>):<div className="text-sm text-slate-500">No play nominations yet.</div>}</div></section>
  <section><div className="flex items-end justify-between gap-3 mb-3"><div><h2 className="font-black text-white">Fan Power Rankings</h2><p className="text-xs text-slate-500 mt-1">Live consensus for the selected week. Overall sports appear once; class-based sports stay separated.</p></div><div className="text-xs text-slate-500">{plural(weekSnapshots.length,'poll')}</div></div>
   <div className="grid md:grid-cols-2 gap-3">{weekSnapshots.length?weekSnapshots.map(s=><div key={s.id} className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-xs font-black text-yellow-300">{pollLabel(s)}</div><div className="text-2xl font-black text-white mt-1">{plural(s.ballot_count||0,'ballot')}</div><div className="text-[10px] uppercase tracking-widest text-slate-600 mt-1">Live consensus</div><div className="mt-3 space-y-1">{(Array.isArray(s.results)?s.results:[]).slice(0,5).map((r:any,i:number)=><div key={r.teamId||i} className="flex justify-between text-sm"><span className="text-slate-300">{i+1}. {r.teamName}</span><b className="text-white">{r.points}</b></div>)}</div></div>):<div className="rounded-xl border border-white/10 bg-white/[.025] p-5 text-sm text-slate-500">No fan ballots for this week yet.</div>}</div>
  </section>
  {weeks.length>1&&<section className="rounded-xl border border-white/10 bg-white/[.02] p-4"><div className="text-sm font-black text-white">History is preserved</div><div className="text-xs text-slate-500 mt-1">Use the week selector above to revisit prior fan rankings. This keeps retired class polls out of the current-week view without deleting their ballots.</div></section>}
 </div>
}
