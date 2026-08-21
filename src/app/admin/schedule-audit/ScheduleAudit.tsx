// src/app/admin/schedule-audit/ScheduleAudit.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { Season, Sport } from '@/types'
import { adminDb } from '@/lib/adminDb'

interface TeamRecord { id:string; team_name:string; sport_id:string; level:string|null; active:boolean|null; school:{id:string;school_name:string;alias:string|null;slug:string;primary_color:string|null}|null }
interface TeamSeasonRecord { id:string; team_id:string; season_id:string; active_for_season:boolean|null; class:string|null; division:string|null }
interface GameRecord { id:string; season_id:string; sport_id:string; home_team_id:string|null; away_team_id:string|null; external_home_opponent_id:string|null; external_away_opponent_id:string|null; game_date:string; game_time:string|null; location:string|null; status:string; parser_confidence:string|null; game_number:number|null }
interface ImportSourceRecord { id:string; game_id:string; team_id:string; season_id:string; sport_id:string; source:string; imported_at:string }
interface Props { teams:TeamRecord[]; sports:Sport[]; seasons:Season[]; games:GameRecord[]; importSources:ImportSourceRecord[]; teamSeasons:TeamSeasonRecord[] }
interface TeamAudit { team:TeamRecord; participationId:string; sportName:string; gameCount:number; scheduleImported:boolean; confirmedCount:number; singleSourceCount:number; externalCount:number; issueCount:number; lastImportedAt:string|null; status:'complete'|'partial'|'missing'|'issue' }

const isVarsityTeam=(team:TeamRecord)=>!team.level||team.level.toLowerCase().trim()==='varsity'
const teamLabel=(team?:TeamRecord|null)=>team?.school?.school_name||team?.team_name||'Unknown team'

export default function ScheduleAudit({teams,sports,seasons,games,importSources,teamSeasons}:Props){
 const router=useRouter()
 const defaultSeason=seasons.find(s=>s.is_active)||seasons[0]
 const [seasonId,setSeasonId]=useState(defaultSeason?.id||'')
 const [sportId,setSportId]=useState('')
 const [statusFilter,setStatusFilter]=useState('all')
 const [search,setSearch]=useState('')
 const [hiddenTeamIds,setHiddenTeamIds]=useState<Set<string>>(new Set())
 const [busyTeamId,setBusyTeamId]=useState<string|null>(null)
 const [expandedTeamId,setExpandedTeamId]=useState<string|null>(null)
 const [notice,setNotice]=useState<{type:'ok'|'error';text:string}|null>(null)

 const sportMap=useMemo(()=>new Map(sports.map(s=>[s.id,`${s.sport_name}${s.gender?` (${s.gender})`:''}`])),[sports])
 const teamMap=useMemo(()=>new Map(teams.map(t=>[t.id,t])),[teams])
 const participation=useMemo(()=>new Map(teamSeasons.filter(r=>r.season_id===seasonId).map(r=>[r.team_id,r])),[teamSeasons,seasonId])
 const activeTeams=useMemo(()=>teams.filter(t=>isVarsityTeam(t)&&(!sportId||t.sport_id===sportId)&&participation.get(t.id)?.active_for_season===true&&!hiddenTeamIds.has(t.id)).sort((a,b)=>(sportMap.get(a.sport_id)||'').localeCompare(sportMap.get(b.sport_id)||'')||teamLabel(a).localeCompare(teamLabel(b))),[teams,sportId,participation,sportMap,hiddenTeamIds])
 const activeIds=useMemo(()=>new Set(activeTeams.map(t=>t.id)),[activeTeams])
 const seasonGames=useMemo(()=>games.filter(g=>g.season_id===seasonId&&(!sportId||g.sport_id===sportId)&&((g.home_team_id&&activeIds.has(g.home_team_id))||(g.away_team_id&&activeIds.has(g.away_team_id)))),[games,seasonId,sportId,activeIds])
 const seasonImports=useMemo(()=>importSources.filter(s=>s.season_id===seasonId&&(!sportId||s.sport_id===sportId)&&activeIds.has(s.team_id)),[importSources,seasonId,sportId,activeIds])
 const sourcesByGame=useMemo(()=>{const m=new Map<string,Set<string>>();seasonImports.forEach(s=>{if(!m.has(s.game_id))m.set(s.game_id,new Set());m.get(s.game_id)!.add(s.team_id)});return m},[seasonImports])

 const rows:TeamAudit[]=useMemo(()=>activeTeams.map(team=>{
   const tg=seasonGames.filter(g=>g.home_team_id===team.id||g.away_team_id===team.id)
   const ti=seasonImports.filter(i=>i.team_id===team.id)
   const p=participation.get(team.id)!
   let confirmed=0,single=0,external=0,issues=0
   tg.forEach(g=>{
     const src=sourcesByGame.get(g.id)||new Set<string>()
     const hasExternal=!!g.external_home_opponent_id||!!g.external_away_opponent_id
     const both=!!g.home_team_id&&!!g.away_team_id&&activeIds.has(g.home_team_id)&&activeIds.has(g.away_team_id)&&src.has(g.home_team_id)&&src.has(g.away_team_id)
     if(both) confirmed++
     else if(hasExternal) external++
     else single++
     if(g.parser_confidence==='Low'||!g.game_date||(!g.home_team_id&&!g.external_home_opponent_id)||(!g.away_team_id&&!g.external_away_opponent_id)) issues++
   })
   const imported=ti.length>0
   const last=ti.length?ti.map(i=>i.imported_at).sort().reverse()[0]:null
   let status:TeamAudit['status']='complete'
   if(issues>0) status='issue'
   else if(!imported&&tg.length===0) status='missing'
   else if(!imported||single>0) status='partial'
   return {team,participationId:p.id,sportName:sportMap.get(team.sport_id)||'Unknown Sport',gameCount:tg.length,scheduleImported:imported,confirmedCount:confirmed,singleSourceCount:single,externalCount:external,issueCount:issues,lastImportedAt:last,status}
 }),[activeTeams,seasonGames,seasonImports,sourcesByGame,activeIds,participation,sportMap])

 const visibleRows=useMemo(()=>rows.filter(r=>(statusFilter==='all'||r.status===statusFilter)&&(!search||teamLabel(r.team).toLowerCase().includes(search.toLowerCase())||r.sportName.toLowerCase().includes(search.toLowerCase()))),[rows,statusFilter,search])
 const counts={complete:rows.filter(r=>r.status==='complete').length,partial:rows.filter(r=>r.status==='partial').length,missing:rows.filter(r=>r.status==='missing').length,issue:rows.filter(r=>r.status==='issue').length}
 const imported=rows.filter(r=>r.scheduleImported).length
 const readiness=rows.length?Math.round((counts.complete/rows.length)*100):0
 const selectedSeason=seasons.find(s=>s.id===seasonId)
 const uniqueGames=seasonGames.length
 const confirmedGames=seasonGames.filter(g=>{if(!g.home_team_id||!g.away_team_id)return false;const src=sourcesByGame.get(g.id);return !!src&&src.has(g.home_team_id)&&src.has(g.away_team_id)}).length
 const externalGames=seasonGames.filter(g=>!!g.external_home_opponent_id||!!g.external_away_opponent_id).length
 const ringColor=readiness>=90?'#4ade80':readiness>=70?'#60a5fa':readiness>=40?'#fbbf24':'#f87171'

 async function markNotFielded(row:TeamAudit){
   const school=teamLabel(row.team)
   if(!window.confirm(`Mark ${school} ${row.sportName} as NOT FIELDED for ${selectedSeason?.name}?\n\nIt will be removed from this season's readiness audit, standings and active-team views. The team record is not deleted and can be reactivated later in Team Manager.`)) return
   setBusyTeamId(row.team.id);setNotice(null)
   try{await adminDb.update('team_seasons',{active_for_season:false},{id:row.participationId});setHiddenTeamIds(prev=>{const next=new Set(prev);next.add(row.team.id);return next});setNotice({type:'ok',text:`${school} ${row.sportName} marked Not Fielded for ${selectedSeason?.name}. Readiness recalculated.`});router.refresh()}
   catch(error){setNotice({type:'error',text:error instanceof Error?error.message:'Could not update team season.'})}
   finally{setBusyTeamId(null)}
 }

 function diagnostics(row:TeamAudit){
   const tg=seasonGames.filter(g=>g.home_team_id===row.team.id||g.away_team_id===row.team.id)
   return tg.map(g=>{
     const src=sourcesByGame.get(g.id)||new Set<string>()
     const opponentId=g.home_team_id===row.team.id?g.away_team_id:g.home_team_id
     const opponent=opponentId?teamLabel(teamMap.get(opponentId)):'External opponent'
     const external=!!g.external_home_opponent_id||!!g.external_away_opponent_id
     const both=!!g.home_team_id&&!!g.away_team_id&&src.has(g.home_team_id)&&src.has(g.away_team_id)
     const bad=g.parser_confidence==='Low'||!g.game_date||(!g.home_team_id&&!g.external_home_opponent_id)||(!g.away_team_id&&!g.external_away_opponent_id)
     const state=bad?'issue':external?'external':both?'confirmed':'unmatched'
     return {g,opponent,state,sourceCount:src.size}
   }).filter(d=>row.status==='complete'||d.state!=='confirmed')
 }

 return <div className="p-4 md:p-6 max-w-7xl">
  <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-3"><div><div className="text-xs font-bold tracking-[.22em] uppercase mb-2" style={{color:'#60a5fa'}}>Season Command Center</div><h1 className="text-3xl font-bold" style={{fontFamily:'var(--font-display)'}}>Schedule Readiness</h1><p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>One screen for the entire season. Find schedule gaps, bad team-season flags and data problems before opening day.</p></div><Link href="/admin/teams" className="text-xs font-bold px-3 py-2 rounded-lg" style={{color:'#93c5fd',border:'1px solid rgba(96,165,250,.25)',background:'rgba(59,130,246,.07)'}}>Manage Active Teams →</Link></div>
  {notice&&<div className="rounded-lg p-3 mb-4 text-sm" style={{color:notice.type==='ok'?'#4ade80':'#f87171',background:notice.type==='ok'?'rgba(74,222,128,.08)':'rgba(248,113,113,.08)',border:`1px solid ${notice.type==='ok'?'rgba(74,222,128,.2)':'rgba(248,113,113,.2)'}`}}>{notice.text}</div>}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5"><div><label className="label">Season</label><select className="input" value={seasonId} onChange={e=>{setSeasonId(e.target.value);setHiddenTeamIds(new Set());setExpandedTeamId(null);setNotice(null)}}>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className="label">Sport</label><select className="input" value={sportId} onChange={e=>{setSportId(e.target.value);setExpandedTeamId(null)}}><option value="">All Sports — Season Overview</option>{sports.map(s=><option key={s.id} value={s.id}>{s.sport_name} ({s.gender})</option>)}</select></div></div>
  <div className="rounded-xl p-5 md:p-6 mb-5" style={{background:'linear-gradient(135deg,rgba(37,99,235,.18),var(--bg-card) 58%)',border:'1px solid rgba(96,165,250,.28)'}}><div className="flex flex-col md:flex-row md:items-center gap-6"><div className="shrink-0 w-32 h-32 rounded-full flex items-center justify-center" style={{background:`conic-gradient(${ringColor} ${readiness*3.6}deg,rgba(255,255,255,.08) 0)`,padding:8}}><div className="w-full h-full rounded-full flex flex-col items-center justify-center" style={{background:'var(--bg-card)'}}><div className="text-4xl font-bold" style={{fontFamily:'var(--font-display)'}}>{readiness}%</div><div className="text-[10px] uppercase tracking-wider" style={{color:'var(--text-muted)'}}>Ready</div></div></div><div className="flex-1"><div className="text-xl font-bold" style={{fontFamily:'var(--font-display)'}}>{sportId?(sportMap.get(sportId)||'Sport'):'All Sports'} · {selectedSeason?.name}</div><div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>{rows.length} active varsity teams · {uniqueGames} unique games · {confirmedGames} confirmed both Section X sides · {externalGames} external matchups</div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4"><Mini label="Complete" value={counts.complete} color="#4ade80"/><Mini label="Needs Review" value={counts.partial} color="#fbbf24"/><Mini label="Missing" value={counts.missing} color="#fb7185"/><Mini label="Data Issues" value={counts.issue} color="#f87171"/></div></div></div></div>
  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5"><Stat label="Active Teams" value={rows.length}/><Stat label="Own Schedule Imported" value={imported} good/><Stat label="Unique Games" value={uniqueGames}/><Stat label="Confirmed Both Sides" value={confirmedGames} good/><Stat label="External Games" value={externalGames}/></div>
  {(counts.partial+counts.issue)>0&&<div className="rounded-lg p-3 mb-4 text-xs flex flex-col md:flex-row md:items-center md:justify-between gap-2" style={{background:'rgba(251,191,36,.06)',border:'1px solid rgba(251,191,36,.18)',color:'var(--text-secondary)'}}><span><strong style={{color:'#fbbf24'}}>{counts.partial+counts.issue} teams need attention.</strong> Open a team to see the exact games preventing a clean audit.</span><button onClick={()=>setStatusFilter('partial')} className="text-xs font-bold" style={{color:'#fbbf24'}}>Audit needs review →</button></div>}
  <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 mb-4"><input className="input" placeholder="Search school or sport..." value={search} onChange={e=>setSearch(e.target.value)}/><select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All Statuses</option><option value="complete">Complete</option><option value="partial">Needs Review</option><option value="missing">Missing</option><option value="issue">Data Issues</option></select></div>
  <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--border)',background:'var(--bg-card)'}}><div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{color:'var(--text-muted)',borderBottom:'1px solid var(--border)'}}><div className="col-span-3">Team</div><div className="col-span-2">Sport</div><div className="col-span-2 text-center">Readiness</div><div className="col-span-1 text-center">Games</div><div className="col-span-1 text-center">Confirmed</div><div className="col-span-1 text-center">External</div><div className="col-span-1 text-center">Unmatched</div><div className="col-span-1 text-right">Action</div></div>
  {visibleRows.map(r=>{const open=expandedTeamId===r.team.id;const detail=diagnostics(r);return <div key={r.team.id} style={{borderBottom:'1px solid var(--border)'}}><div className="grid grid-cols-1 lg:grid-cols-12 gap-2 px-4 py-4 items-center text-sm"><div className="lg:col-span-3 min-w-0"><div className="font-semibold">{teamLabel(r.team)}</div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{r.lastImportedAt?`Last import ${new Date(r.lastImportedAt).toLocaleDateString()}`:r.gameCount?`${r.gameCount} games loaded via opponents`:'No games loaded'}</div></div><div className="lg:col-span-2 text-xs" style={{color:'var(--text-secondary)'}}>{r.sportName}</div><div className="lg:col-span-2 lg:text-center"><Status status={r.status}/></div><div className="lg:col-span-1 lg:text-center font-bold">{r.gameCount}</div><div className="lg:col-span-1 lg:text-center" style={{color:'#4ade80'}}>{r.confirmedCount}</div><div className="lg:col-span-1 lg:text-center" style={{color:r.externalCount?'#60a5fa':'var(--text-muted)'}}>{r.externalCount}</div><div className="lg:col-span-1 lg:text-center" style={{color:r.singleSourceCount?'#fbbf24':'var(--text-muted)'}}>{r.singleSourceCount}{r.issueCount>0&&<span className="ml-1" style={{color:'#f87171'}}>·{r.issueCount}!</span>}</div><div className="lg:col-span-1 lg:text-right flex lg:justify-end gap-2">{r.status==='missing'?<button onClick={()=>markNotFielded(r)} disabled={busyTeamId===r.team.id} className="px-2 py-1.5 rounded-md text-[10px] font-bold uppercase" style={{color:'#fca5a5',background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.18)'}}>{busyTeamId===r.team.id?'Updating...':'Not Fielded'}</button>:<button onClick={()=>setExpandedTeamId(open?null:r.team.id)} className="px-2 py-1.5 rounded-md text-[10px] font-bold uppercase" style={{color:r.status==='complete'?'#86efac':'#fde68a',background:'rgba(255,255,255,.04)',border:'1px solid var(--border)'}}>{open?'Close':'Audit'}</button>}</div></div>{open&&<div className="px-4 pb-4"><div className="rounded-lg p-4" style={{background:'rgba(0,0,0,.18)',border:'1px solid rgba(255,255,255,.07)'}}><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3"><div><div className="font-bold">Audit: {teamLabel(r.team)}</div><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>{r.scheduleImported?'✓ Own schedule imported':'⚠ Own schedule not imported'} · {r.confirmedCount} confirmed · {r.externalCount} external · {r.singleSourceCount} unmatched</div></div><div className="text-xs font-bold" style={{color:r.status==='complete'?'#4ade80':'#fbbf24'}}>{r.status==='complete'?'SCHEDULE COMPLETE':'REVIEW THE GAMES BELOW'}</div></div>{detail.length?<div className="space-y-2">{detail.map(d=><div key={d.g.id} className="grid grid-cols-1 md:grid-cols-[120px_1fr_120px_90px] gap-2 items-center rounded-md px-3 py-2 text-xs" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.05)'}}><div>{d.g.game_date||'No date'}</div><div className="font-semibold">vs {d.opponent}</div><div style={{color:d.state==='confirmed'?'#4ade80':d.state==='external'?'#60a5fa':d.state==='issue'?'#f87171':'#fbbf24'}}>{d.state==='confirmed'?'Confirmed both':d.state==='external'?'External opponent':d.state==='issue'?'Data issue':'Only one source'}</div><div className="md:text-right" style={{color:'var(--text-muted)'}}>{d.sourceCount} source{d.sourceCount===1?'':'s'}</div></div>)}</div>:<div className="text-xs" style={{color:'var(--text-muted)'}}>No problem games found. This team's schedule is clean.</div>}</div></div>}</div>})}
  {!visibleRows.length&&<div className="p-10 text-center text-sm" style={{color:'var(--text-muted)'}}>Nothing matches this filter. That's either excellent news or an aggressively specific search.</div>}</div>
  <div className="mt-4 rounded-lg p-4 text-xs" style={{background:'rgba(59,130,246,.06)',border:'1px solid rgba(59,130,246,.15)',color:'var(--text-secondary)'}}><strong style={{color:'var(--text-primary)'}}>Readiness logic:</strong> Complete means the team's own schedule is imported and loaded Section X-vs-Section X matchups are confirmed from both sides. External opponents count as valid without a second Section X source. Needs Review means genuine Section X coverage is partial/unmatched. Use Audit to see the exact games causing it.</div>
 </div>
}

function Status({status}:{status:TeamAudit['status']}){const cfg={complete:['READY','#4ade80','rgba(74,222,128,.10)'],partial:['NEEDS REVIEW','#fbbf24','rgba(251,191,36,.10)'],missing:['MISSING','#fb7185','rgba(251,113,133,.10)'],issue:['DATA ISSUE','#f87171','rgba(248,113,113,.10)']}[status];return <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide" style={{color:cfg[1],background:cfg[2]}}>{cfg[0]}</span>}
function Mini({label,value,color}:{label:string;value:number;color:string}){return <div className="rounded-lg px-3 py-2" style={{background:'rgba(0,0,0,.18)',border:'1px solid rgba(255,255,255,.06)'}}><div className="text-2xl font-bold" style={{fontFamily:'var(--font-display)',color}}>{value}</div><div className="text-[10px] uppercase tracking-wide" style={{color:'var(--text-muted)'}}>{label}</div></div>}
function Stat({label,value,good=false}:{label:string;value:number;good?:boolean}){return <div className="rounded-lg p-3" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}><div className="text-xs mb-1" style={{color:'var(--text-muted)'}}>{label}</div><div className="text-2xl font-bold" style={{fontFamily:'var(--font-display)',color:good?'#4ade80':'var(--text-primary)'}}>{value}</div></div>}