'use client'
import { useMemo,useState } from 'react'

type Team={id:string;sport_id:string;name:string;school:string;className:string;division:string}
type Sport={id:string;slug:string;sport_name:string;gender:string}

export default function FanZoneClient({sports,teams,schools}:{sports:Sport[];teams:Team[];schools:{id:string;school_name:string}[]}){
  const [tab,setTab]=useState<'plays'|'rankings'>('plays')
  const [play,setPlay]=useState<any>({athleteName:'',schoolId:'',sportId:'',gameDate:'',opponent:'',description:'',whyTopFive:'',submitterName:'',submitterEmail:''})
  const [playMsg,setPlayMsg]=useState('');const [playBusy,setPlayBusy]=useState(false)
  const [sportId,setSportId]=useState(sports.find(s=>s.slug==='girls-soccer')?.id||sports[0]?.id||'')
  const groups=useMemo(()=>{const rows=teams.filter(t=>t.sport_id===sportId);const cls=[...new Set(rows.map(t=>t.className).filter(Boolean))].sort();return cls.length?cls.map(v=>({type:'class',value:v,label:'Class '+v})):[{type:'all',value:'All',label:'All Teams'}]},[sportId,teams])
  const [group,setGroup]=useState(groups[0]?.value||'All')
  const currentGroup=groups.find(g=>g.value===group)||groups[0]
  const eligible=useMemo(()=>teams.filter(t=>t.sport_id===sportId&&(!currentGroup||currentGroup.type==='all'||t.className===currentGroup.value)),[teams,sportId,currentGroup])
  const [ranked,setRanked]=useState<Team[]>([])
  const [rankMsg,setRankMsg]=useState('');const [rankBusy,setRankBusy]=useState(false)

  function chooseSport(id:string){setSportId(id);setRanked([]);setRankMsg('');const rows=teams.filter(t=>t.sport_id===id);const cls=[...new Set(rows.map(t=>t.className).filter(Boolean))].sort();setGroup(cls[0]||'All')}
  function addTeam(t:Team){if(ranked.some(x=>x.id===t.id)||ranked.length>=5)return;setRanked([...ranked,t])}
  function move(i:number,d:number){const j=i+d;if(j<0||j>=ranked.length)return;const n=[...ranked];[n[i],n[j]]=[n[j],n[i]];setRanked(n)}
  function remove(i:number){setRanked(ranked.filter((_,x)=>x!==i))}
  async function submitPlay(e:any){e.preventDefault();setPlayBusy(true);setPlayMsg('');try{const r=await fetch('/api/fan-zone/top-plays',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(play)});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Could not submit play.');setPlayMsg('Play nominated! It is now in the Section X Top 5 review queue.');setPlay({...play,athleteName:'',opponent:'',description:'',whyTopFive:''})}catch(err:any){setPlayMsg(err.message)}finally{setPlayBusy(false)}}
  async function submitRank(){if(ranked.length!==5){setRankMsg('Pick exactly five teams first.');return}setRankBusy(true);setRankMsg('');try{const r=await fetch('/api/fan-zone/power-rankings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sportId,groupType:currentGroup?.type||'all',groupValue:currentGroup?.value||'All',rankings:ranked.map(t=>t.id)})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Could not submit ranking.');setRankMsg('Ballot counted! '+d.ballotCount+' fan ballot'+(d.ballotCount===1?'':'s')+' this week.') }catch(err:any){setRankMsg(err.message)}finally{setRankBusy(false)}}

  return <div>
    <div className="flex gap-2 mb-6">
      <button onClick={()=>setTab('plays')} className={`rounded-xl px-4 py-2 text-xs font-black ${tab==='plays'?'bg-blue-600 text-white':'bg-white/5 text-white/45'}`}>TOP 5 PLAYS</button>
      <button onClick={()=>setTab('rankings')} className={`rounded-xl px-4 py-2 text-xs font-black ${tab==='rankings'?'bg-yellow-300 text-black':'bg-white/5 text-white/45'}`}>FAN POWER RANKINGS</button>
    </div>

    {tab==='plays'?<form onSubmit={submitPlay} className="rounded-3xl p-5 sm:p-7 space-y-4" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.07)'}}>
      <div><div className="text-[10px] uppercase tracking-[.2em] text-blue-300/70 font-black">Nominate a moment</div><h2 className="text-2xl font-black text-white mt-1">Submit a Top 5 Play</h2><p className="text-sm text-white/40 mt-2">Saw something ridiculous? Tell us who did what and when. We review every nomination for the weekly Top 5.</p></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-white/45">Athlete<input required value={play.athleteName} onChange={e=>setPlay({...play,athleteName:e.target.value})} className="input w-full mt-1" placeholder="Athlete name"/></label>
        <label className="text-xs text-white/45">School<select required value={play.schoolId} onChange={e=>setPlay({...play,schoolId:e.target.value})} className="input w-full mt-1"><option value="">Choose school</option>{schools.map(s=><option key={s.id} value={s.id}>{s.school_name}</option>)}</select></label>
        <label className="text-xs text-white/45">Sport<select required value={play.sportId} onChange={e=>setPlay({...play,sportId:e.target.value})} className="input w-full mt-1"><option value="">Choose sport</option>{sports.map(s=><option key={s.id} value={s.id}>{s.gender} {s.sport_name}</option>)}</select></label>
        <label className="text-xs text-white/45">When<input type="date" value={play.gameDate} onChange={e=>setPlay({...play,gameDate:e.target.value})} className="input w-full mt-1"/></label>
        <label className="text-xs text-white/45 sm:col-span-2">Opponent<input value={play.opponent} onChange={e=>setPlay({...play,opponent:e.target.value})} className="input w-full mt-1" placeholder="Who were they playing?"/></label>
      </div>
      <label className="text-xs text-white/45 block">What happened?<textarea required value={play.description} onChange={e=>setPlay({...play,description:e.target.value})} className="input w-full mt-1 min-h-[110px]" placeholder="Example: Scored the game-winner from 25 yards with 12 seconds left."/></label>
      <label className="text-xs text-white/45 block">Why should it make the Top 5?<textarea value={play.whyTopFive} onChange={e=>setPlay({...play,whyTopFive:e.target.value})} className="input w-full mt-1 min-h-[80px]" placeholder="Optional, but sell us on it."/></label>
      <div className="grid sm:grid-cols-2 gap-3"><label className="text-xs text-white/45">Your name<input value={play.submitterName} onChange={e=>setPlay({...play,submitterName:e.target.value})} className="input w-full mt-1" placeholder="Optional"/></label><label className="text-xs text-white/45">Email<input type="email" value={play.submitterEmail} onChange={e=>setPlay({...play,submitterEmail:e.target.value})} className="input w-full mt-1" placeholder="Optional"/></label></div>
      <button disabled={playBusy} className="btn-primary w-full py-3">{playBusy?'Submitting...':'NOMINATE THIS PLAY'}</button>
      {playMsg&&<div className="text-sm text-blue-200">{playMsg}</div>}
    </form>:<div className="rounded-3xl p-5 sm:p-7" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.07)'}}>
      <div className="text-[10px] uppercase tracking-[.2em] text-yellow-300/70 font-black">The fans have spoken</div><h2 className="text-2xl font-black text-white mt-1">Build Your Top 5</h2><p className="text-sm text-white/40 mt-2">Pick five teams. #1 gets five points, #5 gets one. Your ballot can be updated anytime this week.</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-5"><label className="text-xs text-white/45">Sport<select value={sportId} onChange={e=>chooseSport(e.target.value)} className="input w-full mt-1">{sports.map(s=><option key={s.id} value={s.id}>{s.gender} {s.sport_name}</option>)}</select></label><label className="text-xs text-white/45">Group<select value={currentGroup?.value||'All'} onChange={e=>{setGroup(e.target.value);setRanked([])}} className="input w-full mt-1">{groups.map(g=><option key={g.value} value={g.value}>{g.label}</option>)}</select></label></div>
      <div className="mt-6 grid lg:grid-cols-2 gap-5">
        <div><div className="text-xs font-black text-white/50 uppercase mb-2">Available teams</div><div className="space-y-2">{eligible.filter(t=>!ranked.some(r=>r.id===t.id)).map(t=><button key={t.id} onClick={()=>addTeam(t)} disabled={ranked.length>=5} className="w-full text-left rounded-xl border border-white/7 bg-white/[.025] px-4 py-3 hover:bg-white/5 disabled:opacity-30"><div className="font-bold text-white">{t.school}</div><div className="text-xs text-white/30">{t.className?'Class '+t.className:''}</div></button>)}</div></div>
        <div><div className="text-xs font-black text-yellow-300/70 uppercase mb-2">Your Top 5</div><div className="space-y-2">{[0,1,2,3,4].map(i=>{const t=ranked[i];return <div key={i} className="rounded-xl border border-yellow-300/10 bg-yellow-300/[.025] px-3 py-3 flex items-center gap-3"><div className="w-7 h-7 rounded-lg bg-yellow-300 text-black font-black flex items-center justify-center">{i+1}</div>{t?<><div className="flex-1 font-bold text-white">{t.school}</div><button onClick={()=>move(i,-1)} disabled={i===0} className="text-white/40 px-1">↑</button><button onClick={()=>move(i,1)} disabled={i===ranked.length-1} className="text-white/40 px-1">↓</button><button onClick={()=>remove(i)} className="text-red-300/70 px-1">×</button></>:<div className="text-sm text-white/20">Pick a team</div>}</div>})}</div><button onClick={submitRank} disabled={rankBusy||ranked.length!==5} className="mt-4 w-full rounded-xl bg-yellow-300 px-4 py-3 text-xs font-black text-black disabled:opacity-30">{rankBusy?'COUNTING BALLOT...':'SUBMIT MY RANKING'}</button>{rankMsg&&<div className="mt-3 text-sm text-yellow-100/80">{rankMsg}</div>}</div>
      </div>
    </div>}
  </div>
}
