'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { parseArbiterSchedule } from '@/lib/parser'
import type { ParsedGameRow, Season, Sport } from '@/types'

type TeamRecord = {
  id: string
  team_name: string
  sport_id: string
  level: string | null
  active: boolean | null
  school: { id: string; school_name: string; slug: string; alias: string | null } | null
}
type TeamSeasonRecord = { team_id: string; season_id: string; active_for_season: boolean | null }
type DiffKind = 'unchanged'|'new'|'date_changed'|'time_changed'|'location_changed'|'status_changed'|'details_changed'|'possible_removed'|'external_review'|'conflict'
type DiffRow = { key:string; kind:DiffKind; safe:boolean; existing_game_id:string|null; incoming:any|null; existing:any|null; changes:Array<{field:string;before:string|number|boolean|null;after:string|number|boolean|null}>; note?:string }
type CompareResult = {
  success:boolean
  scanned_at:string
  existing_count:number
  incoming_count:number
  safe_count:number
  detected_change_count?:number
  bulk_safe_change_count?:number
  new_game_count?:number
  review_count:number
  counts:Record<string,number>
  apply_allowed?:boolean
  safety_reasons?:string[]
  normalization?:string
  diffs:DiffRow[]
}
type ScanOutput = { comparison:CompareResult; rows:ParsedGameRow[]; resolvedUrl:string; arbiterTeamName?:string|null }
type BatchRow = {
  teamId:string
  teamName:string
  sportName:string
  status:'clean'|'changed'|'new'|'review'|'blocked'|'failed'
  unchanged:number
  updates:number
  newGames:number
  review:number
  message?:string
  output?:ScanOutput
}
interface Props { teams:TeamRecord[]; sports:Sport[]; seasons:Season[]; teamSeasons:TeamSeasonRecord[] }

const TEAM_URLS_KEY='sectionx.schedule-sync.team-urls.v2'
const SCHOOL_URLS_KEY='sectionx.schedule-sync.school-urls.v2'

function normalizeSport(value:string|null|undefined){return String(value||'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function schoolUrlFromScheduleUrl(value:string){try{const u=new URL(value);const id=u.searchParams.get('activeEntityId')||u.searchParams.get('entityId');return id?`https://arbiterlive.com/Teams?entityId=${id}`:null}catch{return null}}
function kindLabel(kind:DiffKind){return ({unchanged:'UNCHANGED',new:'NEW GAME',date_changed:'DATE / RESCHEDULE REVIEW',time_changed:'TIME CHANGED',location_changed:'VENUE CHANGE REVIEW',status_changed:'STATUS CHANGED',details_changed:'DETAILS REVIEW',possible_removed:'POSSIBLE REMOVED',external_review:'EXTERNAL GAME REVIEW',conflict:'CONFLICT'} as Record<DiffKind,string>)[kind]}
function kindColor(kind:DiffKind){if(kind==='unchanged')return '#4ade80';if(kind==='new')return '#60a5fa';if(['possible_removed','external_review','conflict'].includes(kind))return '#f87171';return '#fbbf24'}
function wait(ms:number){return new Promise(resolve=>setTimeout(resolve,ms))}
function formatTime(value:any){const raw=String(value||'').trim();const match=raw.match(/^(\d{1,2}):(\d{2})/);if(!match)return raw||'TBD';let h=Number(match[1]);const m=match[2];const ampm=h>=12?'PM':'AM';h=h%12||12;return `${h}:${m} ${ampm}`}

export default function ScheduleSync({teams,sports,seasons,teamSeasons}:Props){
  const searchParams=useSearchParams()
  const detailRef=useRef<HTMLDivElement|null>(null)
  const sportMap=useMemo(()=>new Map(sports.map(s=>[s.id,s])),[sports])
  const teamMap=useMemo(()=>new Map(teams.map(t=>[t.id,t])),[teams])
  const allVarsityTeams=useMemo(()=>teams.filter(t=>t.active!==false&&(!t.level||t.level.toLowerCase().trim()==='varsity')).sort((a,b)=>(a.school?.school_name||a.team_name).localeCompare(b.school?.school_name||b.team_name)),[teams])

  const requestedSeason=searchParams.get('season')||''
  const requestedTeam=searchParams.get('team')||''
  const [teamId,setTeamId]=useState(requestedTeam)
  const [seasonId,setSeasonId]=useState(requestedSeason||seasons.find(s=>s.is_active)?.id||seasons[0]?.id||'')
  const [arbiterUrl,setArbiterUrl]=useState('')
  const [teamUrls,setTeamUrls]=useState<Record<string,string>>({})
  const [schoolUrls,setSchoolUrls]=useState<Record<string,string>>({})
  const [loading,setLoading]=useState(false)
  const [applying,setApplying]=useState(false)
  const [itemApplying,setItemApplying]=useState<string|null>(null)
  const [discoveringSchool,setDiscoveringSchool]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [result,setResult]=useState<CompareResult|null>(null)
  const [parsedRows,setParsedRows]=useState<ParsedGameRow[]>([])
  const [scanMeta,setScanMeta]=useState<{teamName?:string|null;rowCount?:number;sourceUrl?:string}|null>(null)
  const [applyMessage,setApplyMessage]=useState<string|null>(null)
  const [mappingMessage,setMappingMessage]=useState<string|null>(null)
  const [batchRunning,setBatchRunning]=useState(false)
  const [batchProgress,setBatchProgress]=useState({current:0,total:0})
  const [batchRows,setBatchRows]=useState<BatchRow[]>([])

  useEffect(()=>{try{setTeamUrls(JSON.parse(localStorage.getItem(TEAM_URLS_KEY)||'{}'));setSchoolUrls(JSON.parse(localStorage.getItem(SCHOOL_URLS_KEY)||'{}'))}catch{setTeamUrls({});setSchoolUrls({})}},[])

  const selectedSeason=seasons.find(s=>s.id===seasonId)||null
  const activeTeamIds=useMemo(()=>new Set(teamSeasons.filter(r=>r.season_id===seasonId&&r.active_for_season===true).map(r=>r.team_id)),[teamSeasons,seasonId])
  const seasonTeams=useMemo(()=>allVarsityTeams.filter(team=>{const sport=sportMap.get(team.sport_id);const seasonTypeMatches=!selectedSeason||!sport||sport.season_type===selectedSeason.season_type;const participationKnown=teamSeasons.some(r=>r.team_id===team.id&&r.season_id===seasonId);return seasonTypeMatches&&(!participationKnown||activeTeamIds.has(team.id))}),[allVarsityTeams,sportMap,selectedSeason,teamSeasons,seasonId,activeTeamIds])
  const selectedTeam=seasonTeams.find(t=>t.id===teamId)||null
  const selectedSport=selectedTeam?sportMap.get(selectedTeam.sport_id)||null:null
  const knownTeamsForSeason=useMemo(()=>seasonTeams.filter(team=>!!teamUrls[team.id]||!!(team.school?.id&&schoolUrls[team.school.id])),[seasonTeams,teamUrls,schoolUrls])

  useEffect(()=>{
    if(!teamId)return
    const t=seasonTeams.find(x=>x.id===teamId)
    if(!t)return
    const remembered=teamUrls[teamId]||(t.school?.id?schoolUrls[t.school.id]:'')||''
    if(remembered&&!arbiterUrl)setArbiterUrl(remembered)
  },[teamId,seasonTeams,teamUrls,schoolUrls,arbiterUrl])

  function resetResults(){setResult(null);setParsedRows([]);setScanMeta(null);setError(null);setApplyMessage(null)}
  function saveUrlMaps(nextTeamUrls:Record<string,string>,nextSchoolUrls:Record<string,string>){setTeamUrls(nextTeamUrls);setSchoolUrls(nextSchoolUrls);localStorage.setItem(TEAM_URLS_KEY,JSON.stringify(nextTeamUrls));localStorage.setItem(SCHOOL_URLS_KEY,JSON.stringify(nextSchoolUrls))}
  function rememberDirectMapping(team:TeamRecord,url:string){const nextTeamUrls={...teamUrls,[team.id]:url};const schoolUrl=schoolUrlFromScheduleUrl(url);const nextSchoolUrls={...schoolUrls};if(team.school?.id&&schoolUrl)nextSchoolUrls[team.school.id]=schoolUrl;saveUrlMaps(nextTeamUrls,nextSchoolUrls)}
  function candidateMatchesSport(candidate:any,sport:Sport){const wanted=normalizeSport(sport.sport_name);const values=[candidate.sectionXSportName,candidate.displayName,candidate.sportName,candidate.gender&&candidate.sportName?`${candidate.gender} ${candidate.sportName}`:null].filter(Boolean).map(normalizeSport);return values.some(v=>v===wanted||v.includes(wanted))}

  async function discoverSchoolMappings(team:TeamRecord,rawSchoolUrl:string){if(!team.school?.id||!rawSchoolUrl)return 0;const response=await fetch('/api/admin/arbiter-school-sync',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:rawSchoolUrl})});const discovery=await response.json();if(!response.ok||!discovery.success)throw new Error(discovery.error||'Could not discover Arbiter teams for this school.');const additions:Record<string,string>={};for(const internal of allVarsityTeams.filter(x=>x.school?.id===team.school?.id)){const sport=sportMap.get(internal.sport_id);if(!sport)continue;const candidate=(discovery.teams||[]).find((item:any)=>item.isVarsity&&item.scheduleUrl&&candidateMatchesSport(item,sport));if(candidate?.scheduleUrl)additions[internal.id]=candidate.scheduleUrl}saveUrlMaps({...teamUrls,...additions},{...schoolUrls,[team.school.id]:rawSchoolUrl});return Object.keys(additions).length}
  async function resolveScheduleUrl(team:TeamRecord,sport:Sport,rawUrl:string){const trimmed=rawUrl.trim();if(/\/Teams\/Schedule\/\d+/i.test(trimmed))return trimmed;const response=await fetch('/api/admin/arbiter-school-sync',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:trimmed})});const discovery=await response.json();if(!response.ok||!discovery.success)throw new Error(discovery.error||'Could not discover schedules from that Arbiter school URL.');const candidate=(discovery.teams||[]).find((item:any)=>item.isVarsity&&item.scheduleUrl&&candidateMatchesSport(item,sport));if(!candidate?.scheduleUrl)throw new Error(`Arbiter did not publish a matching varsity ${sport.sport_name} schedule for ${team.school?.school_name||team.team_name}.`);return candidate.scheduleUrl as string}
  function teamRecordsForSport(team:TeamRecord){return teams.filter(c=>c.sport_id===team.sport_id).map(c=>({id:c.id,team_name:c.team_name,school_name:c.school?.school_name||'',slug:c.school?.slug||'',aliases:c.school?.alias?[c.school.alias]:[]}))}

  async function performScan(team:TeamRecord,season:Season,rawUrl:string):Promise<ScanOutput>{
    const sport=sportMap.get(team.sport_id);if(!sport)throw new Error('Could not determine the selected sport.')
    const resolvedUrl=await resolveScheduleUrl(team,sport,rawUrl)
    const arbiterResponse=await fetch('/api/admin/arbiter-team',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:resolvedUrl})})
    const arbiter=await arbiterResponse.json();if(!arbiterResponse.ok||!arbiter.success)throw new Error(arbiter.error||`Arbiter fetch failed (${arbiterResponse.status})`)
    let rows=parseArbiterSchedule(arbiter.arbiterText,{teams:teamRecordsForSport(team),sourceTeamId:team.id,defaultDate:new Date().toISOString().slice(0,10),defaultSportId:team.sport_id,defaultSeasonId:season.id,year:season.year})
    rows=rows.map(row=>({...row,approved:row.confidence!=='Low'}))
    const comparableRows=rows.filter(row=>row.confidence!=='Low'&&row.game_date)
    const games=comparableRows.map(row=>({season_id:season.id,sport_id:row.sport_id||team.sport_id,game_date:row.game_date,game_time:row.game_time,location:row.location||null,home_team_id:row.home_team_id||null,away_team_id:row.away_team_id||null,external_home_name:row.external_home_name||null,external_away_name:row.external_away_name||null,home_score:row.home_score,away_score:row.away_score,status:row.status,rescheduled_date:row.rescheduled_date,game_number:row.game_number,neutral_site:row.neutral_site,event_name:row.event_name,notes:row.notes||null,parser_confidence:row.confidence,source:'arbiter',verification_status:'Reported'}))
    const compareResponse=await fetch('/api/admin/schedule-sync',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({team_id:team.id,season_id:season.id,sport_id:team.sport_id,games})})
    const comparison=await compareResponse.json();if(!compareResponse.ok||!comparison.success)throw new Error(comparison.error||`Comparison failed (${compareResponse.status})`)
    return {comparison,rows,resolvedUrl,arbiterTeamName:arbiter.teamName}
  }

  async function runScan(){if(!selectedTeam||!selectedSeason||!selectedSport||!arbiterUrl.trim())return;setLoading(true);setError(null);setApplyMessage(null);setMappingMessage(null);setResult(null);try{const output=await performScan(selectedTeam,selectedSeason,arbiterUrl);setParsedRows(output.rows);setScanMeta({teamName:output.arbiterTeamName,rowCount:output.rows.length,sourceUrl:output.resolvedUrl});setResult(output.comparison);setArbiterUrl(output.resolvedUrl);rememberDirectMapping(selectedTeam,output.resolvedUrl);const schoolUrl=schoolUrlFromScheduleUrl(output.resolvedUrl);if(schoolUrl&&selectedTeam.school?.id&&!schoolUrls[selectedTeam.school.id]){setDiscoveringSchool(true);try{const count=await discoverSchoolMappings(selectedTeam,schoolUrl);setMappingMessage(`Remembered ${count} published varsity Arbiter team link${count===1?'':'s'} for ${selectedTeam.school.school_name}.`)}catch(e:any){setMappingMessage(`This team URL was remembered. School-wide discovery can be retried later: ${e?.message||'unknown error'}`)}finally{setDiscoveringSchool(false)}}}catch(e:any){setError(e?.message||'Could not scan this schedule.')}finally{setLoading(false)}}

  async function publishGames(games:any[],message:string){if(!selectedTeam)return;const response=await fetch('/api/admin/games',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({games,import_team_id:selectedTeam.id,import_source:'arbiter'})});const publish=await response.json();if(!response.ok)throw new Error(publish.error||`Sync apply failed (${response.status})`);setApplyMessage(message)}

  async function applySafeSync(){
    if(!result||!selectedTeam||!selectedSeason)return
    if(result.apply_allowed===false){setError('This scan is safety-blocked. Re-scan or review the warnings before applying anything.');return}
    const safe=result.diffs.filter(d=>d.safe&&d.incoming)
    if(!safe.length)return
    const safeUpdates=safe.filter(d=>d.kind!=='unchanged')
    const description=safeUpdates.length?`${safeUpdates.length} high-confidence time/status update${safeUpdates.length===1?'':'s'} plus source verification`:'source verification timestamps only'
    if(!window.confirm(`Apply ${description}?\n\nNew games, venue changes, reschedules, removals and conflicts will NOT be included.`))return
    setApplying(true);setError(null);setApplyMessage(null)
    try{const games=safe.map(diff=>({...(diff.existing_game_id?{id:diff.existing_game_id}:{}),...diff.incoming,season_id:selectedSeason.id,sport_id:selectedTeam.sport_id,source:'arbiter',verification_status:'Reported'}));await publishGames(games,`Safe sync applied. Re-scan now to verify the schedule is clean.`)}catch(e:any){setError(e?.message||'Could not apply schedule changes.')}finally{setApplying(false)}
  }

  async function applyOneDiff(diff:DiffRow){
    if(!selectedTeam||!selectedSeason||!diff.incoming)return
    const isNew=diff.kind==='new'||diff.kind==='external_review'
    const isManualExisting=!!diff.existing_game_id&&['date_changed','location_changed','details_changed'].includes(diff.kind)
    if(!isNew&&!isManualExisting)return
    const action=isNew?'add this fresh game':'apply this reviewed change'
    if(!window.confirm(`Are you sure you want to ${action}?\n\nThis only affects this one item.`))return
    setItemApplying(diff.key);setError(null);setApplyMessage(null)
    try{
      const game={...(diff.existing_game_id?{id:diff.existing_game_id}:{}),...diff.incoming,season_id:selectedSeason.id,sport_id:selectedTeam.sport_id,source:'arbiter',verification_status:'Reported'}
      await publishGames([game],isNew?'Game added. Re-scan this team to confirm it now matches.':'Reviewed change applied. Re-scan this team to confirm it now matches.')
    }catch(e:any){setError(e?.message||'Could not apply this item.')}finally{setItemApplying(null)}
  }

  async function scanAllKnown(){
    if(!selectedSeason||knownTeamsForSeason.length===0)return
    setBatchRunning(true);setBatchRows([]);setBatchProgress({current:0,total:knownTeamsForSeason.length})
    const collected:BatchRow[]=[]
    for(let i=0;i<knownTeamsForSeason.length;i+=1){
      const team=knownTeamsForSeason[i];const sport=sportMap.get(team.sport_id);const rawUrl=teamUrls[team.id]||(team.school?.id?schoolUrls[team.school.id]:'')||'';setBatchProgress({current:i+1,total:knownTeamsForSeason.length})
      try{
        const output=await performScan(team,selectedSeason,rawUrl);rememberDirectMapping(team,output.resolvedUrl)
        const c=output.comparison;const updates=c.bulk_safe_change_count??c.diffs.filter(d=>d.safe&&d.kind!=='unchanged').length;const newGames=c.new_game_count??((c.counts?.new||0)+(c.counts?.external_review||0));const otherReview=Math.max(0,(c.review_count||0)-newGames);const blocked=c.apply_allowed===false
        const status:BatchRow['status']=blocked?'blocked':otherReview>0?'review':newGames>0?'new':updates>0?'changed':'clean'
        collected.push({teamId:team.id,teamName:team.school?.school_name||team.team_name,sportName:sport?.sport_name||team.team_name,status,unchanged:c.counts?.unchanged||0,updates,newGames,review:otherReview,message:blocked?(c.safety_reasons||[]).join(' '):undefined,output})
      }catch(e:any){collected.push({teamId:team.id,teamName:team.school?.school_name||team.team_name,sportName:sport?.sport_name||team.team_name,status:'failed',unchanged:0,updates:0,newGames:0,review:0,message:e?.message||'Scan failed'})}
      setBatchRows([...collected]);await wait(250)
    }
    setBatchRunning(false)
  }

  function openBatchReview(row:BatchRow){if(!row.output)return;const team=seasonTeams.find(t=>t.id===row.teamId);setTeamId(row.teamId);setArbiterUrl(row.output.resolvedUrl);setResult(row.output.comparison);setParsedRows(row.output.rows);setScanMeta({teamName:row.output.arbiterTeamName,rowCount:row.output.rows.length,sourceUrl:row.output.resolvedUrl});setError(null);setApplyMessage(null);setMappingMessage(team?`Opened ${row.teamName} ${row.sportName} from the season scan. Review the exact items below.`:null);setTimeout(()=>detailRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),50)}

  function teamLabel(id:string|null|undefined){if(!id)return null;const team=teamMap.get(id);return team?.school?.school_name||team?.team_name||'Section X team'}
  function gameDetails(game:any){if(!game)return null;const home=teamLabel(game.home_team_id)||game.external_home_name||'TBD';const away=teamLabel(game.away_team_id)||game.external_away_name||'TBD';return {home,away,time:formatTime(game.game_time),location:game.location||'TBD',status:game.status||'Scheduled'}}

  const safeUpdateCount=result?(result.bulk_safe_change_count??result.diffs.filter(d=>d.safe&&d.kind!=='unchanged').length):0
  const newGameCount=result?(result.new_game_count??((result.counts?.new||0)+(result.counts?.external_review||0))):0
  const unchangedCount=result?.counts?.unchanged||0
  const totalReviewCount=result?.review_count||0
  const manualReviewCount=Math.max(0,totalReviewCount-newGameCount)
  const applyAllowed=result?.apply_allowed!==false
  const batchTotals=batchRows.reduce((acc,row)=>{if(row.status==='clean')acc.cleanTeams+=1;if(row.status==='blocked')acc.blocked+=1;if(row.status==='failed')acc.failed+=1;acc.updates+=row.updates;acc.newGames+=row.newGames;acc.review+=row.review;return acc},{cleanTeams:0,updates:0,newGames:0,review:0,blocked:0,failed:0})

  return <div className="p-4 md:p-6 max-w-7xl mx-auto">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5"><div><div className="text-xs font-bold uppercase tracking-[.22em] mb-2" style={{color:'#60a5fa'}}>Section X Live Sync</div><h1 className="text-3xl font-bold" style={{fontFamily:'var(--font-display)'}}>Schedule Rescan & Change Detection</h1><p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Re-fetch Arbiter schedules, ignore harmless formatting differences, and surface only real schedule changes.</p></div><Link href="/admin/schedule-audit" className="text-xs font-bold px-3 py-2 rounded-lg" style={{color:'#93c5fd',border:'1px solid rgba(96,165,250,.25)',background:'rgba(59,130,246,.07)'}}>Open Schedule Audit →</Link></div>
    <div className="rounded-xl p-4 mb-5" style={{background:'rgba(59,130,246,.06)',border:'1px solid rgba(59,130,246,.18)'}}><div className="font-bold text-sm" style={{color:'#93c5fd'}}>Safe enough for spring chaos</div><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>Normalization v4 ignores known Arbiter venue noise. Exact matches are reserved before reschedule detection. Scan All is read-only. New games, venue changes, removals and conflicts require explicit review.</div></div>

    <div className="rounded-xl p-4 mb-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"><div><div className="font-bold" style={{fontFamily:'var(--font-display)'}}>Season-wide quick scan</div><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>{knownTeamsForSeason.length} of {seasonTeams.length} active {selectedSeason?.name||'season'} varsity teams have a permanent Arbiter route.</div></div><button className="btn-primary whitespace-nowrap" onClick={scanAllKnown} disabled={batchRunning||knownTeamsForSeason.length===0}>{batchRunning?`Scanning ${batchProgress.current}/${batchProgress.total}...`:`Scan All Active Teams (${knownTeamsForSeason.length})`}</button></div>
      {batchRows.length>0&&<div className="mt-4"><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-3"><Metric label="Clean Teams" value={batchTotals.cleanTeams} good/><Metric label="Safe Updates" value={batchTotals.updates} warn={batchTotals.updates>0}/><Metric label="New Games" value={batchTotals.newGames} warn={batchTotals.newGames>0}/><Metric label="Manual Review" value={batchTotals.review} danger={batchTotals.review>0}/><Metric label="Blocked" value={batchTotals.blocked} danger={batchTotals.blocked>0}/><Metric label="Failed" value={batchTotals.failed} danger={batchTotals.failed>0}/></div><div className="space-y-1 max-h-96 overflow-y-auto">{batchRows.map(row=><div key={row.teamId} className="grid grid-cols-1 md:grid-cols-[1fr_110px_92px_82px_82px_82px_100px] gap-2 rounded-lg px-3 py-2 text-xs items-center" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.05)'}}><div className="font-semibold">{row.teamName} · {row.sportName}</div><div style={{color:row.status==='clean'?'#4ade80':row.status==='changed'?'#fbbf24':row.status==='new'?'#60a5fa':'#f87171'}} className="font-bold uppercase">{row.status}</div><div style={{color:'var(--text-muted)'}}>{row.unchanged} same</div><div style={{color:'var(--text-muted)'}}>{row.updates} update</div><div style={{color:'var(--text-muted)'}}>{row.newGames} new</div><div style={{color:'var(--text-muted)'}}>{row.review} review</div><div>{row.output&&row.status!=='clean'?<button onClick={()=>openBatchReview(row)} className="px-2 py-1.5 rounded-md text-[10px] font-bold uppercase" style={{color:'#93c5fd',border:'1px solid rgba(96,165,250,.25)',background:'rgba(59,130,246,.08)'}}>Review →</button>:<span style={{color:'var(--text-muted)'}}>—</span>}</div>{row.message&&<div className="md:col-span-7" style={{color:'#fca5a5'}}>{row.message}</div>}</div>)}</div></div>}
    </div>

    <div ref={detailRef} className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4 scroll-mt-4"><div><label className="label">Varsity Team</label><select className="input w-full" value={teamId} onChange={e=>{const id=e.target.value;setTeamId(id);const team=seasonTeams.find(t=>t.id===id);setArbiterUrl(teamUrls[id]||(team?.school?.id?schoolUrls[team.school.id]:'')||'');resetResults()}}><option value="">Select active team</option>{seasonTeams.map(team=><option key={team.id} value={team.id}>{team.school?.school_name||team.team_name} — {sportMap.get(team.sport_id)?.sport_name||team.team_name}</option>)}</select></div><div><label className="label">Season</label><select className="input w-full" value={seasonId} onChange={e=>{setSeasonId(e.target.value);setTeamId('');setArbiterUrl('');setBatchRows([]);resetResults()}}>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className="label">Detected Sport</label><div className="input w-full flex items-center" style={{color:selectedSport?'var(--text-primary)':'var(--text-muted)'}}>{selectedSport?.sport_name||'Select a team first'}</div></div></div>
    <div className="mb-4"><label className="label">Arbiter URL</label><div className="flex flex-col md:flex-row gap-2"><input className="input flex-1 font-mono text-sm" placeholder="Team schedule URL or school Teams?entityId= URL" value={arbiterUrl} onChange={e=>{setArbiterUrl(e.target.value);resetResults()}}/><button className="btn-primary whitespace-nowrap" onClick={runScan} disabled={loading||!teamId||!seasonId||!arbiterUrl.trim()}>{loading?'Scanning Arbiter...':result?'Rescan Now':'Scan & Compare'}</button></div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Direct team routes are stored permanently; pasting a URL is only needed for a missing mapping.</div></div>
    {discoveringSchool&&<Notice color="#93c5fd">Remembering this school's published varsity Arbiter team links...</Notice>}
    {mappingMessage&&<Notice color="#93c5fd">{mappingMessage}</Notice>}
    {error&&<Notice color="#f87171">{error}</Notice>}
    {applyMessage&&<Notice color="#4ade80">{applyMessage}</Notice>}

    {result&&<>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4"><Metric label="Fresh Games" value={result.incoming_count}/><Metric label="Unchanged" value={unchangedCount} good/><Metric label="Safe Updates" value={safeUpdateCount} warn={safeUpdateCount>0}/><Metric label="New Games" value={newGameCount} warn={newGameCount>0}/><Metric label="Manual Review" value={manualReviewCount} danger={manualReviewCount>0}/><Metric label="Parsed Rows" value={parsedRows.length}/></div>
      {!applyAllowed&&<div className="rounded-xl p-4 mb-4" style={{color:'#fca5a5',background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.28)'}}><div className="font-black text-sm">SYNC SAFETY LOCK ACTIVE</div><div className="text-xs mt-1">Nothing can be bulk-applied from this scan.</div>{(result.safety_reasons||[]).map(reason=><div key={reason} className="text-xs mt-2">• {reason}</div>)}</div>}
      <div className="rounded-xl p-4 mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3" style={{background:(manualReviewCount||newGameCount)?'rgba(251,191,36,.055)':'rgba(74,222,128,.055)',border:`1px solid ${(manualReviewCount||newGameCount)?'rgba(251,191,36,.2)':'rgba(74,222,128,.2)'}`}}><div><div className="font-bold text-sm" style={{color:(manualReviewCount||newGameCount)?'#fbbf24':'#4ade80'}}>{manualReviewCount||newGameCount?`${newGameCount} new · ${manualReviewCount} review item${manualReviewCount===1?'':'s'}`:'No destructive conflicts detected'}</div><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>Scan source: {scanMeta?.teamName||selectedTeam?.school?.school_name||selectedTeam?.team_name} · {new Date(result.scanned_at).toLocaleString()} · normalization {result.normalization||'v1'}</div></div><button className="btn-primary" onClick={applySafeSync} disabled={applying||result.safe_count===0||!applyAllowed}>{applying?'Applying Safe Sync...':safeUpdateCount>0?`Apply Safe Updates (${safeUpdateCount})`:`Refresh Source Verification (${result.safe_count})`}</button></div>

      <div className="space-y-3">{result.diffs.slice().sort((a,b)=>Number(a.safe)-Number(b.safe)||a.kind.localeCompare(b.kind)).map(diff=>{
        const details=gameDetails(diff.incoming)
        const canAdd=!!diff.incoming&&(diff.kind==='new'||diff.kind==='external_review')
        const canApplyReviewed=!!diff.incoming&&!!diff.existing_game_id&&['date_changed','location_changed','details_changed'].includes(diff.kind)
        return <div key={diff.key} className="rounded-xl p-4" style={{background:'var(--bg-card)',border:`1px solid ${diff.safe?'var(--border)':'rgba(248,113,113,.28)'}`}}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3"><div><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-black tracking-wide" style={{color:kindColor(diff.kind)}}>{kindLabel(diff.kind)}</span>{!diff.safe&&<span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{color:'#fca5a5',background:'rgba(248,113,113,.08)'}}>REVIEW REQUIRED</span>}</div><div className="font-semibold mt-1">{diff.incoming?.game_date||diff.existing?.game_date||'No date'} · {selectedTeam?.school?.school_name||selectedTeam?.team_name}</div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Game ID: {diff.existing_game_id?diff.existing_game_id.slice(0,8):'new record'}</div></div><div className="flex flex-wrap gap-2 items-center">{diff.existing_game_id&&<Link href={`/admin/game-center/${diff.existing_game_id}`} className="text-xs font-bold" style={{color:'#93c5fd'}}>Open Game Center →</Link>}{(canAdd||canApplyReviewed)&&<button onClick={()=>applyOneDiff(diff)} disabled={itemApplying===diff.key} className="px-3 py-2 rounded-lg text-[10px] font-black uppercase" style={{background:'#3156df',color:'white',opacity:itemApplying===diff.key?0.65:1}}>{itemApplying===diff.key?'Working...':canAdd?(diff.kind==='external_review'?'Add External Game':'Add Game'):'Apply This Change'}</button>}</div></div>
          {details&&diff.kind!=='unchanged'&&<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 mt-3"><Detail label="Matchup" value={`${details.away} at ${details.home}`}/><Detail label="Time" value={details.time}/><Detail label="Location" value={details.location}/><Detail label="Status" value={details.status}/></div>}
          {diff.changes.length>0&&<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-3">{diff.changes.map(change=><div key={change.field} className="rounded-lg p-2 text-xs" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.06)'}}><div className="font-bold uppercase tracking-wide mb-1" style={{color:'#fbbf24'}}>{change.field.replaceAll('_',' ')}</div><div style={{color:'var(--text-muted)'}}>Before: <span style={{color:'var(--text-secondary)'}}>{String(change.before??'—')}</span></div><div style={{color:'var(--text-muted)'}}>Fresh: <span style={{color:'#e2e8f0'}}>{String(change.after??'—')}</span></div></div>)}</div>}
          {diff.note&&<div className="text-xs mt-3" style={{color:diff.safe?'var(--text-secondary)':'#fca5a5'}}>{diff.note}</div>}
          {diff.kind==='unchanged'&&<div className="text-xs mt-2" style={{color:'var(--text-muted)'}}>No material schedule fields changed. Time, punctuation and known Arbiter venue-label noise are ignored.</div>}
        </div>
      })}</div>
      <div className="rounded-lg p-4 mt-4 text-xs" style={{background:'rgba(59,130,246,.06)',border:'1px solid rgba(59,130,246,.15)',color:'var(--text-secondary)'}}><strong style={{color:'var(--text-primary)'}}>Safety rule:</strong> Scan All never writes data. Bulk Apply only handles exact-match time/status changes plus source verification. New games, venues, date moves, removals and conflicts require an explicit one-item review.</div>
    </>}
  </div>
}

function Notice({children,color}:{children:React.ReactNode;color:string}){return <div className="rounded-lg p-3 mb-4 text-sm" style={{color,background:'rgba(59,130,246,.06)',border:'1px solid rgba(96,165,250,.16)'}}>{children}</div>}
function Metric({label,value,good=false,warn=false,danger=false}:{label:string;value:number;good?:boolean;warn?:boolean;danger?:boolean}){const color=danger?'#f87171':warn?'#fbbf24':good?'#4ade80':'var(--text-primary)';return <div className="rounded-lg p-3" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}><div className="text-xs mb-1" style={{color:'var(--text-muted)'}}>{label}</div><div className="text-2xl font-bold" style={{fontFamily:'var(--font-display)',color}}>{value}</div></div>}
function Detail({label,value}:{label:string;value:string}){return <div className="rounded-lg p-2 text-xs" style={{background:'rgba(96,165,250,.045)',border:'1px solid rgba(96,165,250,.12)'}}><div className="font-bold uppercase tracking-wide mb-1" style={{color:'#93c5fd'}}>{label}</div><div style={{color:'#e2e8f0'}}>{value}</div></div>}
