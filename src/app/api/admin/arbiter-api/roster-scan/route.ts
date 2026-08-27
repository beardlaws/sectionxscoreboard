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

function findNamedArray(root:any,names:string[]){
  const wanted=new Set(names.map(clean)),seen=new Set<any>(),q=[root]
  while(q.length){const cur=q.shift();if(!cur||typeof cur!=='object'||seen.has(cur))continue;seen.add(cur);for(const [k,v] of Object.entries(cur)){if(wanted.has(clean(k))&&Array.isArray(v))return v as any[];if(v&&typeof v==='object')q.push(v)}}
  return null
}
function responseShape(root:any){
  if(root==null)return'null'
  if(Array.isArray(root))return`array:${root.length}`
  if(typeof root!=='object')return typeof root
  return`object:${Object.keys(root).slice(0,12).join(',')}`
}
function candidateTeam(raw:any,schoolId:number){
  return{
    raw,
    teamId:num(val(raw,'teamId','teamID','TeamId','TeamID','id','Id','ID')??nested(raw,'team.id','team.teamId','team.teamID')),
    schoolId:num(val(raw,'schoolId','schoolID','SchoolId','SchoolID')??nested(raw,'school.id','school.schoolId'))??schoolId,
    teamName:text(val(raw,'teamName','TeamName','name','Name','team')??nested(raw,'team.name','team.teamName')),
    sportName:text(val(raw,'sportName','SportName','genericSportName','GenericSportName','sport')??nested(raw,'sport.name','genericSport.name','genericSport.sportName')),
    gender:text(val(raw,'gender','Gender','genderName','GenderName')??nested(raw,'gender.name','gender.description')),
    level:text(val(raw,'levelName','LevelName','level','Level','levelDescription','LevelDescription')??nested(raw,'level.name','level.levelName','level.description')),
  }
}
function looksLikeTeamObject(raw:any){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false
  const c=candidateTeam(raw,0)
  return Boolean(c.teamId&&(c.teamName||c.sportName||c.level))
}
function extractTeamCandidates(root:any,schoolId:number){
  const out:any[]=[],seenObj=new Set<any>(),q=[root]
  while(q.length){
    const cur=q.shift()
    if(!cur||typeof cur!=='object'||seenObj.has(cur))continue
    seenObj.add(cur)
    if(Array.isArray(cur)){for(const item of cur)q.push(item);continue}
    if(looksLikeTeamObject(cur))out.push(candidateTeam(cur,schoolId))
    for(const v of Object.values(cur))if(v&&typeof v==='object')q.push(v)
  }
  const byId=new Map<number,any>()
  for(const c of out)if(c.teamId&&!byId.has(c.teamId))byId.set(c.teamId,c)
  return[...byId.values()]
}
function sportScore(c:any,s:any){
  const cs=clean(c.sportName),cn=clean(c.teamName),ds=clean(s?.sport_name),dg=clean(s?.gender),cg=clean(c.gender),cl=clean(c.level)
  let score=0
  if(cs&&ds&&(cs===ds||cs.includes(ds)||ds.includes(cs)))score+=4
  if(ds&&cn.includes(ds))score+=2
  if(dg&&(cg===dg||cn.includes(dg)))score+=2
  if(!dg||!cg||cg===dg||cn.includes(dg))score+=1
  if(cl.includes('varsity')&&!cl.includes('junior'))score+=2
  return score
}
function genderCompatible(c:any,s:any){
  const dg=clean(s?.gender),cg=clean(c.gender),cn=clean(c.teamName)
  if(!dg)return true
  if(cg)return cg===dg
  return cn.includes(dg)||(!cn.includes('boys')&&!cn.includes('girls')&&!cn.includes('mens')&&!cn.includes('womens'))
}
function varsityCompatible(c:any){const cl=clean(c.level),cn=clean(c.teamName);return cl?cl.includes('varsity')&&!cl.includes('junior'):!cn.includes('junior varsity')&&!cn.includes(' jv ')}
function fullName(p:any){return text(val(p,'displayName','fullName','name'))||text([val(p,'firstName','first_name'),val(p,'lastName','last_name')].filter(Boolean).join(' '))}
function normalizePlayer(p:any){const displayName=fullName(p);return{jerseyNumber:text(val(p,'jerseyNumber','jersey','number')),rawName:displayName,displayName,firstName:text(val(p,'firstName','first_name')),lastName:text(val(p,'lastName','last_name')),classYear:text(val(p,'classYear','class','grade','graduationYear')),position:text(val(p,'position','positionName')),height:text(val(p,'height'))}}
function normalizeCoach(p:any){const displayName=fullName(p);return{rawName:displayName,displayName,firstName:text(val(p,'firstName','first_name')),lastName:text(val(p,'lastName','last_name')),title:text(val(p,'title','role','position'))}}

async function fetchSchoolTeams(sid:number){
  const attempts:[string,any][]=[
    ['SchoolId',{SchoolId:sid}],
    ['schoolId',{schoolId:sid}],
    ['SchoolIDs',{SchoolIDs:[sid]}],
    ['SchoolIds',{SchoolIds:[sid]}],
  ]
  const diagnostics:any[]=[]
  for(const [variant,query] of attempts){
    try{
      const raw=await arbiterApi.teams(query)
      const teams=extractTeamCandidates(raw,sid)
      diagnostics.push({variant,shape:responseShape(raw),teamsFound:teams.length})
      if(teams.length)return{teams,diagnostics,error:null}
    }catch(error){diagnostics.push({variant,error:error instanceof Error?error.message:String(error),teamsFound:0})}
  }
  return{teams:[],diagnostics,error:diagnostics.every(d=>d.error)?'All GetTeams query variants failed.':null}
}

export async function GET(req:NextRequest){
  const db=createAdminClient()
  try{
    const seasonId=req.nextUrl.searchParams.get('seasonId')
    let season:any=null
    if(seasonId){const {data,error}=await db.from('seasons').select('id,name,season_type,year,is_active').eq('id',seasonId).single();if(error)throw new Error(error.message);season=data}else{const {data,error}=await db.from('seasons').select('id,name,season_type,year,is_active').eq('is_active',true).single();if(error)throw new Error(error.message);season=data}
    const [{data:schools,error:se},{data:teams,error:te},{data:sports,error:spe},{data:teamSeasons,error:tse},{data:existingRosters,error:re}]=await Promise.all([
      db.from('schools').select('id,school_name,arbiter_entity_id').eq('active',true).not('arbiter_entity_id','is',null),
      db.from('teams').select('id,school_id,sport_id,team_name,level,active').eq('active',true),
      db.from('sports').select('id,sport_name,gender,season_type,slug'),
      db.from('team_seasons').select('team_id,season_id,active_for_season').eq('season_id',season.id).eq('active_for_season',true),
      db.from('roster_entries').select('team_id,season_id,active').eq('season_id',season.id).eq('active',true),
    ])
    const err=se||te||spe||tse||re;if(err)throw new Error(err.message)
    const schoolById=new Map((schools||[]).map((s:any)=>[s.id,s])),sportById=new Map((sports||[]).map((s:any)=>[s.id,s])),activeIds=new Set((teamSeasons||[]).map((x:any)=>x.team_id)),rosterCount=new Map<string,number>()
    for(const r of existingRosters||[])rosterCount.set(r.team_id,(rosterCount.get(r.team_id)||0)+1)
    const varsity=(teams||[]).filter((t:any)=>activeIds.has(t.id)&&clean(t.level).includes('varsity')&&!clean(t.level).includes('junior'))
    const arbiterTeamsBySchool=new Map<number,any[]>(),schoolDiagnostics=new Map<number,any>()
    for(let i=0;i<(schools||[]).length;i+=6){
      const batch=(schools||[]).slice(i,i+6)
      const fetched=await Promise.all(batch.map(async(s:any)=>{const sid=Number(s.arbiter_entity_id),result=await fetchSchoolTeams(sid);return{s,sid,result}}))
      for(const f of fetched){arbiterTeamsBySchool.set(f.sid,f.result.teams);schoolDiagnostics.set(f.sid,{school:f.s.school_name,schoolId:f.sid,...f.result})}
    }

    const matches:any[]=[]
    for(const team of varsity){
      const school=schoolById.get(team.school_id) as any,sport=sportById.get(team.sport_id) as any,sid=Number(school?.arbiter_entity_id),allCandidates=arbiterTeamsBySchool.get(sid)||[]
      const compatible=allCandidates.filter((c:any)=>c.teamId&&varsityCompatible(c)&&genderCompatible(c,sport)).map((c:any)=>({...c,score:sportScore(c,sport)})).filter((c:any)=>c.score>=4).sort((a:any,b:any)=>b.score-a.score)
      const best=compatible[0]||null,tied=best?compatible.filter((c:any)=>c.score===best.score):[]
      let reason='matched'
      if(!allCandidates.length)reason='arbiter-no-teams-returned'
      else if(!compatible.length)reason='no-compatible-sport-gender-level-match'
      else if(tied.length>1)reason='ambiguous-best-match'
      matches.push({team,school,sport,best:tied.length===1?best:null,ambiguous:tied.length>1,candidates:tied.length?tied.slice(0,5):allCandidates.slice(0,5),existingRosterCount:rosterCount.get(team.id)||0,reason,arbiterCandidateCount:allCandidates.length})
    }

    const importPayloads:any[]=[],rows:any[]=[]
    const matched=matches.filter(m=>m.best)
    for(let i=0;i<matched.length;i+=5){
      const batch=matched.slice(i,i+5)
      const fetched=await Promise.all(batch.map(async m=>{try{return{m,payload:await arbiterApi.teamWithRoster(m.best.teamId,Number(m.school.arbiter_entity_id)),error:null}}catch(error){return{m,payload:null,error:error instanceof Error?error.message:String(error)}}}))
      for(const f of fetched){
        const playersRaw=findNamedArray(f.payload,['roster','rosters','players','athletes','studentAthletes']),coachesRaw=findNamedArray(f.payload,['coaches','coachingStaff','staff'])
        const roster=(playersRaw||[]).map(normalizePlayer).filter(p=>p.displayName),coaches=(coachesRaw||[]).map(normalizeCoach).filter(p=>p.displayName),rosterFound=playersRaw!==null,coachesFound=coachesRaw!==null
        const normalized={team_id:f.m.team.id,season_id:season.id,source_url:null,roster_found:rosterFound,coaches_found:coachesFound,roster,coaches}
        if(rosterFound||coachesFound)importPayloads.push(normalized)
        rows.push({teamId:f.m.team.id,teamName:f.m.team.team_name,school:f.m.school.school_name,sport:f.m.sport?.sport_name,gender:f.m.sport?.gender,arbiterTeamId:f.m.best.teamId,arbiterTeamName:f.m.best.teamName,arbiterSportName:f.m.best.sportName,arbiterLevel:f.m.best.level,existingRosterCount:f.m.existingRosterCount,rosterFound,rosterCount:roster.length,coachesFound,coachCount:coaches.length,error:f.error,status:f.error?'roster-fetch-error':rosterFound?'available':'no-roster-published',diagnosticReason:f.error?'roster-fetch-error':rosterFound?'published-roster-found':'team-matched-roster-not-published'})
      }
    }
    for(const m of matches.filter(m=>!m.best))rows.push({teamId:m.team.id,teamName:m.team.team_name,school:m.school?.school_name,sport:m.sport?.sport_name,gender:m.sport?.gender,arbiterTeamId:null,existingRosterCount:m.existingRosterCount,rosterFound:false,rosterCount:0,coachesFound:false,coachCount:0,status:m.ambiguous?'ambiguous-team-match':m.reason==='arbiter-no-teams-returned'?'arbiter-no-teams':'team-not-matched',diagnosticReason:m.reason,arbiterCandidateCount:m.arbiterCandidateCount,candidates:m.candidates.map((c:any)=>({teamId:c.teamId,teamName:c.teamName,sportName:c.sportName,gender:c.gender,level:c.level,score:c.score??null}))})
    rows.sort((a,b)=>String(a.school).localeCompare(String(b.school))||String(a.sport).localeCompare(String(b.sport)))
    const counts={
      teams:rows.length,
      available:rows.filter(r=>r.status==='available').length,
      noRosterPublished:rows.filter(r=>r.status==='no-roster-published').length,
      arbiterNoTeams:rows.filter(r=>r.status==='arbiter-no-teams').length,
      teamNotFound:rows.filter(r=>r.status==='team-not-matched').length,
      ambiguous:rows.filter(r=>r.status==='ambiguous-team-match').length,
      errors:rows.filter(r=>r.status==='roster-fetch-error').length,
      alreadyLoaded:rows.filter(r=>r.existingRosterCount>0).length,
      importPayloads:importPayloads.length,
    }
    const diagnostics={schools:(schools||[]).map((s:any)=>{const d=schoolDiagnostics.get(Number(s.arbiter_entity_id));return{school:s.school_name,arbiterSchoolId:Number(s.arbiter_entity_id),teamsFound:d?.teams?.length||0,attempts:d?.diagnostics||[],error:d?.error||null}}),schoolsWithTeams:[...schoolDiagnostics.values()].filter((d:any)=>d.teams?.length).length,schoolsWithoutTeams:[...schoolDiagnostics.values()].filter((d:any)=>!d.teams?.length).length,totalArbiterTeams:[...arbiterTeamsBySchool.values()].reduce((n,a)=>n+a.length,0)}
    return NextResponse.json({ok:true,readOnly:true,season,counts,rows,importPayloads,diagnostics})
  }catch(error){
    console.error('Partner API roster scan failed:',error)
    return NextResponse.json({ok:false,readOnly:true,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
