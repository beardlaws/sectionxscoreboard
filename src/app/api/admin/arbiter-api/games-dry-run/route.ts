import { NextRequest, NextResponse } from 'next/server'
import { ArbiterApiError, arbiterApi } from '@/lib/arbiter/client'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SECTION_X_SCHOOL_IDS = new Set([2630,52120,3988,4543,4769,6714,8736,9356,9563,9923,9954,13012,13569,7896,14077,15195,16678,16935,17532,18479,20233,20061,20146,23855])
const SCHOOL_ID_LIST = Array.from(SECTION_X_SCHOOL_IDS)
const CONTEST_TYPE_IDS = new Set([1,2,3,4,8])

const arr = (v: unknown): any[] => Array.isArray(v) ? v : v == null ? [] : [v]
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : null
const clean = (v: unknown) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const day = (v: unknown) => String(v || '').slice(0,10) || null
const clock = (v: unknown) => String(v || '').slice(11,16) || null
const levelKey = (v: unknown) => clean(v).includes('junior varsity') ? 'jv' : clean(v).includes('varsity') ? 'varsity' : clean(v).includes('modified') ? 'modified' : clean(v)
function isoDate(v: string | null, fallback: string) { if (!v) return fallback; const d = new Date(v); return Number.isNaN(d.getTime()) ? fallback : d.toISOString() }
function countBy(values: string[]) { const m = new Map<string,number>(); values.forEach(v => m.set(v,(m.get(v)||0)+1)); return [...m].map(([id,count])=>({id,count})).sort((a,b)=>b.count-a.count) }

function side(game: any, home: boolean) {
  const t = arr(game?.teams).find((x:any)=>Boolean(x?.isHome)===home) || null
  if (!t) return { teamId:null, schoolId:null, teamName:null, schoolName:null, score:null, isCoOp:false, isSectionX:false, isTba:true }
  const schoolId = num(t.schoolId), teamId = num(t.teamId)
  return { teamId, schoolId, teamName:t.teamName??null, schoolName:t.schoolName??null, score:t.score??null, isCoOp:Boolean(t.isCoop??t.isCoOp), isSectionX:schoolId!==null&&SECTION_X_SCHOOL_IDS.has(schoolId), isTba:!teamId||!schoolId }
}
function normalize(game:any) {
  const home=side(game,true), away=side(game,false), gameTypeId=num(game?.gameTypeId), levelId=num(game?.levelId)
  const sx=Number(home.isSectionX)+Number(away.isSectionX)
  return { uniqueGameId:num(game?.uniqueGameId), fromDate:game?.fromDate??null, lastModifiedDate:game?.lastModifiedDate??null,
    sportId:num(game?.sportId), sportName:game?.sportName??null, gender:game?.gender??null, levelId, levelName:game?.levelName??null,
    gameTypeId, gameTypeName:game?.gameTypeName??null, statusId:num(game?.statusId), status:game?.status??null, title:game?.title??null,
    siteName:game?.siteName??null, subSiteName:game?.subSiteName??null, home, away,
    isPractice:gameTypeId===5||clean(game?.gameTypeName)==='practice', isContest:gameTypeId!==null&&CONTEST_TYPE_IDS.has(gameTypeId),
    hasTba:home.isTba||away.isTba, hasScores:home.score!==null||away.score!==null, hasCoOpTeam:home.isCoOp||away.isCoOp,
    opponentScope:sx===2?'section-x-vs-section-x':sx===1?'section-x-vs-external':'external-only' }
}

async function compare(contests:any[], start:string, end:string) {
  const db=createAdminClient(), startDate=start.slice(0,10), endDate=end.slice(0,10)
  const [schoolR,teamR,sportR,extR,gameR,seasonR]=await Promise.all([
    db.from('schools').select('id,school_name,arbiter_entity_id').not('arbiter_entity_id','is',null),
    db.from('teams').select('id,school_id,sport_id,team_name,level,active'),
    db.from('sports').select('id,sport_name,gender,season_type,slug'),
    db.from('external_opponents').select('id,name'),
    db.from('games').select('id,game_date,game_time,sport_id,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id,status,contest_type,source').gte('game_date',startDate).lte('game_date',endDate),
    db.from('seasons').select('id,name,season_type,is_active').eq('is_active',true).limit(1).maybeSingle(),
  ])
  const error=schoolR.error||teamR.error||sportR.error||extR.error||gameR.error||seasonR.error
  if(error) throw new Error(`Supabase comparison query failed: ${error.message}`)
  const schools=schoolR.data||[], teams=teamR.data||[], sports=sportR.data||[], externals=extR.data||[], existing=gameR.data||[]
  const activeSeason=seasonR.data, activeType=activeSeason?.season_type||'Fall'
  const schoolByArbiter=new Map(schools.map((s:any)=>[Number(s.arbiter_entity_id),s]))
  const extByName=new Map(externals.map((e:any)=>[clean(e.name),e]))

  function resolveSport(g:any) {
    const candidates=sports.filter((s:any)=>clean(s.season_type)===clean(activeType))
    const raw=clean(g.sportName), gender=clean(g.gender)
    return candidates.find((s:any)=>{
      const dbName=clean(s.sport_name), dbGender=clean(s.gender)
      if(dbName===raw && (!gender||!dbGender||gender===dbGender)) return true
      if(dbName===`${gender} ${raw}`) return true
      if(clean(s.slug)===`${gender} ${raw}`) return true
      return false
    })||null
  }
  function resolveSide(s:any,sport:any,level:any) {
    if(s.isTba) return {kind:'tba',id:null,name:s.teamName||s.schoolName||'TBA',mapped:false}
    if(s.isSectionX) {
      const school=schoolByArbiter.get(Number(s.schoolId)) as any
      if(!school||!sport) return {kind:'internal',id:null,name:s.schoolName||s.teamName,mapped:false}
      const candidates=teams.filter((t:any)=>t.school_id===school.id&&t.sport_id===sport.id&&t.active!==false)
      const team=candidates.find((t:any)=>levelKey(t.level)===levelKey(level))
      return {kind:'internal',id:team?.id||null,name:team?.team_name||s.teamName||school.school_name,mapped:Boolean(team)}
    }
    const name=s.schoolName||s.teamName||''; const ext=extByName.get(clean(name)) as any
    return {kind:'external',id:ext?.id||null,name,mapped:Boolean(ext)}
  }
  const token=(s:any)=>s.kind==='internal'?`t:${s.id}`:s.kind==='external'?`e:${s.id}`:'tba'
  const dbToken=(g:any,h:boolean)=>{const t=h?g.home_team_id:g.away_team_id,e=h?g.external_home_opponent_id:g.external_away_opponent_id;return t?`t:${t}`:e?`e:${e}`:'tba'}

  const scoped=contests.filter((g:any)=>levelKey(g.levelName)==='varsity'&&resolveSport(g))
  const excludedVarsity=contests.filter((g:any)=>levelKey(g.levelName)==='varsity'&&!resolveSport(g))
  const rows=scoped.map((g:any)=>{
    const sport=resolveSport(g), home=resolveSide(g.home,sport,g.levelName), away=resolveSide(g.away,sport,g.levelName)
    const date=day(g.fromDate), time=clock(g.fromDate), issues:string[]=[]
    if(!home.mapped&&home.kind!=='tba') issues.push(`home-${home.kind}`)
    if(!away.mapped&&away.kind!=='tba') issues.push(`away-${away.kind}`)
    if(home.kind==='tba'||away.kind==='tba') issues.push('tba')
    let bucket='new-game', match:any=null
    if(issues.length) bucket=issues.includes('tba')?'manual-review':'mapping-needed'
    else {
      const same=existing.filter((x:any)=>x.game_date===date&&x.sport_id===sport.id), h=token(home), a=token(away)
      match=same.find((x:any)=>dbToken(x,true)===h&&dbToken(x,false)===a)||same.find((x:any)=>dbToken(x,true)===a&&dbToken(x,false)===h)||null
      if(match){const dbTime=String(match.game_time||'').slice(0,5)||null;bucket=!time||!dbTime||time===dbTime?'exact-match':'probable-match'}
    }
    return {bucket,uniqueGameId:g.uniqueGameId,date,time,sport:g.sportName,gender:g.gender,level:g.levelName,type:g.gameTypeName,status:g.status,
      home:{arbiter:g.home.schoolName||g.home.teamName,mapped:home.name,kind:home.kind,id:home.id},away:{arbiter:g.away.schoolName||g.away.teamName,mapped:away.name,kind:away.kind,id:away.id},
      mappingIssues:issues,existingGameId:match?.id||null,existingTime:match?.game_time||null}
  })
  const keys=['exact-match','probable-match','new-game','mapping-needed','manual-review']
  const counts=Object.fromEntries(keys.map(k=>[k,rows.filter((r:any)=>r.bucket===k).length]))
  const blockers=counts['mapping-needed']+counts['manual-review']
  return {activeSeason:activeSeason?.name||null,targetScope:`${activeType} varsity contests only`,existingGamesInWindow:existing.length,
    allContestRows:contests.length,scopedContestRows:rows.length,nonVarsitySkipped:contests.filter((g:any)=>levelKey(g.levelName)!=='varsity').length,
    varsityOtherSeasonSkipped:excludedVarsity.length,counts,blockers,safeToWrite:blockers===0,
    samples:{probableMatches:rows.filter((r:any)=>r.bucket==='probable-match').slice(0,20),newGames:rows.filter((r:any)=>r.bucket==='new-game').slice(0,30),mappingNeeded:rows.filter((r:any)=>r.bucket==='mapping-needed').slice(0,30),manualReview:rows.filter((r:any)=>r.bucket==='manual-review').slice(0,30)}}
}

export async function GET(req:NextRequest) {
  const now=new Date(), start=isoDate(req.nextUrl.searchParams.get('start'),new Date(Date.UTC(now.getUTCFullYear(),7,1)).toISOString()), end=isoDate(req.nextUrl.searchParams.get('end'),new Date(Date.UTC(now.getUTCFullYear(),10,30,23,59,59)).toISOString())
  try {
    const raw=await arbiterApi.games({SchoolIds:SCHOOL_ID_LIST,DateFilter:'Range',GameStartDate:start,GameEndDate:end,IncludeDeletedGames:false,IncludePendingInformation:false})
    const normalized=arr(raw).map(normalize), ids=new Set<number>(), dup=new Set<number>()
    normalized.forEach((g:any)=>{if(g.uniqueGameId!==null){if(ids.has(g.uniqueGameId))dup.add(g.uniqueGameId);ids.add(g.uniqueGameId)}})
    const contests=normalized.filter((g:any)=>g.isContest&&!g.isPractice), practices=normalized.filter((g:any)=>g.isPractice)
    const comparison=await compare(contests,start,end)
    return NextResponse.json({ok:true,dryRun:true,writesPerformed:0,window:{start,end},summary:{recordsReturned:normalized.length,uniqueGameIds:ids.size,duplicateUniqueGameIds:dup.size,contests:contests.length,practices:practices.length,
      varsityContests:contests.filter((g:any)=>g.levelId===1).length,jvContests:contests.filter((g:any)=>g.levelId===2).length,modifiedContests:contests.filter((g:any)=>[27,30,39].includes(g.levelId||-1)).length,
      sectionXVsSectionX:contests.filter((g:any)=>g.opponentScope==='section-x-vs-section-x').length,sectionXVsExternal:contests.filter((g:any)=>g.opponentScope==='section-x-vs-external').length,tbaContests:contests.filter((g:any)=>g.hasTba).length,coOpContests:contests.filter((g:any)=>g.hasCoOpTeam).length},
      breakdowns:{sports:countBy(normalized.map((g:any)=>g.sportName||'unknown')),levels:countBy(normalized.map((g:any)=>g.levelName||'unknown')),gameTypes:countBy(normalized.map((g:any)=>g.gameTypeName||'unknown')),statuses:countBy(normalized.map((g:any)=>g.status||'unknown'))},
      comparison,readiness:{normalizationFixed:true,comparisonGateBuilt:true,safeToWrite:false,nextGate:comparison.safeToWrite?'Comparison is clean. Add stable Arbiter IDs + controlled upsert semantics before enabling writes.':'Resolve mapping/manual-review blockers before enabling writes.'},note:'Read-only Arbiter normalization + Supabase comparison audit. No game writes are performed.'})
  } catch(error) {
    console.error('Arbiter game dry run error:',error)
    if(error instanceof ArbiterApiError) return NextResponse.json({ok:false,dryRun:true,writesPerformed:0,error:error.message,arbiterStatus:error.status,details:error.details},{status:502})
    return NextResponse.json({ok:false,dryRun:true,writesPerformed:0,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
