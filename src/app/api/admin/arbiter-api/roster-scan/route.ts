import { NextRequest, NextResponse } from 'next/server'
import { arbiterApi } from '@/lib/arbiter/client'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic='force-dynamic'
export const maxDuration=300

const clean=(v:unknown)=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const val=(o:any,...keys:string[])=>{for(const k of keys){if(o&&o[k]!==undefined&&o[k]!==null)return o[k]}return null}
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):null
const text=(v:any)=>String(v??'').replace(/\s+/g,' ').trim()
const nested=(o:any,...paths:string[])=>{for(const p of paths){let cur=o;for(const part of p.split('.'))cur=cur?.[part];if(cur!==undefined&&cur!==null&&cur!=='')return cur}return null}
const arr=(v:any):any[]=>Array.isArray(v)?v:v==null?[]:[v]

function findNamedArray(root:any,names:string[]){
  const wanted=new Set(names.map(clean)),seen=new Set<any>(),q=[root]
  while(q.length){const cur=q.shift();if(!cur||typeof cur!=='object'||seen.has(cur))continue;seen.add(cur);for(const [k,v] of Object.entries(cur)){if(wanted.has(clean(k))&&Array.isArray(v))return v as any[];if(v&&typeof v==='object')q.push(v)}}
  return null
}
function responseShape(root:any){if(root==null)return'null';if(Array.isArray(root))return`array:${root.length}`;if(typeof root!=='object')return typeof root;return`object:${Object.keys(root).slice(0,12).join(',')}`}
function candidateTeam(raw:any,schoolId:number){return{
  raw,
  teamId:num(val(raw,'teamId','teamID','TeamId','TeamID','id','Id','ID')??nested(raw,'team.id','team.teamId','team.teamID')),
  schoolId:num(val(raw,'schoolId','schoolID','SchoolId','SchoolID')??nested(raw,'school.id','school.schoolId'))??schoolId,
  teamName:text(val(raw,'teamName','TeamName','name','Name','title','Title','teamTitle','TeamTitle')??nested(raw,'team.name','team.teamName','team.title')),
  sportId:num(val(raw,'genericSportId','genericSportID','GenericSportId','GenericSportID','sportId','sportID','SportId','SportID')??nested(raw,'genericSport.id','genericSport.sportId','sport.id','sport.sportId')),
  levelId:num(val(raw,'levelId','levelID','LevelId','LevelID')??nested(raw,'level.id','level.levelId')),
  sportName:text(val(raw,'sportName','SportName','genericSportName','GenericSportName','sport')??nested(raw,'sport.name','genericSport.name','genericSport.sportName')),
  gender:text(val(raw,'gender','Gender','genderName','GenderName')??nested(raw,'gender.name','gender.description')),
  level:text(val(raw,'levelName','LevelName','level','Level','levelDescription','LevelDescription')??nested(raw,'level.name','level.levelName','level.description')),
}}
function looksLikeTeamObject(raw:any){if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;const c=candidateTeam(raw,0);return Boolean(c.teamId&&(c.teamName||c.sportName||c.sportId||c.level||c.levelId))}
function extractTeamCandidates(root:any,schoolId:number){
  const out:any[]=[],seenObj=new Set<any>(),q=[root]
  while(q.length){const cur=q.shift();if(!cur||typeof cur!=='object'||seenObj.has(cur))continue;seenObj.add(cur);if(Array.isArray(cur)){for(const item of cur)q.push(item);continue}if(looksLikeTeamObject(cur))out.push(candidateTeam(cur,schoolId));for(const v of Object.values(cur))if(v&&typeof v==='object')q.push(v)}
  const byId=new Map<number,any>();for(const c of out)if(c.teamId&&!byId.has(c.teamId))byId.set(c.teamId,c);return[...byId.values()]
}
function extractReferences(root:any,kind:'sport'|'level'){
  const rows:any[]=[],seen=new Set<any>(),q=[root]
  while(q.length){const cur=q.shift();if(!cur||typeof cur!=='object'||seen.has(cur))continue;seen.add(cur);if(Array.isArray(cur)){for(const x of cur)q.push(x);continue};const id=kind==='sport'?num(val(cur,'genericSportId','genericSportID','GenericSportId','GenericSportID','sportId','sportID','SportId','SportID','id','Id','ID')):num(val(cur,'levelId','levelID','LevelId','LevelID','id','Id','ID'));const name=kind==='sport'?text(val(cur,'genericSportName','GenericSportName','sportName','SportName','name','Name','description','Description')):text(val(cur,'levelName','LevelName','name','Name','description','Description'));if(id!==null&&name)rows.push({id,name});for(const v of Object.values(cur))if(v&&typeof v==='object')q.push(v)}
  const map=new Map<number,string>();for(const r of rows)if(!map.has(r.id))map.set(r.id,r.name);return map
}
function normalizeSport(v:unknown){return clean(v).replace(/girls|boys|mens|womens|male|female/g,'').replace(/association football/g,'soccer').replace(/crosscountry/g,'cross country').replace(/volley ball/g,'volleyball').replace(/\s+/g,' ').trim()}
function sportEquivalent(a:unknown,b:unknown){const x=normalizeSport(a),y=normalizeSport(b);return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)))}
function genderCompatibleValue(candidate:unknown,target:unknown,teamName:unknown=''){const dg=clean(target),cg=clean(candidate),cn=clean(teamName);if(!dg)return true;if(cg)return cg===dg||cg.startsWith(dg)||dg.startsWith(cg);if(cn.includes('boys')||cn.includes('mens'))return dg.includes('boy')||dg.includes('men')||dg.includes('male');if(cn.includes('girls')||cn.includes('womens'))return dg.includes('girl')||dg.includes('women')||dg.includes('female');return true}
function varsityLevel(v:unknown){const c=clean(v);return c.includes('varsity')&&!c.includes('junior')}
function seasonWindow(season:any){const type=clean(season.season_type),year=Number(season.year);if(type==='winter')return{start:`${year}-11-01T00:00:00.000Z`,end:`${year+1}-03-31T23:59:59.999Z`};if(type==='spring')return{start:`${year}-03-01T00:00:00.000Z`,end:`${year}-06-30T23:59:59.999Z`};return{start:`${year}-08-01T00:00:00.000Z`,end:`${year}-11-30T23:59:59.999Z`}}
function fullName(p:any){return text(val(p,'displayName','fullName','name'))||text([val(p,'firstName','first_name'),val(p,'lastName','last_name')].filter(Boolean).join(' '))}
function normalizePlayer(p:any){const displayName=fullName(p);return{jerseyNumber:text(val(p,'jerseyNumber','jersey','number')),rawName:displayName,displayName,firstName:text(val(p,'firstName','first_name')),lastName:text(val(p,'lastName','last_name')),classYear:text(val(p,'classYear','class','grade','graduationYear')),position:text(val(p,'position','positionName')),height:text(val(p,'height'))}}
function normalizeCoach(p:any){const displayName=fullName(p);return{rawName:displayName,displayName,firstName:text(val(p,'firstName','first_name')),lastName:text(val(p,'lastName','last_name')),title:text(val(p,'title','role','position'))}}

async function fetchSchoolTeams(sid:number,sportNames:Map<number,string>,levelNames:Map<number,string>){
  const attempts:[string,any][]=[['SchoolId',{SchoolId:sid}],['schoolId',{schoolId:sid}],['SchoolIDs',{SchoolIDs:[sid]}],['SchoolIds',{SchoolIds:[sid]}]],diagnostics:any[]=[]
  for(const [variant,query] of attempts){try{const raw=await arbiterApi.teams(query),teams=extractTeamCandidates(raw,sid).map(c=>({...c,sportName:c.sportName||sportNames.get(c.sportId)||'',level:c.level||levelNames.get(c.levelId)||''}));diagnostics.push({variant,shape:responseShape(raw),teamsFound:teams.length});if(teams.length)return{teams,diagnostics,error:null}}catch(error){diagnostics.push({variant,error:error instanceof Error?error.message:String(error),teamsFound:0})}}
  return{teams:[],diagnostics,error:diagnostics.every(d=>d.error)?'All GetTeams query variants failed.':null}
}
function scheduleObservations(raw:any){
  const observations:any[]=[]
  for(const game of arr(raw)){
    const sportName=text(game?.sportName),gender=text(game?.gender),level=text(game?.levelName)
    if(!varsityLevel(level))continue
    for(const t of arr(game?.teams)){
      const teamId=num(t?.teamId),schoolId=num(t?.schoolId)
      if(!teamId||!schoolId)continue
      observations.push({teamId,schoolId,teamName:text(t?.teamName),schoolName:text(t?.schoolName),sportName,gender,level,gameId:num(game?.uniqueGameId)})
    }
  }
  return observations
}

export async function GET(req:NextRequest){
  const db=createAdminClient()
  try{
    const seasonId=req.nextUrl.searchParams.get('seasonId')
    const requestedOffset=Math.max(0,Number(req.nextUrl.searchParams.get('teamOffset')||0)||0)
    const rawLimit=req.nextUrl.searchParams.get('teamLimit')
    const requestedLimit=rawLimit===null?null:Math.max(1,Math.min(20,Number(rawLimit)||8))
    let season:any=null
    if(seasonId){const {data,error}=await db.from('seasons').select('id,name,season_type,year,is_active').eq('id',seasonId).single();if(error)throw new Error(error.message);season=data}else{const {data,error}=await db.from('seasons').select('id,name,season_type,year,is_active').eq('is_active',true).single();if(error)throw new Error(error.message);season=data}
    const [{data:schools,error:se},{data:teams,error:te},{data:sports,error:spe},{data:teamSeasons,error:tse},{data:existingRosters,error:re},arbiterSportsRaw,arbiterLevelsRaw]=await Promise.all([
      db.from('schools').select('id,school_name,arbiter_entity_id').eq('active',true).not('arbiter_entity_id','is',null),
      db.from('teams').select('id,school_id,sport_id,team_name,level,active').eq('active',true),
      db.from('sports').select('id,sport_name,gender,season_type,slug'),
      db.from('team_seasons').select('team_id,season_id,active_for_season').eq('season_id',season.id).eq('active_for_season',true),
      db.from('roster_entries').select('team_id,season_id,active').eq('season_id',season.id).eq('active',true),
      arbiterApi.sports().catch(()=>null),arbiterApi.levels().catch(()=>null),
    ])
    const err=se||te||spe||tse||re;if(err)throw new Error(err.message)
    const arbiterSportNames=extractReferences(arbiterSportsRaw,'sport'),arbiterLevelNames=extractReferences(arbiterLevelsRaw,'level')
    const schoolById=new Map((schools||[]).map((s:any)=>[s.id,s])),sportById=new Map((sports||[]).map((s:any)=>[s.id,s])),activeIds=new Set((teamSeasons||[]).map((x:any)=>x.team_id)),rosterCount=new Map<string,number>()
    for(const r of existingRosters||[])rosterCount.set(r.team_id,(rosterCount.get(r.team_id)||0)+1)
    const allVarsity=(teams||[]).filter((t:any)=>activeIds.has(t.id)&&varsityLevel(t.level)).sort((a:any,b:any)=>String(a.id).localeCompare(String(b.id)))
    const effectiveLimit=requestedLimit??Math.max(allVarsity.length,1)
    const varsity=allVarsity.slice(requestedOffset,requestedOffset+effectiveLimit)
    const batchSchoolIds=[...new Set(varstiySchoolIds(varstiySchools(varstiy,schoolById)))]
    const batchSchools=(schools||[]).filter((s:any)=>batchSchoolIds.includes(Number(s.arbiter_entity_id)))
    const window=seasonWindow(season)
    const gameRaw=batchSchoolIds.length?await arbiterApi.games({SchoolIds:batchSchoolIds,DateFilter:'Range',GameStartDate:window.start,GameEndDate:window.end,IncludeDeletedGames:false,IncludePendingInformation:false}).catch(()=>null):null
    const observations=scheduleObservations(gameRaw)
    const arbiterTeamsBySchool=new Map<number,any[]>(),schoolDiagnostics=new Map<number,any>()
    for(let i=0;i<batchSchools.length;i+=6){const batch=batchSchools.slice(i,i+6),fetched=await Promise.all(batch.map(async(s:any)=>{const sid=Number(s.arbiter_entity_id),result=await fetchSchoolTeams(sid,arbiterSportNames,arbiterLevelNames);return{s,sid,result}}));for(const f of fetched){arbiterTeamsBySchool.set(f.sid,f.result.teams);schoolDiagnostics.set(f.sid,{school:f.s.school_name,schoolId:f.sid,...f.result})}}

    const matches:any[]=[]
    for(const team of varsity){
      const school=schoolById.get(team.school_id) as any,sport=sportById.get(team.sport_id) as any,sid=Number(school?.arbiter_entity_id)
      const observed=observations.filter(o=>o.schoolId===sid&&sportEquivalent(o.sportName,sport?.sport_name)&&genderCompatibleValue(o.gender,sport?.gender,o.teamName)&&varsityLevel(o.level))
      const observedById=new Map<number,any>();for(const o of observed)if(!observedById.has(o.teamId))observedById.set(o.teamId,o)
      let best:any=null,ambiguous=false,reason='matched-by-schedule'
      if(observedById.size===1)best={...[...observedById.values()][0],identitySource:'schedule-observation'}
      else if(observedById.size>1){ambiguous=true;reason='multiple-schedule-team-ids'}
      else{
        const allCandidates=arbiterTeamsBySchool.get(sid)||[]
        const compatible=allCandidates.filter((c:any)=>c.teamId&&sportEquivalent(c.sportName||c.teamName,sport?.sport_name)&&genderCompatibleValue(c.gender,sport?.gender,c.teamName)&&(varsityLevel(c.level)||c.levelId===1||!c.level)).map((c:any)=>({...c,identitySource:'team-endpoint'}))
        if(compatible.length===1){best=compatible[0];reason='matched-by-team-endpoint'}else if(compatible.length>1){ambiguous=true;reason='ambiguous-team-endpoint'}else reason=allCandidates.length?'no-compatible-team-endpoint-match':'arbiter-no-teams-returned'
      }
      const allCandidates=arbiterTeamsBySchool.get(sid)||[]
      matches.push({team,school,sport,best,ambiguous,reason,existingRosterCount:rosterCount.get(team.id)||0,arbiterCandidateCount:allCandidates.length,observedTeamIds:[...observedById.keys()],candidates:(best?[best]:allCandidates.slice(0,5))})
    }

    const importPayloads:any[]=[],rows:any[]=[],matched=matches.filter(m=>m.best)
    for(let i=0;i<matched.length;i+=5){
      const batch=matched.slice(i,i+5),fetched=await Promise.all(batch.map(async m=>{try{return{m,payload:await arbiterApi.teamWithRoster(m.best.teamId,Number(m.school.arbiter_entity_id)),error:null}}catch(error){return{m,payload:null,error:error instanceof Error?error.message:String(error)}}}))
      for(const f of fetched){
        const playersRaw=findNamedArray(f.payload,['roster','rosters','players','athletes','studentAthletes']),coachesRaw=findNamedArray(f.payload,['coaches','coachingStaff','staff']),roster=(playersRaw||[]).map(normalizePlayer).filter(p=>p.displayName),coaches=(coachesRaw||[]).map(normalizeCoach).filter(p=>p.displayName),rosterFound=playersRaw!==null,coachesFound=coachesRaw!==null,normalized={team_id:f.m.team.id,season_id:season.id,source_url:null,roster_found:rosterFound,coaches_found:coachesFound,roster,coaches}
        if(rosterFound||coachesFound)importPayloads.push(normalized)
        rows.push({teamId:f.m.team.id,teamName:f.m.team.team_name,school:f.m.school.school_name,sport:f.m.sport?.sport_name,gender:f.m.sport?.gender,arbiterTeamId:f.m.best.teamId,arbiterTeamName:f.m.best.teamName,identitySource:f.m.best.identitySource,existingRosterCount:f.m.existingRosterCount,rosterFound,rosterCount:roster.length,coachesFound,coachCount:coaches.length,error:f.error,status:f.error?'roster-fetch-error':rosterFound?'available':'no-roster-published',diagnosticReason:f.error?'roster-fetch-error':rosterFound?'published-roster-found':'team-matched-roster-not-published'})
      }
    }
    for(const m of matches.filter(m=>!m.best))rows.push({teamId:m.team.id,teamName:m.team.team_name,school:m.school?.school_name,sport:m.sport?.sport_name,gender:m.sport?.gender,arbiterTeamId:null,existingRosterCount:m.existingRosterCount,rosterFound:false,rosterCount:0,coachesFound:false,coachCount:0,status:m.ambiguous?'ambiguous-team-match':m.reason==='arbiter-no-teams-returned'?'arbiter-no-teams':'team-not-matched',diagnosticReason:m.reason,arbiterCandidateCount:m.arbiterCandidateCount,observedTeamIds:m.observedTeamIds,candidates:m.candidates.map((c:any)=>({teamId:c.teamId,teamName:c.teamName,sportName:c.sportName,gender:c.gender,level:c.level,identitySource:c.identitySource||'team-endpoint'}))})
    rows.sort((a,b)=>String(a.school).localeCompare(String(b.school))||String(a.sport).localeCompare(String(b.sport)))
    const processed=rows.length,nextOffset=Math.min(allVarsity.length,requestedOffset+processed),hasMore=nextOffset<allVarsity.length
    const counts={teams:rows.length,totalVarsity:allVarsity.length,batchOffset:requestedOffset,batchLimit:effectiveLimit,processed,nextOffset,hasMore,available:rows.filter(r=>r.status==='available').length,noRosterPublished:rows.filter(r=>r.status==='no-roster-published').length,arbiterNoTeams:rows.filter(r=>r.status==='arbiter-no-teams').length,teamNotFound:rows.filter(r=>r.status==='team-not-matched').length,ambiguous:rows.filter(r=>r.status==='ambiguous-team-match').length,errors:rows.filter(r=>r.status==='roster-fetch-error').length,alreadyLoaded:rows.filter(r=>r.existingRosterCount>0).length,importPayloads:importPayloads.length,matchedBySchedule:rows.filter(r=>r.identitySource==='schedule-observation').length,matchedByTeamEndpoint:rows.filter(r=>r.identitySource==='team-endpoint').length}
    const diagnostics={scheduleObservations:observations.length,uniqueObservedTeamIds:new Set(observations.map(o=>o.teamId)).size,arbiterReferenceData:{sports:[...arbiterSportNames.entries()].map(([id,name])=>({id,name})),levels:[...arbiterLevelNames.entries()].map(([id,name])=>({id,name}))},schools:batchSchools.map((s:any)=>{const d=schoolDiagnostics.get(Number(s.arbiter_entity_id));return{school:s.school_name,arbiterSchoolId:Number(s.arbiter_entity_id),teamsFound:d?.teams?.length||0,attempts:d?.diagnostics||[],error:d?.error||null}}),schoolsWithTeams:[...schoolDiagnostics.values()].filter((d:any)=>d.teams?.length).length,schoolsWithoutTeams:[...schoolDiagnostics.values()].filter((d:any)=>!d.teams?.length).length,totalArbiterTeams:[...arbiterTeamsBySchool.values()].reduce((n,a)=>n+a.length,0)}
    return NextResponse.json({ok:true,readOnly:true,season,counts,rows,importPayloads,diagnostics})
  }catch(error){console.error('Partner API roster scan failed:',error);return NextResponse.json({ok:false,readOnly:true,error:error instanceof Error?error.message:'Unknown error'},{status:500})}
}

function varstiySchools(teams:any[],schoolById:Map<any,any>){return teams.map((t:any)=>schoolById.get(t.school_id)).filter(Boolean)}
function varstiySchoolIds(schools:any[]){return schools.map((s:any)=>Number(s.arbiter_entity_id)).filter(Number.isFinite)}
