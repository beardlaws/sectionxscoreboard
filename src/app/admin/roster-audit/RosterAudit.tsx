// src/app/admin/roster-audit/RosterAudit.tsx
'use client'

import { useMemo, useState } from 'react'

interface School { id:string; school_name:string; slug:string; alias:string|null; active:boolean; arbiter_entity_id:string|null; arbiter_school_url:string|null }
interface Team { id:string; school_id:string; sport_id:string; team_name:string; slug:string; level:string|null; active:boolean }
interface Sport { id:string; sport_name:string; gender:string|null; season_type:string|null; slug:string }
interface Season { id:string; name:string; season_type:string; year:number; is_active:boolean }
interface TeamSeason { id:string; team_id:string; season_id:string; active_for_season:boolean|null; division:string|null; class:string|null }
interface RosterEntry { id:string; team_id:string; season_id:string; athlete_id:string; active:boolean; imported_at:string|null; source:string|null }
interface CoachEntry { id:string; team_id:string; season_id:string; coach_id:string; active:boolean; imported_at:string|null; source:string|null }
interface Props { schools:School[]; teams:Team[]; sports:Sport[]; seasons:Season[]; teamSeasons:TeamSeason[]; rosterEntries:RosterEntry[]; coachEntries:CoachEntry[] }
interface ArbiterTeam { teamId:string; sectionXSportName:string|null; seasonType:'Fall'|'Winter'|'Spring'|null; scheduleUrl:string; rosterFound:boolean; roster:Array<{jerseyNumber:string;displayName:string;firstName:string;lastName:string;classYear:string;position:string;height:string}>; coachesFound:boolean; coaches:Array<{displayName:string;firstName:string;lastName:string;title:string}> }
interface ArbiterResponse { success:boolean; teams:ArbiterTeam[]; error?:string }
type AuditStatus = 'loaded'|'coaches-only'|'no-data'|'no-link'

function displaySportName(sport:Sport) { const name=sport.sport_name||''; const gender=sport.gender||''; return (gender==='Boys'||gender==='Girls')&&!name.toLowerCase().startsWith(gender.toLowerCase()) ? `${gender} ${name}` : name }
function normalize(value:string) { return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim() }
function latestDate(values:Array<string|null>) { const clean=values.filter(Boolean) as string[]; return clean.length ? clean.sort().at(-1)||null : null }
function getStatus(rosterCount:number, coachCount:number, linked:boolean):AuditStatus { if(rosterCount>0)return 'loaded'; if(coachCount>0)return 'coaches-only'; if(!linked)return 'no-link'; return 'no-data' }
function statusLabel(status:AuditStatus) { if(status==='loaded')return 'ROSTER LOADED'; if(status==='coaches-only')return 'COACHES ONLY'; if(status==='no-link')return 'NO ARBITER LINK'; return 'NO ROSTER DATA' }
function statusClass(status:AuditStatus) { if(status==='loaded')return 'text-emerald-400'; if(status==='coaches-only')return 'text-sky-400'; if(status==='no-link')return 'text-red-400'; return 'text-amber-400' }

export default function RosterAudit({schools,teams,sports,seasons,teamSeasons,rosterEntries,coachEntries}:Props) {
  const activeSeason=seasons.find(s=>s.is_active)||seasons[0]
  const [sportFilter,setSportFilter]=useState('')
  const [schoolFilter,setSchoolFilter]=useState('')
  const [statusFilter,setStatusFilter]=useState('')
  const [syncing,setSyncing]=useState(false)
  const [progress,setProgress]=useState('')
  const [syncErrors,setSyncErrors]=useState<string[]>([])
  const [completedSchools,setCompletedSchools]=useState(0)
  const [syncSummary,setSyncSummary]=useState('')

  const activeRows=useMemo(()=>{
    if(!activeSeason)return []
    return teamSeasons.filter(ts=>ts.season_id===activeSeason.id&&ts.active_for_season!==false).map(ts=>{
      const team=teams.find(t=>t.id===ts.team_id); if(!team||team.active===false||(team.level&&team.level.toLowerCase().trim()!=='varsity'))return null
      const school=schools.find(s=>s.id===team.school_id); const sport=sports.find(s=>s.id===team.sport_id); if(!school||!sport)return null
      const roster=rosterEntries.filter(e=>e.team_id===team.id&&e.season_id===activeSeason.id&&e.active)
      const coaches=coachEntries.filter(e=>e.team_id===team.id&&e.season_id===activeSeason.id&&e.active)
      const lastImported=latestDate([...roster.map(e=>e.imported_at),...coaches.map(e=>e.imported_at)])
      const status=getStatus(roster.length,coaches.length,Boolean(school.arbiter_school_url))
      return {teamSeason:ts,team,school,sport,rosterCount:roster.length,coachCount:coaches.length,lastImported,status}
    }).filter(Boolean) as Array<{teamSeason:TeamSeason;team:Team;school:School;sport:Sport;rosterCount:number;coachCount:number;lastImported:string|null;status:AuditStatus}>
  },[activeSeason,teamSeasons,teams,schools,sports,rosterEntries,coachEntries])

  const filteredRows=useMemo(()=>activeRows.filter(r=>(!sportFilter||r.sport.id===sportFilter)&&(!schoolFilter||r.school.id===schoolFilter)&&(!statusFilter||r.status===statusFilter)).sort((a,b)=>{const sc=displaySportName(a.sport).localeCompare(displaySportName(b.sport)); return sc!==0?sc:a.school.school_name.localeCompare(b.school.school_name)}),[activeRows,sportFilter,schoolFilter,statusFilter])
  const rosterLoaded=activeRows.filter(r=>r.status==='loaded').length
  const coachesOnly=activeRows.filter(r=>r.status==='coaches-only').length
  const noData=activeRows.filter(r=>r.status==='no-data').length
  const athletes=activeRows.reduce((sum,r)=>sum+r.rosterCount,0)
  const coaches=activeRows.reduce((sum,r)=>sum+r.coachCount,0)
  const linkedSchools=schools.filter(s=>s.arbiter_school_url)

  function findInternalSport(name:string|null){ if(!name)return null; const wanted=normalize(name); return sports.find(s=>normalize(displaySportName(s))===wanted)||sports.find(s=>normalize(s.sport_name)===wanted)||null }

  async function syncSchools(onlyMissing:boolean,schoolIds?:string[]){
    if(!activeSeason||syncing)return
    const missingSchoolIds=new Set(activeRows.filter(r=>r.rosterCount===0).map(r=>r.school.id))
    const targets=linkedSchools.filter(s=>(!onlyMissing||missingSchoolIds.has(s.id))&&(!schoolIds||schoolIds.includes(s.id)))
    if(!targets.length){setSyncErrors([onlyMissing?'No linked schools currently need a roster sync.':'No linked schools match this request.']);return}
    setSyncing(true);setSyncErrors([]);setCompletedSchools(0);setSyncSummary('')
    const errors:string[]=[]; let publishedTeams=0; let discoveredRosterTeams=0; let discoveredCoachTeams=0
    const started=Date.now()
    for(let index=0;index<targets.length;index++){
      const school=targets[index];setProgress(`${index+1}/${targets.length} · Checking ${school.school_name}`)
      try{
        const discoveryResponse=await fetch('/api/admin/arbiter-school-sync',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:school.arbiter_school_url})})
        const discovery:ArbiterResponse=await discoveryResponse.json()
        if(!discoveryResponse.ok||!discovery.success)throw new Error(discovery.error||`Discovery failed with ${discoveryResponse.status}`)
        const seasonTeams=discovery.teams.filter(t=>t.seasonType===activeSeason.season_type)
        discoveredRosterTeams+=seasonTeams.filter(t=>t.rosterFound).length; discoveredCoachTeams+=seasonTeams.filter(t=>t.coachesFound).length
        const payload=seasonTeams.filter(t=>t.rosterFound||t.coachesFound).map(arbiterTeam=>{
          const sport=findInternalSport(arbiterTeam.sectionXSportName); if(!sport)return null
          const team=teams.find(item=>item.school_id===school.id&&item.sport_id===sport.id&&item.active!==false&&(!item.level||item.level.toLowerCase().trim()==='varsity')); if(!team)return null
          return {team_id:team.id,season_id:activeSeason.id,source_url:arbiterTeam.scheduleUrl,roster_found:arbiterTeam.rosterFound,coaches_found:arbiterTeam.coachesFound,roster:arbiterTeam.roster,coaches:arbiterTeam.coaches}
        }).filter(Boolean)
        if(payload.length){
          const publishResponse=await fetch('/api/admin/arbiter-rosters',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({teams:payload})})
          const result=await publishResponse.json(); if(!publishResponse.ok)throw new Error(result.error||`Roster publish failed with ${publishResponse.status}`)
          publishedTeams+=payload.length
          if(Array.isArray(result.errors))result.errors.forEach((e:string)=>errors.push(`${school.school_name}: ${e}`))
        }
      }catch(error:any){errors.push(`${school.school_name}: ${error?.message||'Sync failed'}`)}
      setCompletedSchools(index+1)
    }
    const seconds=Math.max(1,Math.round((Date.now()-started)/1000))
    setProgress(`Finished ${targets.length} school${targets.length===1?'':'s'}`)
    setSyncSummary(`${targets.length} schools checked · ${discoveredRosterTeams} roster pages found · ${discoveredCoachTeams} coach pages found · ${publishedTeams} teams updated · ${errors.length} errors · ${seconds}s`)
    setSyncErrors(errors);setSyncing(false)
    setTimeout(()=>window.location.reload(),2500)
  }

  return <div className="p-4 max-w-7xl">
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      <div><h1 className="text-2xl font-bold mb-1" style={{fontFamily:'var(--font-display)'}}>Roster Audit</h1><p className="text-sm" style={{color:'var(--text-secondary)'}}>Audit active {activeSeason?.name||'season'} varsity rosters and coaches, diagnose gaps, and safely sync saved Arbiter school links.</p></div>
      <div className="flex gap-2 flex-wrap"><button className="btn-ghost" disabled={syncing} onClick={()=>syncSchools(true)}>{syncing?'Sync Running...':'Sync Missing Rosters'}</button><button className="btn-primary" disabled={syncing} onClick={()=>syncSchools(false)}>{syncing?'Syncing Section X...':'Sync All Linked Schools'}</button></div>
    </div>

    {syncing&&<div className="rounded-xl p-4 mb-4" style={{background:'rgba(37,99,235,0.08)',border:'1px solid rgba(37,99,235,0.22)'}}><div className="text-sm font-bold text-blue-300">{progress}</div><div className="text-xs text-slate-500 mt-1">{completedSchools} schools completed. Sequential processing protects Arbiter and keeps failures isolated.</div></div>}
    {syncSummary&&<div className="rounded-xl p-4 mb-4 text-sm text-emerald-300" style={{background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.18)'}}>{syncSummary}</div>}
    {syncErrors.length>0&&<div className="rounded-xl p-4 mb-4" style={{background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.18)'}}>{syncErrors.map((e,i)=><div key={i} className="text-xs text-red-300 mb-1 last:mb-0">{e}</div>)}</div>}

    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
      {[['Active Teams',activeRows.length],['Roster Loaded',rosterLoaded],['Coaches Only',coachesOnly],['No Roster Data',noData],['Athletes',athletes],['Coaches',coaches],['Linked Schools',`${linkedSchools.length}/${schools.length}`],['Showing',filteredRows.length]].map(([label,value])=><div key={String(label)} className="card p-4"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-black mt-1 text-white" style={{fontFamily:'var(--font-display)'}}>{value}</div></div>)}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <select className="input" value={sportFilter} onChange={e=>setSportFilter(e.target.value)}><option value="">All Active Sports</option>{sports.filter(s=>!activeSeason||!s.season_type||s.season_type===activeSeason.season_type).map(s=><option key={s.id} value={s.id}>{displaySportName(s)}</option>)}</select>
      <select className="input" value={schoolFilter} onChange={e=>setSchoolFilter(e.target.value)}><option value="">All Schools</option>{schools.filter(s=>activeRows.some(r=>r.school.id===s.id)).sort((a,b)=>a.school_name.localeCompare(b.school_name)).map(s=><option key={s.id} value={s.id}>{s.school_name}</option>)}</select>
      <select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All Statuses</option><option value="loaded">Roster Loaded</option><option value="coaches-only">Coaches Only</option><option value="no-data">No Roster Data</option><option value="no-link">No Arbiter Link</option></select>
    </div>

    <div className="rounded-xl overflow-hidden border border-white/[0.07]"><div className="overflow-x-auto"><table className="w-full text-sm"><thead style={{background:'rgba(255,255,255,0.025)'}}><tr className="text-slate-500"><th className="text-left px-4 py-3 font-medium">Team</th><th className="text-left px-4 py-3 font-medium">Sport</th><th className="text-center px-4 py-3 font-medium">Roster</th><th className="text-center px-4 py-3 font-medium">Coaches</th><th className="text-left px-4 py-3 font-medium">Last Import</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="text-right px-4 py-3 font-medium">Actions</th></tr></thead><tbody>
      {filteredRows.map(row=><tr key={row.team.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]"><td className="px-4 py-3"><div className="font-bold text-white">{row.school.school_name}</div><div className="text-xs text-slate-500">{row.team.team_name}</div></td><td className="px-4 py-3 text-slate-400">{displaySportName(row.sport)}</td><td className="px-4 py-3 text-center font-mono text-white">{row.rosterCount}</td><td className="px-4 py-3 text-center font-mono text-white">{row.coachCount}</td><td className="px-4 py-3 text-xs text-slate-500">{row.lastImported?new Date(row.lastImported).toLocaleString():'Never imported'}</td><td className="px-4 py-3"><span className={`text-xs font-bold ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-3 items-center"><button disabled={syncing||!row.school.arbiter_school_url} onClick={()=>syncSchools(false,[row.school.id])} className="text-xs font-bold text-amber-300 hover:underline disabled:opacity-30">Sync School</button>{row.school.arbiter_school_url&&<a href={row.school.arbiter_school_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-400 hover:underline">Arbiter</a>}<a href={`/teams/${row.team.slug}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-400 hover:underline">Team →</a></div></td></tr>)}
    </tbody></table></div>{filteredRows.length===0&&<div className="p-8 text-center text-sm text-slate-500">No active teams match these filters.</div>}</div>

    <div className="mt-4 text-xs text-slate-500">Roster sync is safe to rerun. Existing Arbiter records are updated rather than duplicated. “No Roster Data” means no active roster entries are currently stored; persistent Last Checked diagnostics will be added with sync-history storage.</div>
  </div>
}
