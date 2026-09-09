'use client'
import { useMemo, useState } from 'react'

function sportLabel(s:any){
 const gender=String(s?.gender||'').trim()
 const name=String(s?.sport_name||'').trim()
 if(gender && name.toLowerCase().startsWith(gender.toLowerCase()+' ')) return name
 return [gender,name].filter(Boolean).join(' ')
}
function pollLabel(s:any){
 const group=String(s.group_value||'').trim()
 const all=s.group_type==='all'||group.toLowerCase()==='all'
 return sportLabel(s.sport)+(all?' · Overall':' · '+group)
}
function pollKey(s:any){return [s.sport_id,s.group_type,s.group_value].join('|')}
function plural(n:number,one:string,many=one+'s'){return n+' '+(n===1?one:many)}
function weekName(value:string){
 if(!value)return 'Unknown week'
 const d=new Date(value+'T12:00:00')
 return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})
}
function movementLabel(now:number,prev:number|null){
 if(prev==null)return {text:'NEW',cls:'text-blue-300'}
 const delta=prev-now
 if(delta>0)return {text:'↑'+delta,cls:'text-emerald-300'}
 if(delta<0)return {text:'↓'+Math.abs(delta),cls:'text-red-300'}
 return {text:'—',cls:'text-slate-600'}
}

function StaffRankingEditor({snapshot,teamOptions,initial,onSaved}:{snapshot:any;teamOptions:any[];initial:any;onSaved:(x:any)=>void}){
 const [draft,setDraft]=useState<string[]>(Array.isArray(initial?.rankings)?initial.rankings:[])
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState('')
 const eligible=teamOptions.filter(t=>t.sport_id===snapshot.sport_id&&(snapshot.group_type!=='class'||!snapshot.group_value||snapshot.group_value==='All'||t.className===snapshot.group_value))
 function setAt(i:number,id:string){const n=[...draft];n[i]=id;n.splice(i+1);setDraft(n.filter(Boolean))}
 async function save(){setBusy(true);setMsg('');try{const r=await fetch('/api/admin/fan-zone/staff-rankings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({weekStart:snapshot.week_start,sportId:snapshot.sport_id,groupType:snapshot.group_type,groupValue:snapshot.group_value,rankings:draft})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Could not save ranking.');onSaved(d.item);setMsg('Section X ranking saved.')}catch(e:any){setMsg(e.message)}finally{setBusy(false)}}
 return <div className="mt-4 rounded-xl border border-blue-400/15 bg-blue-500/[.035] p-3">
  <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-blue-300">Section X Scoreboard ranking</div><div className="text-xs text-slate-500 mt-0.5">Set your editorial Top 5 for fan-vs-staff comparisons.</div></div><button onClick={save} disabled={busy} className="rounded-lg bg-blue-500/15 px-3 py-2 text-[10px] font-black uppercase text-blue-200 disabled:opacity-40">{busy?'Saving...':'Save'}</button></div>
  <div className="grid sm:grid-cols-5 gap-2 mt-3">{[0,1,2,3,4].map(i=><label key={i} className="text-[10px] text-slate-500"><span className="font-black text-white/50">#{i+1}</span><select value={draft[i]||''} onChange={e=>setAt(i,e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs text-white"><option value="">—</option>{eligible.filter(t=>!draft.includes(t.id)||draft[i]===t.id).map(t=><option key={t.id} value={t.id}>{t.school}</option>)}</select></label>)}</div>
  {msg&&<div className="mt-2 text-[11px] text-blue-200">{msg}</div>}
 </div>
}

export default function FanZoneAdminClient({plays,snapshots,ballots,staff,teamSeasons}:{plays:any[];snapshots:any[];ballots:any[];staff:any[];teamSeasons:any[]}){
 const weeks=useMemo(()=>Array.from(new Set([...snapshots.map(s=>s.week_start),...ballots.map(b=>b.week_start),...staff.map(s=>s.week_start)].filter(Boolean))).sort().reverse(),[snapshots,ballots,staff])
 const [selectedWeek,setSelectedWeek]=useState(weeks[0]||'')
 const [items,setItems]=useState(plays)
 const [staffRows,setStaffRows]=useState(staff)
 const [copied,setCopied]=useState('')
 const weekBallots=ballots.filter(b=>!selectedWeek||b.week_start===selectedWeek)
 const weekSnapshots=snapshots.filter(s=>!selectedWeek||s.week_start===selectedWeek)
 const uniquePolls=new Set(weekBallots.map(b=>[b.sport_id,b.group_type,b.group_value].join('|'))).size
 const counts=weekBallots.reduce((a:any,b:any)=>{const label=sportLabel(b.sport);a[label]=(a[label]||0)+1;return a},{})
 const topSport=Object.entries(counts).sort((a:any,b:any)=>Number(b[1])-Number(a[1]))[0]
 const pending=items.filter(x=>x.status==='pending').length
 const teamOptions=useMemo(()=>teamSeasons.map((x:any)=>{const t=Array.isArray(x.team)?x.team[0]:x.team;const sc=Array.isArray(t?.school)?t.school[0]:t?.school;return{id:t?.id,sport_id:t?.sport_id,school:sc?.school_name||t?.team_name||'Team',className:x.class||'',division:x.division||''}}).filter((x:any)=>x.id),[teamSeasons])
 function previousFor(s:any){return snapshots.filter(x=>x.week_start<s.week_start&&pollKey(x)===pollKey(s)).sort((a,b)=>String(b.week_start).localeCompare(String(a.week_start)))[0]||null}
 function staffFor(s:any){return staffRows.find(x=>x.week_start===s.week_start&&pollKey(x)===pollKey(s))||null}
 function rankMap(results:any[]){return new Map((Array.isArray(results)?results:[]).map((r:any,i:number)=>[r.teamId,i+1]))}
 const insights=useMemo(()=>{
  let biggestMover:any=null,biggestDisagreement:any=null,fastestGrowth:any=null
  for(const s of weekSnapshots){
   const prev=previousFor(s),prevMap=rankMap(prev?.results||[])
   const rows=Array.isArray(s.results)?s.results:[]
   rows.slice(0,5).forEach((r:any,i:number)=>{const old=prevMap.get(r.teamId) as number|undefined;if(old){const delta=old-(i+1);if(!biggestMover||Math.abs(delta)>Math.abs(biggestMover.delta))biggestMover={poll:s,team:r.teamName,delta,now:i+1,old}}})
   if(prev){const growth=Number(s.ballot_count||0)-Number(prev.ballot_count||0);const pct=Number(prev.ballot_count||0)>0?Math.round(growth/Number(prev.ballot_count)*100):null;if(!fastestGrowth||growth>fastestGrowth.growth)fastestGrowth={poll:s,growth,pct,current:s.ballot_count||0,previous:prev.ballot_count||0}}
   const st=staffRows.find(x=>x.week_start===s.week_start&&pollKey(x)===pollKey(s))
   if(st&&Array.isArray(st.rankings)){const fan=rankMap(rows),staffMap=new Map(st.rankings.map((id:string,i:number)=>[id,i+1]));for(const [id,sr] of staffMap){const fr=fan.get(id) as number|undefined;if(fr){const delta=Number(sr)-fr;const team=rows.find((r:any)=>r.teamId===id)?.teamName||teamOptions.find(t=>t.id===id)?.school||'Team';if(!biggestDisagreement||Math.abs(delta)>Math.abs(biggestDisagreement.delta))biggestDisagreement={poll:s,team,delta,fan:fr,staff:sr}}}}
  }
  return {biggestMover,biggestDisagreement,fastestGrowth}
 },[weekSnapshots,staffRows,selectedWeek,teamOptions,snapshots])
 const talkingPoints=useMemo(()=>{
  const out:string[]=[]
  if(insights.biggestMover){const x=insights.biggestMover;out.push(`${x.team} is the biggest mover in the Section X fan poll this week, moving ${x.delta>0?'up':'down'} ${Math.abs(x.delta)} spot${Math.abs(x.delta)===1?'':'s'} to #${x.now} in ${pollLabel(x.poll)}.`)}
  if(insights.biggestDisagreement){const x=insights.biggestDisagreement;out.push(`The fans and Section X Scoreboard disagree on ${x.team}: fans have them #${x.fan}, while our ranking has them #${x.staff} in ${pollLabel(x.poll)}.`)}
  if(insights.fastestGrowth&&insights.fastestGrowth.growth>0){const x=insights.fastestGrowth;out.push(`${pollLabel(x.poll)} added ${x.growth} new ballot${x.growth===1?'':'s'} versus last week${x.pct!=null?' ('+x.pct+'% growth)':''}.`)}
  return out
 },[insights])
 async function copyText(text:string,i:string){try{await navigator.clipboard.writeText(text);setCopied(i);setTimeout(()=>setCopied(''),1500)}catch{}}
 async function setStatus(id:string,status:string){const r=await fetch('/api/admin/fan-zone/top-plays',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,status})});const d=await r.json();if(d.ok)setItems(p=>p.map(x=>x.id===id?{...x,status}:x))}
 function updateStaff(item:any){setStaffRows(rows=>[...rows.filter(x=>!(x.week_start===item.week_start&&pollKey(x)===pollKey(item))),item])}

 return <div className="space-y-8">
  <section className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
   <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
    <div><div className="text-[10px] uppercase tracking-[.2em] font-black text-yellow-300">Weekly command center</div><div className="text-xl font-black text-white mt-1">Fan Zone {selectedWeek?'· Week of '+weekName(selectedWeek):''}</div><div className="text-xs text-slate-500 mt-1">Fan movement, editorial comparisons and content-ready talking points in one place.</div></div>
    <select value={selectedWeek} onChange={e=>setSelectedWeek(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">{weeks.map((w,i)=><option key={w} value={w}>{i===0?'Current week · ':''}{weekName(w)}</option>)}</select>
   </div>
  </section>

  <section><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
   <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-2xl font-black text-white">{weekBallots.length}</div><div className="text-xs text-slate-500">{weekBallots.length===1?'Ballot captured':'Ballots captured'}</div></div>
   <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-2xl font-black text-white">{uniquePolls}</div><div className="text-xs text-slate-500">{uniquePolls===1?'Active poll':'Active polls'}</div></div>
   <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-lg font-black text-white truncate">{topSport?.[0]||'—'}</div><div className="text-xs text-slate-500">Most active sport</div></div>
   <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-2xl font-black text-white">{pending}</div><div className="text-xs text-slate-500">{pending===1?'Play nomination waiting':'Play nominations waiting'}</div></div>
  </div></section>

  <section className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[.025] p-4">
   <div className="flex items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Fan Zone intelligence</div><h2 className="text-lg font-black text-white mt-1">What should we be talking about?</h2></div><div className="text-[10px] uppercase tracking-widest text-slate-600">Auto-generated from voting</div></div>
   <div className="grid md:grid-cols-3 gap-3 mt-4">
    <div className="rounded-xl border border-white/8 bg-black/20 p-4"><div className="text-[10px] uppercase tracking-widest text-slate-500">Biggest mover</div>{insights.biggestMover?<><div className="font-black text-white mt-2">{insights.biggestMover.team}</div><div className={`text-sm font-black mt-1 ${insights.biggestMover.delta>0?'text-emerald-300':'text-red-300'}`}>{insights.biggestMover.delta>0?'↑':'↓'}{Math.abs(insights.biggestMover.delta)} to #{insights.biggestMover.now}</div></>:<div className="text-sm text-slate-600 mt-2">Needs a prior week of voting.</div>}</div>
    <div className="rounded-xl border border-white/8 bg-black/20 p-4"><div className="text-[10px] uppercase tracking-widest text-slate-500">Fans vs Section X</div>{insights.biggestDisagreement?<><div className="font-black text-white mt-2">{insights.biggestDisagreement.team}</div><div className="text-xs text-yellow-200 mt-1">Fans #{insights.biggestDisagreement.fan} · Staff #{insights.biggestDisagreement.staff}</div></>:<div className="text-sm text-slate-600 mt-2">Set your editorial rankings below.</div>}</div>
    <div className="rounded-xl border border-white/8 bg-black/20 p-4"><div className="text-[10px] uppercase tracking-widest text-slate-500">Fastest-growing poll</div>{insights.fastestGrowth&&insights.fastestGrowth.growth>0?<><div className="font-black text-white mt-2">{pollLabel(insights.fastestGrowth.poll)}</div><div className="text-xs text-blue-200 mt-1">+{insights.fastestGrowth.growth} ballots{insights.fastestGrowth.pct!=null?' · '+insights.fastestGrowth.pct+'%':''}</div></>:<div className="text-sm text-slate-600 mt-2">Growth appears after another week.</div>}</div>
   </div>
   {talkingPoints.length>0&&<div className="mt-4 space-y-2">{talkingPoints.map((t,i)=><div key={i} className="flex items-start gap-3 rounded-xl border border-white/8 bg-black/20 p-3"><div className="flex-1 text-sm text-slate-300">{t}</div><button onClick={()=>copyText(t,String(i))} className="shrink-0 rounded-lg bg-white/5 px-3 py-2 text-[10px] font-black uppercase text-white/60">{copied===String(i)?'Copied':'Copy'}</button></div>)}</div>}
  </section>

  <section><div className="flex items-center justify-between mb-3"><h2 className="font-black text-white">Top 5 Play Inbox</h2><span className="text-xs text-slate-500">{plural(pending,'pending nomination','pending nominations')}</span></div><div className="space-y-3">{items.length?items.map(p=><div key={p.id} className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="flex flex-col md:flex-row gap-4 md:items-start md:justify-between"><div><div className="text-xs text-blue-300">{sportLabel(p.sport)} · {p.school?.school_name||'School not selected'} · {p.game_date||'Date not supplied'}</div><div className="text-lg font-black text-white mt-1">{p.athlete_name}</div><div className="text-sm text-slate-300 mt-2">{p.play_description}</div>{p.why_top_five&&<div className="text-xs text-slate-500 mt-2">Why Top 5: {p.why_top_five}</div>}<div className="text-[11px] text-slate-600 mt-2">{p.opponent?'vs '+p.opponent+' · ':''}submitted {new Date(p.created_at).toLocaleString()}</div></div><div className="flex gap-2 flex-wrap"><button onClick={()=>setStatus(p.id,'featured')} className="px-3 py-2 rounded-lg text-xs font-black bg-yellow-300 text-black">Top 5</button><button onClick={()=>setStatus(p.id,'approved')} className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300">Approve</button><button onClick={()=>setStatus(p.id,'rejected')} className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-300">Reject</button></div></div><div className="mt-2 text-[10px] uppercase tracking-widest text-slate-500">Status: {p.status}</div></div>):<div className="text-sm text-slate-500">No play nominations yet.</div>}</div></section>

  <section><div className="flex items-end justify-between gap-3 mb-3"><div><h2 className="font-black text-white">Fan Power Rankings</h2><p className="text-xs text-slate-500 mt-1">Movement compares with the most recent prior week. Add your Section X ranking to unlock fan-vs-staff analysis.</p></div><div className="text-xs text-slate-500">{plural(weekSnapshots.length,'poll')}</div></div>
   <div className="grid xl:grid-cols-2 gap-3">{weekSnapshots.length?weekSnapshots.map(s=>{const prev=previousFor(s),prevMap=rankMap(prev?.results||[]),staffRank=staffFor(s);const growth=prev?Number(s.ballot_count||0)-Number(prev.ballot_count||0):null;return <div key={s.id} className="rounded-xl border border-white/10 bg-white/[.025] p-4">
    <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black text-yellow-300">{pollLabel(s)}</div><div className="text-2xl font-black text-white mt-1">{plural(s.ballot_count||0,'ballot')}</div></div>{growth!=null&&<div className={`rounded-lg px-2 py-1 text-[10px] font-black ${growth>0?'bg-emerald-500/10 text-emerald-300':growth<0?'bg-red-500/10 text-red-300':'bg-white/5 text-slate-500'}`}>{growth>0?'+':''}{growth} vs last week</div>}</div>
    <div className="text-[10px] uppercase tracking-widest text-slate-600 mt-1">Live fan consensus</div>
    <div className="mt-3 space-y-1">{(Array.isArray(s.results)?s.results:[]).slice(0,5).map((r:any,i:number)=>{const mv=movementLabel(i+1,prevMap.get(r.teamId) as number||null);const staffPos=Array.isArray(staffRank?.rankings)?staffRank.rankings.indexOf(r.teamId)+1:0;return <div key={r.teamId||i} className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-2 rounded-lg bg-black/15 px-2 py-2 text-sm"><span className="font-black text-white/50">#{i+1}</span><span className="text-slate-300 truncate">{r.teamName}</span><span className={`text-[10px] font-black ${mv.cls}`}>{mv.text}</span><span className="min-w-[54px] text-right text-[10px] text-blue-300/70">{staffPos?'SX #'+staffPos:''}</span></div>})}</div>
    <StaffRankingEditor key={s.id+'-'+selectedWeek} snapshot={s} teamOptions={teamOptions} initial={staffRank} onSaved={updateStaff}/>
   </div>}):<div className="rounded-xl border border-white/10 bg-white/[.025] p-5 text-sm text-slate-500">No fan ballots for this week yet.</div>}</div>
  </section>
  {weeks.length>1&&<section className="rounded-xl border border-white/10 bg-white/[.02] p-4"><div className="text-sm font-black text-white">History is preserved</div><div className="text-xs text-slate-500 mt-1">Use the week selector above to revisit prior fan rankings and see how the conversation moved.</div></section>}
 </div>
}
