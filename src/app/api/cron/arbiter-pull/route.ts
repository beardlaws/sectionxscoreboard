import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runScheduleAudit } from '@/lib/arbiter/schedule-intelligence'
import { runLiveOperationsCheck } from '@/lib/arbiter/live-operations'
import { arbiterApi } from '@/lib/arbiter/client'

export const dynamic='force-dynamic'
export const maxDuration=300

const clean=(v:unknown)=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const meaningfulLocation=(v:unknown)=>{const c=clean(v);return Boolean(c)&&!['tba','not listed','z','unknown'].includes(c)}
const sourceStatus=(v:unknown)=>['canceled','cancelled','deleted'].includes(clean(v))?'Canceled':'Scheduled'
const contestType=(v:unknown)=>clean(v)==='scrimmage'?'Scrimmage':'Game'

function deletedIds(payload:unknown){
  const values=Array.isArray(payload)?payload:payload==null?[]:[payload]
  const ids:number[]=[]
  for(const item of values as any[]){
    const id=Number(item?.uniqueGameId??item?.gameId??item?.id??item)
    if(Number.isFinite(id))ids.push(id)
  }
  return [...new Set(ids)]
}

export async function GET(req:NextRequest){
  const db=createAdminClient()
  const token=req.headers.get('x-sectionx-automation-key')||''
  const {data:allowed,error:authError}=await db.rpc('verify_sectionx_automation_key',{p_token:token})
  if(authError||allowed!==true)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})

  const staleCutoff=new Date(Date.now()-15*60_000).toISOString()
  const {data:running}=await db.from('arbiter_automation_runs').select('id,started_at').eq('status','running').gte('started_at',staleCutoff).order('started_at',{ascending:false}).limit(1).maybeSingle()
  if(running?.id)return NextResponse.json({ok:false,error:'An automated Arbiter pull is already running.',runId:running.id},{status:409})

  const {data:run,error:runError}=await db.from('arbiter_automation_runs').insert({status:'running',trigger_source:'supabase-cron'}).select('id').single()
  if(runError)return NextResponse.json({ok:false,error:`Could not start automation run: ${runError.message}`},{status:500})
  const runId=run.id

  try{
    const {data:season,error:seasonError}=await db.from('seasons').select('id,name,year,season_type,is_active').eq('is_active',true).limit(1).maybeSingle()
    if(seasonError||!season)throw new Error(seasonError?.message||'No active season found.')

    const audit=await runScheduleAudit({seasonId:season.id})
    if(!audit.comparison.writerReady)throw new Error('Schedule writer is blocked by reconciliation safety checks.')

    let scheduleUpdated=0,scheduleCreated=0,externalCreated=0,linksRefreshed=0,deletedMarked=0,scheduleFailures=0
    const scheduleActions:any[]=[]

    const linkRow=async(row:any,gameId:string)=>{
      const {error}=await db.from('arbiter_game_links').upsert({arbiter_game_id:row.uniqueGameId,game_id:gameId,last_modified_at:row.lastModifiedDate||null,last_seen_at:new Date().toISOString(),source_status:row.status||null,source_payload:row.sourcePayload||null,updated_at:new Date().toISOString()},{onConflict:'arbiter_game_id'})
      if(error)throw new Error(`Stable-link refresh failed: ${error.message}`)
      linksRefreshed++
    }

    const updateExisting=async(row:any,gameId:string)=>{
      const current:any=row.existing||{},patch:any={}
      if(row.date&&current.gameDate!==row.date)patch.game_date=row.date
      if(row.time&&String(current.gameTime||'').slice(0,5)!==row.time)patch.game_time=row.time
      if(meaningfulLocation(row.location)&&clean(current.location)!==clean(row.location))patch.location=row.location
      if(sourceStatus(row.status)==='Canceled'&&clean(current.status)!=='canceled')patch.status='Canceled'
      else if(sourceStatus(row.status)==='Scheduled'&&clean(current.status)==='canceled'&&['canceled','cancelled','deleted'].includes(clean(row.linked?.sourceStatus)))patch.status='Scheduled'
      const desiredContest=contestType(row.type)
      if(clean(current.contestType||'Game')!==clean(desiredContest))patch.contest_type=desiredContest
      if(Object.keys(patch).length){patch.updated_at=new Date().toISOString();const {error}=await db.from('games').update(patch).eq('id',gameId);if(error)throw new Error(`Schedule update failed for ${gameId}: ${error.message}`);scheduleUpdated++;scheduleActions.push({arbiterGameId:row.uniqueGameId,gameId,action:'updated',patch,driftReasons:row.driftReasons||[]})}
      await linkRow(row,gameId)
    }

    const ensureExternal=async(side:any)=>{
      if(side.kind!=='external')return side.id||null
      if(side.id)return side.id
      if(!side.create?.name)return null
      const desiredSlug=side.create.slug
      const {data:existing}=await db.from('external_opponents').select('id').or(`slug.eq.${desiredSlug},name.ilike.${side.create.name}`).limit(1).maybeSingle()
      if(existing?.id)return existing.id
      const {data:created,error}=await db.from('external_opponents').insert({name:side.create.name,slug:desiredSlug,is_section_x:false}).select('id').single()
      if(error){const {data:retry}=await db.from('external_opponents').select('id').eq('slug',desiredSlug).maybeSingle();if(retry?.id)return retry.id;throw new Error(`External opponent create failed for ${side.create.name}: ${error.message}`)}
      externalCreated++;return created.id
    }

    const createSafeGame=async(row:any)=>{
      if(!row.safelyActionable||!['new-game','external-create'].includes(row.bucket))return
      if(!row.sportId||!row.date||row.uniqueGameId==null)throw new Error('Missing sport/date/stable identity for automatic create.')
      const {data:linked}=await db.from('arbiter_game_links').select('game_id').eq('arbiter_game_id',row.uniqueGameId).maybeSingle()
      if(linked?.game_id){await updateExisting(row,linked.game_id);return}
      const homeInternal=row.home?.kind==='internal'?row.home.id:null,awayInternal=row.away?.kind==='internal'?row.away.id:null
      const homeExternal=row.home?.kind==='external'?await ensureExternal(row.home):null,awayExternal=row.away?.kind==='external'?await ensureExternal(row.away):null
      if((!homeInternal&&!homeExternal)||(!awayInternal&&!awayExternal))throw new Error('Opponent resolution incomplete during automatic create.')
      const {data:same,error:sameError}=await db.from('games').select('id,game_time,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id').eq('game_date',row.date).eq('sport_id',row.sportId)
      if(sameError)throw new Error(`Duplicate safety check failed: ${sameError.message}`)
      const h=homeInternal?`t:${homeInternal}`:`e:${homeExternal}`,a=awayInternal?`t:${awayInternal}`:`e:${awayExternal}`
      const gameToken=(g:any,home:boolean)=>{const t=home?g.home_team_id:g.away_team_id,e=home?g.external_home_opponent_id:g.external_away_opponent_id;return t?`t:${t}`:e?`e:${e}`:'tba'}
      const teamMatches=(same||[]).filter((g:any)=>(gameToken(g,true)===h&&gameToken(g,false)===a)||(gameToken(g,true)===a&&gameToken(g,false)===h))
      let duplicate:any=null
      if(row.time){const exact=teamMatches.filter((g:any)=>String(g.game_time||'').slice(0,5)===row.time);if(exact.length>1)throw new Error('Multiple same-team same-time games exist; automatic create quarantined.');duplicate=exact[0]||null}else if(teamMatches.length)throw new Error('Same teams already play on this date and Arbiter has no reliable time; automatic create quarantined.')
      if(duplicate){row.existing={id:duplicate.id,gameTime:duplicate.game_time};await updateExisting(row,duplicate.id);scheduleActions.push({arbiterGameId:row.uniqueGameId,gameId:duplicate.id,action:'duplicate-prevented'});return}
      const insert:any={season_id:season.id,sport_id:row.sportId,home_team_id:homeInternal,away_team_id:awayInternal,external_home_opponent_id:homeExternal,external_away_opponent_id:awayExternal,game_date:row.date,game_time:row.time||null,location:meaningfulLocation(row.location)?row.location:null,status:sourceStatus(row.status),verification_status:'Reported',source:'arbiter-api',contest_type:contestType(row.type)}
      const {data:created,error:createError}=await db.from('games').insert(insert).select('id').single()
      if(createError)throw new Error(`Automatic game create failed: ${createError.message}`)
      try{await linkRow(row,created.id)}catch(error){await db.from('games').delete().eq('id',created.id);throw error}
      scheduleCreated++;scheduleActions.push({arbiterGameId:row.uniqueGameId,gameId:created.id,action:'created',bucket:row.bucket})
    }

    for(const row of audit.rows||[]){
      if(row?.uniqueGameId==null||!row.safelyActionable)continue
      try{if(['stable-id-match','stable-id-update','exact-match','probable-match'].includes(row.bucket)&&row.existingGameId)await updateExisting(row,row.existingGameId);else if(['new-game','external-create'].includes(row.bucket))await createSafeGame(row)}catch(error){scheduleFailures++;scheduleActions.push({arbiterGameId:row.uniqueGameId,gameId:row.existingGameId||null,action:'failed',error:error instanceof Error?error.message:String(error)})}
    }

    try{
      const deleted=await arbiterApi.deletedGames(audit.window.start,audit.window.end)
      for(const arbiterId of deletedIds(deleted)){const {data:link}=await db.from('arbiter_game_links').select('game_id').eq('arbiter_game_id',arbiterId).maybeSingle();if(!link?.game_id)continue;const {error}=await db.from('games').update({status:'Canceled',updated_at:new Date().toISOString()}).eq('id',link.game_id);if(error){scheduleFailures++;continue}await db.from('arbiter_game_links').update({source_status:'Deleted',last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('arbiter_game_id',arbiterId);deletedMarked++}
    }catch(error){console.error('Automated deleted-games check warning:',error)}

    const live=await runLiveOperationsCheck(season.id)
    const safeScores=(live.scores.rows||[]).filter((r:any)=>r.safeToApply)
    let scoresUpdated=0,scoreFailures=0
    const scoreActions:any[]=[]
    for(const row of safeScores){const patch={home_score:row.arbiter.home,away_score:row.arbiter.away,status:'Final',verification_status:'Reported',source:'arbiter-api',updated_at:new Date().toISOString()};const {error}=await db.from('games').update(patch).eq('id',row.gameId);if(error){scoreFailures++;scoreActions.push({gameId:row.gameId,arbiterGameId:row.arbiterGameId,outcome:'failed',error:error.message});continue}scoresUpdated++;scoreActions.push({gameId:row.gameId,arbiterGameId:row.arbiterGameId,outcome:'updated',bucket:row.bucket,score:`${row.arbiter.away}-${row.arbiter.home}`})}

    const postPending=Number(live.schedule?.pendingChanges||0),postQuarantined=Number(live.schedule?.quarantined||0),postBlockers=Number(live.schedule?.blockers||0)
    const summary={season:{id:season.id,name:season.name},schedule:{stableLinks:Number(live.schedule?.syncedStable||linksRefreshed),updated:scheduleUpdated,created:scheduleCreated,externalCreated,deletedMarked,failed:scheduleFailures,pendingChanges:postPending,quarantined:postQuarantined,blockers:postBlockers,actions:scheduleActions.slice(0,75)},scores:{updated:scoresUpdated,failed:scoreFailures,conflictsUntouched:live.scores.conflicts||0,reportedNotFinalUntouched:live.scores.counts?.['score-reported-not-final']||0,actions:scoreActions.slice(0,50)},rosters:{loaded:live.rosters.loaded,missing:live.rosters.missing,varsityTeams:live.rosters.varsityTeams},exceptions:live.exceptions.length}
    const failed=scheduleFailures+scoreFailures
    const status=failed?'completed-with-errors':'completed'
    const healthStatus=failed?'attention':postBlockers>0?'blocked':postPending>0||Number(live.scores.conflicts||0)>0?'attention':'healthy'
    await db.from('arbiter_automation_runs').update({status,season_id:season.id,summary,finished_at:new Date().toISOString()}).eq('id',runId)
    await db.from('arbiter_health_checks').insert({season_id:season.id,status:healthStatus,summary:{source:'automation',syncedStable:summary.schedule.stableLinks,pendingChanges:postPending,trueBlockers:postBlockers,quarantined:postQuarantined,scoreConflicts:Number(live.scores.conflicts||0),changesApplied:scheduleUpdated+scheduleCreated+deletedMarked+scoresUpdated,automationRunId:runId},changes:scheduleActions.slice(0,100),quarantines:(live.exceptions||[]).slice(0,100)})
    return NextResponse.json({ok:failed===0,automated:true,runId,...summary},{status:failed?207:200})
  }catch(error){const message=error instanceof Error?error.message:String(error);console.error('Automated Arbiter pull failed:',error);await db.from('arbiter_automation_runs').update({status:'failed',summary:{error:message},finished_at:new Date().toISOString()}).eq('id',runId);return NextResponse.json({ok:false,automated:true,runId,error:message},{status:500})}
}
