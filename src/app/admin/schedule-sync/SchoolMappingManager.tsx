'use client'

import { useMemo, useState } from 'react'
import { adminDb } from '@/lib/adminDb'

const TEAM_URLS_KEY='sectionx.schedule-sync.team-urls.v2'
const SCHOOL_URLS_KEY='sectionx.schedule-sync.school-urls.v2'

type School={id:string;school_name:string;arbiter_school_url:string|null;arbiter_entity_id:string|null;active:boolean|null;is_section_x:boolean|null}
type Team={id:string;team_name:string;sport_id:string;level:string|null;active:boolean|null;school:{id:string;school_name:string}|null}
type Sport={id:string;sport_name:string;gender?:string|null}
type Mapping={team_id:string;school_id:string|null;schedule_url:string}
type Props={schools:School[];teams:Team[];sports:Sport[];teamMappings:Mapping[]}
type SchoolState={schoolId:string;status:'idle'|'running'|'done'|'failed';mapped:number;published:number;message?:string}

function normalize(v:string|null|undefined){return String(v||'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function arbiterTeamId(url:string){return url.match(/\/Teams\/Schedule\/(\d+)/i)?.[1]||null}
function candidateMatches(candidate:any,sport:Sport){const wanted=normalize(sport.sport_name);const values=[candidate.sectionXSportName,candidate.displayName,candidate.sportName,candidate.gender&&candidate.sportName?`${candidate.gender} ${candidate.sportName}`:null].filter(Boolean).map(normalize);return values.some(v=>v===wanted||v.includes(wanted)||wanted.includes(v))}
function readMap(key:string){try{return JSON.parse(localStorage.getItem(key)||'{}') as Record<string,string>}catch{return {}}}

export default function SchoolMappingManager({schools,teams,sports,teamMappings}:Props){
 const [open,setOpen]=useState(false)
 const [running,setRunning]=useState(false)
 const [progress,setProgress]=useState({current:0,total:0})
 const [states,setStates]=useState<Record<string,SchoolState>>({})
 const [message,setMessage]=useState<string|null>(null)
 const sportMap=useMemo(()=>new Map(sports.map(s=>[s.id,s])),[sports])
 const activeSchools=useMemo(()=>schools.filter(s=>s.active!==false&&s.is_section_x!==false&&!!s.arbiter_school_url).sort((a,b)=>a.school_name.localeCompare(b.school_name)),[schools])
 const varsityTeams=useMemo(()=>teams.filter(t=>t.active!==false&&(!t.level||t.level.toLowerCase().trim()==='varsity')),[teams])
 const schoolsWithDirect=useMemo(()=>new Set(teamMappings.map(m=>m.school_id).filter(Boolean)),[teamMappings])

 async function discoverOne(school:School){
   const url=school.arbiter_school_url
   if(!url)return {mapped:0,published:0}
   setStates(prev=>({...prev,[school.id]:{schoolId:school.id,status:'running',mapped:0,published:0}}))
   const res=await fetch('/api/admin/arbiter-school-sync',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})})
   const data=await res.json()
   if(!res.ok||!data.success)throw new Error(data.error||'Discovery failed')
   const internal=varsityTeams.filter(t=>t.school?.id===school.id)
   const additions:any[]=[]
   for(const team of internal){const sport=sportMap.get(team.sport_id);if(!sport)continue;const candidate=(data.teams||[]).find((c:any)=>c.isVarsity&&c.scheduleUrl&&candidateMatches(c,sport));if(candidate?.scheduleUrl)additions.push({team_id:team.id,school_id:school.id,schedule_url:candidate.scheduleUrl,arbiter_team_id:arbiterTeamId(candidate.scheduleUrl),last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()})}
   if(additions.length)await adminDb.upsert('arbiter_team_mappings',additions,'team_id')
   await adminDb.upsert('arbiter_school_mappings',{school_id:school.id,school_url:url,entity_id:school.arbiter_entity_id,last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()},'school_id')
   const teamUrls=readMap(TEAM_URLS_KEY);for(const row of additions)teamUrls[row.team_id]=row.schedule_url;localStorage.setItem(TEAM_URLS_KEY,JSON.stringify(teamUrls))
   const schoolUrls=readMap(SCHOOL_URLS_KEY);schoolUrls[school.id]=url;localStorage.setItem(SCHOOL_URLS_KEY,JSON.stringify(schoolUrls))
   const result={mapped:additions.length,published:(data.teams||[]).filter((c:any)=>c.isVarsity&&c.scheduleUrl).length}
   setStates(prev=>({...prev,[school.id]:{schoolId:school.id,status:'done',...result}}))
   return result
 }

 async function discoverAll(){
   if(running)return
   setRunning(true);setMessage(null);setStates({});setProgress({current:0,total:activeSchools.length})
   let mapped=0,failed=0
   for(let i=0;i<activeSchools.length;i++){
     const school=activeSchools[i];setProgress({current:i+1,total:activeSchools.length})
     try{const r=await discoverOne(school);mapped+=r.mapped}catch(e:any){failed++;setStates(prev=>({...prev,[school.id]:{schoolId:school.id,status:'failed',mapped:0,published:0,message:e?.message||'Discovery failed'}}))}
     await new Promise(resolve=>setTimeout(resolve,250))
   }
   setRunning(false);setMessage(`School discovery finished: ${activeSchools.length-failed} schools checked, ${mapped} direct varsity mappings saved${failed?`, ${failed} school${failed===1?'':'s'} need review`:''}. Refresh once to load the permanent coverage into Scan All.`)
 }

 return <div className="mx-4 md:mx-6 mt-4 mb-2 max-w-7xl rounded-xl" style={{border:'1px solid rgba(96,165,250,.22)',background:'linear-gradient(135deg,rgba(37,99,235,.12),var(--bg-card) 55%)'}}>
   <button onClick={()=>setOpen(v=>!v)} className="w-full p-4 md:p-5 text-left flex flex-col md:flex-row md:items-center md:justify-between gap-3">
     <div><div className="text-[10px] uppercase tracking-[.2em] font-bold" style={{color:'#60a5fa'}}>Arbiter Coverage Setup</div><div className="text-lg font-bold mt-1">{activeSchools.length} school sources connected · {teamMappings.length} direct varsity routes saved</div><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>One-time discovery converts school links into permanent direct team mappings so Scan All does not have to rediscover every team every time.</div></div>
     <div className="text-xs font-bold" style={{color:'#93c5fd'}}>{open?'Hide setup ↑':'Open setup →'}</div>
   </button>
   {open&&<div className="px-4 md:px-5 pb-5">
     <div className="rounded-lg p-4 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{background:'rgba(0,0,0,.18)',border:'1px solid rgba(255,255,255,.06)'}}>
       <div><div className="font-semibold">Build permanent team map</div><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>Safe operation: reads Arbiter team pages and saves URLs only. It does not add, edit or delete games.</div>{running&&<div className="text-xs mt-2" style={{color:'#60a5fa'}}>Checking school {progress.current} of {progress.total}…</div>}</div>
       <button onClick={discoverAll} disabled={running||!activeSchools.length} className="px-4 py-3 rounded-lg text-xs font-bold" style={{background:running?'rgba(59,130,246,.25)':'#3156df',color:'white',opacity:running?0.65:1}}>{running?'DISCOVERING…':'DISCOVER ALL SCHOOL TEAMS'}</button>
     </div>
     {message&&<div className="rounded-lg p-3 mb-4 text-sm" style={{color:'#4ade80',background:'rgba(74,222,128,.07)',border:'1px solid rgba(74,222,128,.18)'}}>{message}</div>}
     <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[430px] overflow-y-auto pr-1">
       {activeSchools.map(s=>{const st=states[s.id];const internal=varsityTeams.filter(t=>t.school?.id===s.id).length;const saved=teamMappings.filter(m=>m.school_id===s.id).length;return <div key={s.id} className="rounded-lg px-3 py-3 flex items-center justify-between gap-3" style={{background:'rgba(0,0,0,.12)',border:'1px solid var(--border)'}}><div><div className="text-sm font-semibold">{s.school_name}</div><div className="text-[11px] mt-1" style={{color:'var(--text-muted)'}}>{saved}/{internal} direct mappings saved · entity {s.arbiter_entity_id||'—'}</div>{st?.status==='done'&&<div className="text-[11px] mt-1" style={{color:'#4ade80'}}>{st.mapped} matched from {st.published} published varsity teams</div>}{st?.status==='failed'&&<div className="text-[11px] mt-1" style={{color:'#f87171'}}>{st.message}</div>}</div><div className="text-[10px] font-bold uppercase" style={{color:st?.status==='failed'?'#f87171':st?.status==='running'?'#60a5fa':schoolsWithDirect.has(s.id)?'#4ade80':'#fbbf24'}}>{st?.status==='running'?'Scanning':st?.status==='failed'?'Review':schoolsWithDirect.has(s.id)?'Mapped':'School linked'}</div></div>})}
     </div>
   </div>}
 </div>
}
