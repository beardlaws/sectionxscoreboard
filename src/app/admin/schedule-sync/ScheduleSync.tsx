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
type NewConfidence = 'confirmed'|'single_source'|'cross_source_conflict'|'external'
type DiffRow = {
  key:string
  kind:DiffKind
  safe:boolean
  existing_game_id:string|null
  incoming:any|null
  existing:any|null
  changes:Array<{field:string;before:string|number|boolean|null;after:string|number|boolean|null}>
  note?:string
  new_confidence?:NewConfidence
  cross_source_count?:number
  cross_source_team_ids?:string[]
}
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
type BatchStatus = 'clean'|'updated'|'confirmed'|'new'|'review'|'conflict'|'blocked'|'failed'
type BatchRow = {
  teamId:string
  teamName:string
  sportName:string
  status:BatchStatus
  unchanged:number
  updates:number
  confirmedNew:number
  singleSourceNew:number
  conflicts:number
  review:number
  message?:string
  output?:ScanOutput
}
interface Props { teams:TeamRecord[]; sports:Sport[]; seasons:Season[]; teamSeasons:TeamSeasonRecord[] }

const TEAM_URLS_KEY='sectionx.schedule-sync.team-urls.v2'
const SCHOOL_URLS_KEY='sectionx.schedule-sync.school-urls.v2'

function normalizeSport(value:string|null|undefined){return String(value||'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function schoolUrlFromScheduleUrl(value:string){try{const u=new URL(value);const id=u.searchParams.get('activeEntityId')||u.searchParams.get('entityId');return id?`https://arbiterlive.com/Teams?entityId=${id}`:null}catch{return null}}
function wait(ms:number){return new Promise(resolve=>setTimeout(resolve,ms))}
function formatTime(value:any){const raw=String(value||'').trim();const match=raw.match(/^(\d{1,2}):(\d{2})/);if(!match)return raw||'TBD';let h=Number(match[1]);const m=match[2];const ampm=h>=12?'PM':'AM';h=h%12||12;return `${h}:${m} ${ampm}`}
function pairKey(game:any,sportId:string){if(!game?.home_team_id||!game?.away_team_id)return null;return `${sportId}|${[game.home_team_id,game.away_team_id].sort().join('|')}`}
function datedPairKey(game:any,sportId:string){const pair=pairKey(game,sportId);return pair&&game?.game_date?`${pair}|${game.game_date}`:null}
function diffLabel(diff:DiffRow){
  if(diff.kind==='new'){
    if(diff.new_confidence==='confirmed')return 'CONFIRMED NEW GAME'
    if(diff.new_confidence==='cross_source_conflict')return 'NEW GAME SOURCE CONFLICT'
    return 'SINGLE-SOURCE NEW GAME'
  }
  return ({unchanged:'UNCHANGED',date_changed:'DATE / RESCHEDULE REVIEW',time_changed:'TIME CHANGED',location_changed:'VENUE CHANGE REVIEW',status_changed:'STATUS CHANGED',details_changed:'DETAILS REVIEW',possible_removed:'POSSIBLE REMOVED',external_review:'EXTERNAL GAME REVIEW',conflict:'CONFLICT'} as Record<string,string>)[diff.kind]||diff.kind.toUpperCase()
}
function diffColor(diff:DiffRow){if(diff.kind==='unchanged')return '#4ade80';if(diff.kind==='new'&&diff.new_confidence==='confirmed')return '#4ade80';if(diff.kind==='new'&&diff.new_confidence==='single_source')return '#60a5fa';if(['possible_removed','external_review','conflict'].includes(diff.kind)||diff.new_confidence==='cross_source_conflict')return '#f87171';return '#fbbf24'}
function statusColor(status:BatchStatus){if(status==='clean'||status==='confirmed')return '#4ade80';if(status==='updated')return '#fbbf24';if(status==='new')return '#60a5fa';return '#f87171'}

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
  const [batchApplying,setBatchApplying]=useState(false)
  const [discoveringSchool,setDiscoveringSchool]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [result,setResult]=useState<CompareResult|null>(null)
  const [parsedRows,setParsedRows]=useState<ParsedGameRow[]>([])
  const [scanMeta,setScanMeta]=useState<{teamName?:string|null;rowCount?:number;sourceUrl?:string}|null>(null)
  const [applyMessage,setApplyMessage]=useState<string|null>(null)
  const [mappingMessage,setMappingMessage]=useState<string|null>(null)
  const [batchMessage,setBatchMessage]=useState<string|null>(null)
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

  async function publishForTeam(sourceTeamId:string,games:any[]){const response=await fetch('/api/admin/games',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({games,import_team_id:sourceTeamId,import_source:'arbiter'})});const publish=await response.json();if(!response.ok)throw new Error(publish.error||`Sync apply failed (${response.status})`);return publish}
  async function publishGames(games:any[],message:string){if(!selectedTeam)return;await publishForTeam(selectedTeam.id,games);setApplyMessage(message)}

  async function applySafeSync(){
    if(!result||!selectedTeam||!selectedSeason)return
    if(result.apply_allowed===false){setError('This scan is safety-blocked. Re-scan or review the warnings before applying anything.');return}
    const safe=result.diffs.filter(d=>d.safe&&d.incoming)
    if(!safe.length)return
    const safeUpdates=safe.filter(d=>d.kind!=='unchanged')
    const description=safeUpdates.length?`${safeUpdates.length} high-confidence time/status update${safeUpdates.length===1?'':'s'} plus source verification`:'source verification timestamps only'
    if(!window.confirm(`Apply ${description}?\n\nNew games, venue changes, reschedules, removals and conflicts will NOT be included.`))return
    setApplying(true);setError(null);setApplyMessage(null)
    try{const games=safe.map(diff=>({...(diff.existing_game_id?{id:diff.existing_game_id}:{}),...diff.incoming,season_id:selectedSeason.id,sport_id:selectedTeam.sport_id,source:'arbiter',verification_status:'Reported'}));await publishGames(games,'Safe sync applied. Re-scan now to verify the schedule is clean.')}catch(e:any){setError(e?.message||'Could not apply schedule changes.')}finally{setApplying(false)}
  }

  async function applyOneDiff(diff:DiffRow){
    if(!selectedTeam||!selectedSeason||!diff.incoming)return
    const isNew=diff.kind==='new'||diff.kind==='external_review'
    const crossConflict=diff.new_confidence==='cross_source_conflict'
    const isManualExisting=!!diff.existing_game_id&&['date_changed','location_changed','details_changed'].includes(diff.kind)
    if(crossConflict||(!isNew&&!isManualExisting))return
    const confirmed=diff.kind==='new'&&diff.new_confidence==='confirmed'
    const action=isNew?(confirmed?'add this cross-source confirmed game':'add this fresh game'):'apply this reviewed change'
    if(!window.confirm(`Are you sure you want to ${action}?\n\nThis only affects this one item.`))return
    setItemApplying(diff.key);setError(null);setApplyMessage(null)
    try{const game={...(diff.existing_game_id?{id:diff.existing_game_id}:{}),...diff.incoming,season_id:selectedSeason.id,sport_id:selectedTeam.sport_id,source:'arbiter',verification_status:'Reported'};await publishGames([game],isNew?'Game added. Re-scan the season to confirm both sides now match.':'Reviewed change applied. Re-scan this team to confirm it now matches.')}catch(e:any){setError(e?.message||'Could not apply this item.')}finally{setItemApplying(null)}
  }

  function applyCrossSourceEvidence(rows:BatchRow[]){
    type Evidence={row:BatchRow;diff:DiffRow;sportId:string;sourceTeamId:string;pair:string;date:string}
    const evidence:Evidence[]=[]
    for(const row of rows){const team=teamMap.get(row.teamId);if(!team||!row.output)continue;for(const diff of row.output.comparison.diffs){if(diff.kind!=='new'||!diff.incoming?.home_team_id||!diff.incoming?.away_team_id||!diff.incoming?.game_date)continue;const pair=pairKey(diff.incoming,team.sport_id);if(pair)evidence.push({row,diff,sportId:team.sport_id,sourceTeamId:row.teamId,pair,date:diff.incoming.game_date})}}
    const byPair=new Map<string,Evidence[]>()
    for(const item of evidence){const list=byPair.get(item.pair)||[];list.push(item);byPair.set(item.pair,list)}

    for(const group of byPair.values()){
      const sourceIds=new Set(group.map(x=>x.sourceTeamId))
      const byDate=new Map<string,Evidence[]>()
      for(const item of group){const list=byDate.get(item.date)||[];list.push(item);byDate.set(item.date,list)}
      const confirmedItems=new Set<Evidence>()
      for(const bucket of byDate.values()){
        const bucketSources=new Set(bucket.map(x=>x.sourceTeamId))
        const first=bucket[0]?.diff.incoming
        const participantIds=new Set([first?.home_team_id,first?.away_team_id].filter(Boolean))
        const confirmed=participantIds.size===2&&[...participantIds].every(id=>bucketSources.has(id as string))
        if(confirmed){for(const item of bucket){item.diff.new_confidence='confirmed';item.diff.cross_source_count=bucketSources.size;item.diff.cross_source_team_ids=[...bucketSources];item.diff.note='Both Section X Arbiter schedules independently confirm this missing game on the same date. It is still added explicitly, never by Scan All.';confirmedItems.add(item)}}
      }
      if(sourceIds.size>=2){const unresolved=group.filter(item=>!confirmedItems.has(item));const unresolvedDates=new Set(unresolved.map(x=>x.date));if(unresolved.length>=2&&unresolvedDates.size>=2){for(const item of unresolved){item.diff.new_confidence='cross_source_conflict';item.diff.cross_source_count=sourceIds.size;item.diff.cross_source_team_ids=[...sourceIds];item.diff.note='The two Section X Arbiter sources show this matchup on different dates. Do not add either version until the schools agree.'}}}
    }

    return rows.map(row=>{
      const c=row.output?.comparison
      if(!c)return row
      const diffs=c.diffs
      const confirmedNew=diffs.filter(d=>d.kind==='new'&&d.new_confidence==='confirmed').length
      const conflicts=diffs.filter(d=>d.kind==='conflict'||d.new_confidence==='cross_source_conflict').length
      const singleSourceNew=diffs.filter(d=>(d.kind==='new'&&(!d.new_confidence||d.new_confidence==='single_source'))||d.kind==='external_review').length
      const updates=diffs.filter(d=>d.safe&&d.kind!=='unchanged').length
      const otherReview=diffs.filter(d=>!d.safe&&d.kind!=='new'&&d.kind!=='external_review'&&d.kind!=='conflict').length
      const blocked=c.apply_allowed===false
      const status:BatchStatus=blocked?'blocked':conflicts>0?'conflict':otherReview>0?'review':singleSourceNew>0?'new':confirmedNew>0?'confirmed':updates>0?'updated':'clean'
      return {...row,status,updates,confirmedNew,singleSourceNew,conflicts,review:otherReview}
    })
  }

  async function scanAllKnown(){
    if(!selectedSeason||knownTeamsForSeason.length===0)return
    setBatchRunning(true);setBatchRows([]);setBatchMessage(null);setBatchProgress({current:0,total:knownTeamsForSeason.length})
    const collected:BatchRow[]=[]
    for(let i=0;i<knownTeamsForSeason.length;i+=1){
      const team=knownTeamsForSeason[i];const sport=sportMap.get(team.sport_id);const rawUrl=teamUrls[team.id]||(team.school?.id?schoolUrls[team.school.id]:'')||'';setBatchProgress({current:i+1,total:knownTeamsForSeason.length})
      try{const output=await performScan(team,selectedSeason,rawUrl);rememberDirectMapping(team,output.resolvedUrl);const c=output.comparison;collected.push({teamId:team.id,teamName:team.school?.school_name||team.team_name,sportName:sport?.sport_name||team.team_name,status:c.apply_allowed===false?'blocked':'clean',unchanged:c.counts?.unchanged||0,updates:c.diffs.filter(d=>d.safe&&d.kind!=='unchanged').length,confirmedNew:0,singleSourceNew:c.diffs.filter(d=>d.kind==='new'||d.kind==='external_review').length,conflicts:c.diffs.filter(d=>d.kind==='conflict').length,review:c.diffs.filter(d=>!d.safe&&!['new','external_review','conflict'].includes(d.kind)).length,message:c.apply_allowed===false?(c.safety_reasons||[]).join(' '):undefined,output})}catch(e:any){collected.push({teamId:team.id,teamName:team.school?.school_name||team.team_name,sportName:sport?.sport_name||team.team_name,status:'failed',unchanged:0,updates:0,confirmedNew:0,singleSourceNew:0,conflicts:0,review:0,message:e?.message||'Scan failed'})}
      setBatchRows([...collected]);await wait(250)
    }
    const reconciled=applyCrossSourceEvidence(collected)
    setBatchRows(reconciled);setBatchRunning(false)
  }

  async function applyAllVerifiedUpdates(){
    if(!selectedSeason||batchRunning||batchApplying)return
    const unique=new Map<string,{teamId:string;diff:DiffRow;sportId:string}>()
    for(const row of batchRows){const team=teamMap.get(row.teamId);if(!team||!row.output)continue;for(const diff of row.output.comparison.diffs){if(diff.safe&&diff.kind!=='unchanged'&&diff.incoming&&diff.existing_game_id&&!unique.has(diff.existing_game_id))unique.set(diff.existing_game_id,{teamId:row.teamId,diff,sportId:team.sport_id})}}
    if(!unique.size)return
    if(!window.confirm(`Apply ${unique.size} verified time/status update${unique.size===1?'':'s'} across the season?\n\nThis will NOT add new games, change venues/dates, remove games, or resolve conflicts.`))return
    setBatchApplying(true);setBatchMessage(null);setError(null)
    try{const grouped=new Map<string,any[]>();for(const item of unique.values()){const list=grouped.get(item.teamId)||[];list.push({id:item.diff.existing_game_id,...item.diff.incoming,season_id:selectedSeason.id,sport_id:item.sportId,source:'arbiter',verification_status:'Reported'});grouped.set(item.teamId,list)}for(const [sourceTeamId,games] of grouped){await publishForTeam(sourceTeamId,games)}setBatchMessage(`Applied ${unique.size} verified update${unique.size===1?'':'s'}. Run Scan All again to verify the season.`)}catch(e:any){setError(e?.message||'Could not apply verified season updates.')}finally{setBatchApplying(false)}
  }

  function openBatchReview(row:BatchRow){if(!row.output)return;const team=seasonTeams.find(t=>t.id===row.teamId);setTeamId(row.teamId);setArbiterUrl(row.output.resolvedUrl);setResult({...row.output.comparison,diffs:[...row.output.comparison.diffs]});setParsedRows(row.output.rows);setScanMeta({teamName:row.output.arbiterTeamName,rowCount:row.output.rows.length,sourceUrl:row.output.resolvedUrl});setError(null);setApplyMessage(null);setMappingMessage(team?`Opened ${row.teamName} ${row.sportName} from the season scan. Cross-team evidence is included below.`:null);setTimeout(()=>detailRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),50)}

  function teamLabel(id:string|null|undefined){if(!id)return null;const team=teamMap.get(id);return team?.school?.school_name||team?.team_name||'Section X team'}
  function gameDetails(game:any){if(!game)return null;const home=teamLabel(game.home_team_id)||game.external_home_name||'TBD';const away=teamLabel(game.away_team_id)||game.external_away_name||'TBD';return {home,away,time:formatTime(game.game_time),location:game.location||'TBD',status:game.status||'Scheduled'}}

  const safeUpdateCount=result?result.diffs.filter(d=>d.safe&&d.kind!=='unchanged').length:0
  const confirmedNewCount=result?result.diffs.filter(d=>d.kind==='new'&&d.new_confidence==='confirmed').length:0
  const singleSourceNewCount=result?result.diffs.filter(d=>(d.kind==='new'&&d.new_confidence!=='confirmed'&&d.new_confidence!=='cross_source_conflict')||d.kind==='external_review').length:0
  const crossConflictCount=result?result.diffs.filter(d=>d.kind==='conflict'||d.new_confidence==='cross_source_conflict').length:0
  const unchangedCount=result?.counts?.unchanged||0
  const manualReviewCount=result?result.diffs.filter(d=>!d.safe&&!['new','external_review','conflict'].includes(d.kind)).length:0
  const applyAllowed=result?.apply_allowed!==false

  const confirmedKeys=new Set<string>(), singleKeys=new Set<string>(), conflictKeys=new Set<string>()
  for(const row of batchRows){const team=teamMap.get(row.teamId);if(!team||!row.output)continue;for(const diff of row.output.comparison.diffs){if(diff.kind==='new'&&diff.incoming){const exact=datedPairKey(diff.incoming,team.sport_id);const pair=pairKey(diff.incoming,team.sport_id);if(diff.new_confidence==='confirmed'&&exact)confirmedKeys.add(exact);else if(diff.new_confidence==='cross_source_conflict'&&pair)conflictKeys.add(pair);else if(exact)singleKeys.add(exact)}else if(diff.kind==='external_review')singleKeys.add(`${row.teamId}|external|${diff.incoming?.game_date}|${diff.key}`);else if(diff.kind==='conflict')conflictKeys.add(`${row.teamId}|${diff.existing_game_id||diff.key}`)}}
  const batchTotals=batchRows.reduce((acc,row)=>{if(row.status==='clean')acc.cleanTeams+=1;if(row.status==='blocked')acc.blocked+=1;if(row.status==='failed')acc.failed+=1;acc.updates+=row.updates;acc.review+=row.review;return acc},{cleanTeams:0,updates:0,review:0,blocked:0,failed:0})

  return <div className="p-4 md:p-6 max-w-7xl mx-auto">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5"><div><div className="text-xs font-bold uppercase tracking-[.22em] mb-2" style={{color:'#60a5fa'}}>Section X Live Sync</div><h1 className="text-3xl font-bold" style={{fontFamily:'var(--font-display)'}}>Schedule Rescan & Change Detection</h1><p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Re-fetch Arbiter schedules, compare both sides, and surface only changes that deserve attention.</p></div><Link href="/admin/schedule-audit" className="text-xs font-bold px-3 py-2 rounded-lg" style={{color:'#93c5fd',border:'1px solid rgba(96,165,250,.25)',background:'rgba(59,130,246,.07)'}}>Open Schedule Audit →</Link></div>
    <div className="rounded-xl p-4 mb-5" style={{background:'rgba(59,130,246,.06)',border:'1px solid rgba(59,130,246,.18)'}}><div className="font-bold text-sm" style={{color:'#93c5fd'}}>Live Sync v5: cross-source intelligence</div><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>Venue noise is normalized, exact games are reserved first, and Scan All cross-checks alleged new Section X games against the opponent's fresh Arbiter schedule. Scan All remains read-only.</div></div>

    <div className="rounded-xl p-4 mb-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"><div><div className="font-bold" style={{fontFamily:'var(--font-display)'}}>Season-wide command scan</div><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>{knownTeamsForSeason.length} of {seasonTeams.length} active {selectedSeason?.name||'season'} varsity teams have an Arbiter route.</div></div><div className="flex gap-2 flex-wrap"><button className="btn-primary whitespace-nowrap" onClick={scanAllKnown} disabled={batchRunning||batchApplying||knownTeamsForSeason.length===0}>{batchRunning?`Scanning ${batchProgress.current}/${batchProgress.total}...`:`Scan All Active Teams (${knownTeamsForSeason.length})`}</button>{batchRows.length>0&&batchTotals.updates>0&&<button className="btn-primary whitespace-nowrap" onClick={applyAllVerifiedUpdates} disabled={batchRunning||batchApplying}>{batchApplying?'Applying...':`Apply Verified Updates (${batchTotals.updates})`}</button>}</div></div>
      {batchMessage&&<div className="mt-3 text-xs rounded-lg p-3" style={{color:'#4ade80',background:'rgba(74,222,128,.06)',border:'1px solid rgba(74,222,128,.16)'}}>{batchMessage}</div>}
      {batchRows.length>0&&<div className="mt-4"><div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 mb-3"><Metric label="Clean Teams" value={batchTotals.cleanTeams} good/><Metric label="Safe Updates" value={batchTotals.updates} warn={batchTotals.updates>0}/><Metric label="Confirmed New" value={confirmedKeys.size} good={confirmedKeys.size>0}/><Metric label="Single Source" value={singleKeys.size} warn={singleKeys.size>0}/><Metric label="Source Conflicts" value={conflictKeys.size} danger={conflictKeys.size>0}/><Metric label="Other Review" value={batchTotals.review} danger={batchTotals.review>0}/><Metric label="Blocked" value={batchTotals.blocked} danger={batchTotals.blocked>0}/><Metric label="Failed" value={batchTotals.failed} danger={batchTotals.failed>0}/></div><div className="text-[11px] mb-3" style={{color:'var(--text-muted)'}}>Confirmed New means both Section X Arbiter schedules independently list the same matchup on the same date. Single Source means only one side currently shows it. Source Conflicts mean the two sides disagree.</div><div className="space-y-1 max-h-96 overflow-y-auto">{batchRows.map(row=><div key={row.teamId} className="grid grid-cols-1 md:grid-cols-[1fr_95px_68px_68px_68px_68px_68px_92px] gap-2 rounded-lg px-3 py-2 text-xs items-center" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.05)'}}><div className="font-semibold">{row.teamName} · {row.sportName}</div><div style={{color:statusColor(row.status)}} className="font-bold uppercase">{row.status}</div><div style={{color:'var(--text-muted)'}}>{row.unchanged} same</div><div style={{color:'var(--text-muted)'}}>{row.updates} upd</div><div style={{color:'#4ade80'}}>{row.confirmedNew} conf</div><div style={{color:'#60a5fa'}}>{row.singleSourceNew} single</div><div style={{color:row.conflicts?'#f87171':'var(--text-muted)'}}>{row.conflicts+row.review} review</div><div>{row.output&&row.status!=='clean'?<button onClick={()=>openBatchReview(row)} className="px-2 py-1.5 rounded-md text-[10px] font-bold uppercase" style={{color:'#93c5fd',border:'1px solid rgba(96,165,250,.25)',background:'rgba(59,130,246,.08)'}}>Review →</button>:<span style={{color:'var(--text-muted)'}}>—</span>}</div>{row.message&&<div className="md:col-span-8" style={{color:'#fca5a5'}}>{row.message}</div>}</div>)}</div></div>}
    </div>

    <div ref={detailRef} className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4 scroll-mt-4"><div><label className="label">Varsity Team</label><select className="input w-full" value={teamId} onChange={e=>{const id=e.target.value;setTeamId(id);const team=seasonTeams.find(t=>t.id===id);setArbiterUrl(teamUrls[id]||(team?.school?.id?schoolUrls[team.school.id]:'')||'');resetResults()}}><option value="">Select active team</option>{seasonTeams.map(team=><option key={team.id} value={team.id}>{team.school?.school_name||team.team_name} — {sportMap.get(team.sport_id)?.sport_name||team.team_name}</option>)}</select></div><div><label className="label">Season</label><select className="input w-full" value={seasonId} onChange={e=>{setSeasonId(e.target.value);setTeamId('');setArbiterUrl('');setBatchRows([]);setBatchMessage(null);resetResults()}}>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className="label">Detected Sport</label><div className="input w-full flex items-center" style={{color:selectedSport?'var(--text-primary)':'var(--text-muted)'}}>{selectedSport?.sport_name||'Select a team first'}</div></div></div>
    <div className="mb-4"><label className="label">Arbiter URL</label><div className="flex flex-col md:flex-row gap-2"><input className="input flex-1 font-mono text-sm" placeholder="Team schedule URL or school Teams?entityId= URL" value={arbiterUrl} onChange={e=>{setArbiterUrl(e.target.value);resetResults()}}/><button className="btn-primary whitespace-nowrap" onClick={runScan} disabled={loading||!teamId||!seasonId||!arbiterUrl.trim()}>{loading?'Scanning Arbiter...':result?'Rescan Now':'Scan & Compare'}</button></div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Direct team routes are stored permanently; pasting a URL is only needed for a missing mapping.</div></div>
    {discoveringSchool&&<Notice color="#93c5fd">Remembering this school's published varsity Arbiter team links...</Notice>}
    {mappingMessage&&<Notice color="#93c5fd">{mappingMessage}</Notice>}
    {error&&<Notice color="#f87171">{error}</Notice>}
    {applyMessage&&<Notice color="#4ade80">{applyMessage}</Notice>}

    {result&&<>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-4"><Metric label="Fresh Games" value={result.incoming_count}/><Metric label="Unchanged" value={unchangedCount} good/><Metric label="Safe Updates" value={safeUpdateCount} warn={safeUpdateCount>0}/><Metric label="Confirmed New" value={confirmedNewCount} good={confirmedNewCount>0}/><Metric label="Single Source" value={singleSourceNewCount} warn={singleSourceNewCount>0}/><Metric label="Source Conflict" value={crossConflictCount} danger={crossConflictCount>0}/><Metric label="Other Review" value={manualReviewCount} danger={manualReviewCount>0}/><Metric label="Parsed Rows" value={parsedRows.length}/></div>
      {!applyAllowed&&<div className="rounded-xl p-4 mb-4" style={{color:'#fca5a5',background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.28)'}}><div className="font-black text-sm">SYNC SAFETY LOCK ACTIVE</div><div className="text-xs mt-1">Nothing can be bulk-applied from this scan.</div>{(result.safety_reasons||[]).map(reason=><div key={reason} className="text-xs mt-2">• {reason}</div>)}</div>}
      <div className="rounded-xl p-4 mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3" style={{background:(manualReviewCount||singleSourceNewCount||crossConflictCount)?'rgba(251,191,36,.055)':'rgba(74,222,128,.055)',border:`1px solid ${(manualReviewCount||singleSourceNewCount||crossConflictCount)?'rgba(251,191,36,.2)':'rgba(74,222,128,.2)'}`}}><div><div className="font-bold text-sm" style={{color:(manualReviewCount||singleSourceNewCount||crossConflictCount)?'#fbbf24':'#4ade80'}}>{confirmedNewCount} confirmed new · {singleSourceNewCount} single source · {crossConflictCount+manualReviewCount} review</div><div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>Scan source: {scanMeta?.teamName||selectedTeam?.school?.school_name||selectedTeam?.team_name} · {new Date(result.scanned_at).toLocaleString()} · normalization {result.normalization||'v1'}</div></div><button className="btn-primary" onClick={applySafeSync} disabled={applying||result.safe_count===0||!applyAllowed}>{applying?'Applying Safe Sync...':safeUpdateCount>0?`Apply Safe Updates (${safeUpdateCount})`:`Refresh Source Verification (${result.safe_count})`}</button></div>

      <div className="space-y-3">{result.diffs.slice().sort((a,b)=>Number(a.safe)-Number(b.safe)||a.kind.localeCompare(b.kind)).map(diff=>{
        const details=gameDetails(diff.incoming)
        const crossConflict=diff.new_confidence==='cross_source_conflict'
        const canAdd=!!diff.incoming&&!crossConflict&&(diff.kind==='new'||diff.kind==='external_review')
        const canApplyReviewed=!!diff.incoming&&!!diff.existing_game_id&&['date_changed','location_changed','details_changed'].includes(diff.kind)
        const confirmed=diff.kind==='new'&&diff.new_confidence==='confirmed'
        return <div key={diff.key} className="rounded-xl p-4" style={{background:'var(--bg-card)',border:`1px solid ${diff.safe?'var(--border)':confirmed?'rgba(74,222,128,.3)':'rgba(248,113,113,.28)'}`}}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3"><div><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-black tracking-wide" style={{color:diffColor(diff)}}>{diffLabel(diff)}</span>{confirmed&&<span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{color:'#86efac',background:'rgba(74,222,128,.09)'}}>2-SOURCE CONFIRMED</span>}{!diff.safe&&!confirmed&&<span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{color:'#fca5a5',background:'rgba(248,113,113,.08)'}}>REVIEW REQUIRED</span>}</div><div className="font-semibold mt-1">{diff.incoming?.game_date||diff.existing?.game_date||'No date'} · {selectedTeam?.school?.school_name||selectedTeam?.team_name}</div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Game ID: {diff.existing_game_id?diff.existing_game_id.slice(0,8):'new record'}</div></div><div className="flex flex-wrap gap-2 items-center">{diff.existing_game_id&&<Link href={`/admin/game-center/${diff.existing_game_id}`} className="text-xs font-bold" style={{color:'#93c5fd'}}>Open Game Center →</Link>}{(canAdd||canApplyReviewed)&&<button onClick={()=>applyOneDiff(diff)} disabled={itemApplying===diff.key} className="px-3 py-2 rounded-lg text-[10px] font-black uppercase" style={{background:confirmed?'#16834a':'#3156df',color:'white',opacity:itemApplying===diff.key?0.65:1}}>{itemApplying===diff.key?'Working...':canAdd?(confirmed?'Add Confirmed Game':diff.kind==='external_review'?'Add External Game':'Add Game'):'Apply This Change'}</button>}</div></div>
          {details&&diff.kind!=='unchanged'&&<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 mt-3"><Detail label="Matchup" value={`${details.away} at ${details.home}`}/><Detail label="Time" value={details.time}/><Detail label="Location" value={details.location}/><Detail label="Status" value={details.status}/></div>}
          {diff.changes.length>0&&<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-3">{diff.changes.map(change=><div key={change.field} className="rounded-lg p-2 text-xs" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.06)'}}><div className="font-bold uppercase tracking-wide mb-1" style={{color:'#fbbf24'}}>{change.field.replaceAll('_',' ')}</div><div style={{color:'var(--text-muted)'}}>Before: <span style={{color:'var(--text-secondary)'}}>{String(change.before??'—')}</span></div><div style={{color:'var(--text-muted)'}}>Fresh: <span style={{color:'#e2e8f0'}}>{String(change.after??'—')}</span></div></div>)}</div>}
          {diff.note&&<div className="text-xs mt-3" style={{color:confirmed?'#86efac':diff.safe?'var(--text-secondary)':'#fca5a5'}}>{diff.note}</div>}
          {diff.kind==='unchanged'&&<div className="text-xs mt-2" style={{color:'var(--text-muted)'}}>No material schedule fields changed. Time formatting, punctuation and known Arbiter venue-label noise are ignored.</div>}
        </div>
      })}</div>
      <div className="rounded-lg p-4 mt-4 text-xs" style={{background:'rgba(59,130,246,.06)',border:'1px solid rgba(59,130,246,.15)',color:'var(--text-secondary)'}}><strong style={{color:'var(--text-primary)'}}>Safety rule:</strong> Scan All never writes data. Bulk Apply handles only exact-match time/status changes. Confirmed new games still require an explicit Add Confirmed Game click. Single-source games, venue/date changes, removals and source conflicts always require review.</div>
    </>}
  </div>
}

function Notice({children,color}:{children:React.ReactNode;color:string}){return <div className="rounded-lg p-3 mb-4 text-sm" style={{color,background:'rgba(59,130,246,.06)',border:'1px solid rgba(96,165,250,.16)'}}>{children}</div>}
function Metric({label,value,good=false,warn=false,danger=false}:{label:string;value:number;good?:boolean;warn?:boolean;danger?:boolean}){const color=danger?'#f87171':warn?'#fbbf24':good?'#4ade80':'var(--text-primary)';return <div className="rounded-lg p-3" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}><div className="text-xs mb-1" style={{color:'var(--text-muted)'}}>{label}</div><div className="text-2xl font-bold" style={{fontFamily:'var(--font-display)',color}}>{value}</div></div>}
function Detail({label,value}:{label:string;value:string}){return <div className="rounded-lg p-2 text-xs" style={{background:'rgba(96,165,250,.045)',border:'1px solid rgba(96,165,250,.12)'}}><div className="font-bold uppercase tracking-wide mb-1" style={{color:'#93c5fd'}}>{label}</div><div style={{color:'#e2e8f0'}}>{value}</div></div>}
