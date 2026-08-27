import { NextRequest, NextResponse } from 'next/server'
import { arbiterApi } from '@/lib/arbiter/client'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic='force-dynamic'
export const maxDuration=300

const clean=(v:unknown)=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const arr=(v:any):any[]=>Array.isArray(v)?v:v==null?[]:[v]
const val=(o:any,...keys:string[])=>{for(const k of keys){if(o&&o[k]!==undefined&&o[k]!==null)return o[k]}return null}
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):null
const text=(v:any)=>String(v??'').replace(/\s+/g,' ').trim()

function findNamedArray(root:any,names:string[]){
  const wanted=new Set(names.map(clean)),seen=new Set<any>(),q=[root]
  while(q.length){const cur=q.shift();if(!cur||typeof cur!=='object'||seen.has(cur))continue;seen.add(cur);for(const [k,v] of Object.entries(cur)){if(wanted.has(clean(k))&&Array.isArray(v))return v as any[];if(v&&typeof v==='object')q.push(v)}}
  return null
}
function candidateTeam(raw:any,schoolId:number){
  return{raw,teamId:num(val(raw,'teamId','teamID','id')),schoolId:num(val(raw,'schoolId','schoolID'))??schoolId,teamName:text(val(raw,'teamName','name','team')),sportName:text(val(raw,'sportName','genericSportName','sport')),gender:text(val(raw,'gender','genderName')),level:text(val(raw,'levelName','level','levelDescription'))}
}
function sportScore(c:any,s:any){
  const cs=clean(c.sportName),cn=clean(c.teamName),ds=clean(s.sport_name),dg=clean(s.gender)
  let score=0
  if(cs&&ds&&(cs===ds||cs.includes(ds)||ds.includes(cs)))score+=3
  if(ds&&cn.includes(ds))score+=2
  if(dg&&(clean(c.gender)===dg||cn.includes(dg)))score+=1
  return score
}
function fullName(p:any){return text(val(p,'displayName','fullName','name'))||text([val(p,'firstName','first_name'),val(p,'lastName','last_name')].filter(Boolean).join(' '))}
function normalizePlayer(p:any){const displayName=fullName(p);return{jerseyNumber:text(val(p,'jerseyNumber','jersey','number')),rawName:displayName,displayName,firstName:text(val(p,'firstName','first_name')),lastName:text(val(p,'lastName','last_name')),classYear:text(val(p,'classYear','class','grade','graduationYear')),position:text(val(p,'position','positionName')),height:text(val(p,'height'))}}
function normalizeCoach(p:any){const displayName=fullName(p);return{rawName:displayName,displayName,firstName:text(val(p,'firstName','first_name')),lastName:text(val(p,'lastName','last_name')),title:text(val(p,'title','role','position'))}}

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
    const arbiterTeamsBySchool=new Map<number,any[]>()
    await Promise.all((schools||[]).map(async(s:any)=>{const sid=Number(s.arbiter_entity_id);try{const raw=await arbiterApi.teams({schoolId:sid});arbiterTeamsBySchool.set(sid,arr(raw).map((x:any)=>candidateTeam(x,sid)))}catch{arbiterTeamsBySchool.set(sid,[])}}))

    const matches:any[]=[]
    for(const team of varsity){
      const school=schoolById.get(team.school_id) as any,sport=sportById.get(team.sport_id) as any,sid=Number(school?.arbiter_entity_id),candidates=(arbiterTeamsBySchool.get(sid)||[]).filter((c:any)=>c.teamId&&clean(c.level).includes('varsity')&&!clean(c.level).includes('junior')).map((c:any)=>({...c,score:sportScore(c,sport)})).filter((c:any)=>c.score>=2).sort((a:any,b:any)=>b.score-a.score)
      const best=candidates[0]||null,tied=best?candidates.filter((c:any)=>c.score===best.score):[]
      matches.push({team,school,sport,best:tied.length===1?best:null,ambiguous:tied.length>1,candidates:tied.slice(0,5),existingRosterCount:rosterCount.get(team.id)||0})
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
        rows.push({teamId:f.m.team.id,teamName:f.m.team.team_name,school:f.m.school.school_name,sport:f.m.sport?.sport_name,gender:f.m.sport?.gender,arbiterTeamId:f.m.best.teamId,arbiterTeamName:f.m.best.teamName,existingRosterCount:f.m.existingRosterCount,rosterFound,rosterCount:roster.length,coachesFound,coachCount:coaches.length,error:f.error,status:f.error?'error':rosterFound?'available':'no-roster-published'})
      }
    }
    for(const m of matches.filter(m=>!m.best))rows.push({teamId:m.team.id,teamName:m.team.team_name,school:m.school?.school_name,sport:m.sport?.sport_name,gender:m.sport?.gender,arbiterTeamId:null,existingRosterCount:m.existingRosterCount,rosterFound:false,rosterCount:0,coachesFound:false,coachCount:0,status:m.ambiguous?'ambiguous-team-match':'team-not-found',candidates:m.candidates.map((c:any)=>({teamId:c.teamId,teamName:c.teamName,sportName:c.sportName,level:c.level,score:c.score}))})
    rows.sort((a,b)=>String(a.school).localeCompare(String(b.school))||String(a.sport).localeCompare(String(b.sport)))
    const counts={teams:rows.length,available:rows.filter(r=>r.status==='available').length,noRosterPublished:rows.filter(r=>r.status==='no-roster-published').length,teamNotFound:rows.filter(r=>r.status==='team-not-found').length,ambiguous:rows.filter(r=>r.status==='ambiguous-team-match').length,errors:rows.filter(r=>r.status==='error').length,alreadyLoaded:rows.filter(r=>r.existingRosterCount>0).length,importPayloads:importPayloads.length}
    return NextResponse.json({ok:true,readOnly:true,season,counts,rows,importPayloads})
  }catch(error){
    console.error('Partner API roster scan failed:',error)
    return NextResponse.json({ok:false,readOnly:true,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
