import { NextRequest, NextResponse } from 'next/server'
import { arbiterApi, ArbiterApiError } from '@/lib/arbiter/client'
import { runScheduleAudit } from '@/lib/arbiter/schedule-intelligence'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CONFIRMATION = 'APPLY_ARBITER_SCHEDULE_SYNC'
const LOG_BATCH = 50
const LINK_BATCH = 100
const STALE_RUN_MINUTES = 20

const clean=(v:unknown)=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
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

export async function POST(req:NextRequest){
  const db=createAdminClient()
  let runId:string|null=null
  try{
    const body=await req.json().catch(()=>({}))
    if(body?.confirm!==CONFIRMATION){
      return NextResponse.json({ok:false,error:'Explicit confirmation required.',requiredConfirmation:CONFIRMATION},{status:400})
    }

    const audit=await runScheduleAudit({start:body.start,end:body.end,seasonId:body.seasonId,seasonType:body.seasonType,year:body.year==null?null:Number(body.year)})
    if(!audit.comparison.writerReady){
      return NextResponse.json({ok:false,error:'Writer halted because orphaned stable-identity links exist.',comparison:audit.comparison},{status:409})
    }

    const staleCutoff=new Date(Date.now()-STALE_RUN_MINUTES*60_000).toISOString()
    const {data:running}=await db.from('arbiter_sync_runs').select('id,created_at').eq('season_id',audit.season.id).eq('status','running').order('created_at',{ascending:false}).limit(1).maybeSingle()
    if(running?.id&&running.created_at>=staleCutoff){
      return NextResponse.json({ok:false,error:'A controlled sync is already running for this season.',runId:running.id},{status:409})
    }
    if(running?.id){
      await db.from('arbiter_sync_runs').update({status:'stale',finished_at:new Date().toISOString(),summary:{reason:'Previous run exceeded stale-run window.'}}).eq('id',running.id)
    }

    const {data:run,error:runError}=await db.from('arbiter_sync_runs').insert({
      season_id:audit.season.id,
      mode:'controlled',
      window_start:audit.window.start,
      window_end:audit.window.end,
      status:'running',
      summary:{planned:audit.comparison.counts,eligible:audit.comparison.eligible,quarantined:audit.comparison.quarantined,pendingChanges:audit.comparison.pendingChanges,progress:{processed:0,total:audit.rows.length}}
    }).select('id').single()
    if(runError)throw new Error(`Could not create sync run: ${runError.message}`)
    runId=run.id

    const totals={linked:0,updated:0,created:0,externalCreated:0,quarantined:0,ignoredOtherSeason:0,deletedMarked:0,failed:0,verifiedStable:0}
    let processed=0
    const responseLogs:any[]=[]
    let actionBuffer:any[]=[]
    let linkBuffer:any[]=[]

    const currentSummary=()=>({
      ...totals,
      planned:audit.comparison.counts,
      eligible:audit.comparison.eligible,
      quarantinedPlanned:audit.comparison.quarantined,
      pendingChanges:audit.comparison.pendingChanges,
      progress:{processed,total:audit.rows.length}
    })

    const updateProgress=async(force=false)=>{
      if(!force&&processed%50!==0)return
      await db.from('arbiter_sync_runs').update({summary:currentSummary()}).eq('id',runId)
    }

    const flushLogs=async(force=false)=>{
      if(!actionBuffer.length||(!force&&actionBuffer.length<LOG_BATCH))return
      const rows=actionBuffer.splice(0,actionBuffer.length)
      const {error}=await db.from('arbiter_sync_actions').insert(rows)
      if(error)console.error('Arbiter sync action batch log failed',error)
    }

    const flushLinks=async(force=false)=>{
      if(!linkBuffer.length||(!force&&linkBuffer.length<LINK_BATCH))return
      const rows=linkBuffer.splice(0,linkBuffer.length)
      const {error}=await db.from('arbiter_game_links').upsert(rows,{onConflict:'arbiter_game_id'})
      if(error)throw new Error(`Stable Arbiter link batch failed: ${error.message}`)
    }

    const log=async(row:any,action:string,outcome:string,gameId:string|null,details:any={})=>{
      responseLogs.push({arbiterGameId:row?.uniqueGameId??null,action,outcome,gameId,...details})
      actionBuffer.push({run_id:runId,arbiter_game_id:row?.uniqueGameId??null,game_id:gameId,action,outcome,details})
      await flushLogs(false)
    }

    const ensureExternal=async(side:any)=>{
      if(side.kind!=='external')return side.id||null
      if(side.id)return side.id
      if(!side.create?.name)return null
      const desiredSlug=side.create.slug
      const {data:existing}=await db.from('external_opponents').select('id').or(`slug.eq.${desiredSlug},name.ilike.${side.create.name}`).limit(1).maybeSingle()
      if(existing?.id)return existing.id
      const {data:created,error}=await db.from('external_opponents').insert({name:side.create.name,slug:desiredSlug,is_section_x:false}).select('id').single()
      if(error){
        const {data:retry}=await db.from('external_opponents').select('id').eq('slug',desiredSlug).maybeSingle()
        if(retry?.id)return retry.id
        throw new Error(`External opponent create failed for ${side.create.name}: ${error.message}`)
      }
      totals.externalCreated++
      return created.id
    }

    const linkPayload=(row:any,gameId:string)=>({
      arbiter_game_id:row.uniqueGameId,
      game_id:gameId,
      last_modified_at:row.lastModifiedDate||null,
      last_seen_at:new Date().toISOString(),
      source_status:row.status||null,
      source_payload:row.sourcePayload||null,
      updated_at:new Date().toISOString()
    })

    const queueLink=async(row:any,gameId:string)=>{
      linkBuffer.push(linkPayload(row,gameId))
      await flushLinks(false)
    }

    const linkImmediate=async(row:any,gameId:string)=>{
      const {error}=await db.from('arbiter_game_links').upsert(linkPayload(row,gameId),{onConflict:'arbiter_game_id'})
      if(error)throw new Error(`Stable Arbiter link failed: ${error.message}`)
    }

    const updateExisting=async(row:any,gameId:string)=>{
      const current=row.existing||null
      const patch:any={}
      if(!current||current.gameDate!==row.date)patch.game_date=row.date
      if(row.time&&String(current?.gameTime||'').slice(0,5)!==row.time)patch.game_time=row.time
      if(meaningfulLocation(row.location)&&clean(current?.location)!==clean(row.location))patch.location=row.location

      if(sourceStatus(row.status)==='Canceled'&&clean(current?.status)!=='canceled'){
        patch.status='Canceled'
      }else if(sourceStatus(row.status)==='Scheduled'&&clean(current?.status)==='canceled'&&['canceled','cancelled','deleted'].includes(clean(row.linked?.sourceStatus))){
        patch.status='Scheduled'
      }

      const desiredContest=contestType(row.type)
      if(clean(current?.contestType||'Game')!==clean(desiredContest))patch.contest_type=desiredContest

      const changed=Object.keys(patch).length>0
      if(changed){
        patch.updated_at=new Date().toISOString()
        const {error}=await db.from('games').update(patch).eq('id',gameId)
        if(error)throw new Error(`Game update failed: ${error.message}`)
        totals.updated++
      }else{
        totals.verifiedStable++
      }

      await queueLink(row,gameId)
      totals.linked++
      await log(row,changed?'update-and-link':'verify-and-link','ok',gameId,{bucket:row.bucket,driftReasons:row.driftReasons||[]})
    }

    const createGame=async(row:any)=>{
      if(!row.sportId||!row.date||row.uniqueGameId==null)throw new Error('Missing sport/date/stable identity for create.')
      const {data:alreadyLinked}=await db.from('arbiter_game_links').select('game_id').eq('arbiter_game_id',row.uniqueGameId).maybeSingle()
      if(alreadyLinked?.game_id){await updateExisting(row,alreadyLinked.game_id);return}

      const homeInternal=row.home.kind==='internal'?row.home.id:null,awayInternal=row.away.kind==='internal'?row.away.id:null
      const homeExternal=row.home.kind==='external'?await ensureExternal(row.home):null,awayExternal=row.away.kind==='external'?await ensureExternal(row.away):null
      if((!homeInternal&&!homeExternal)||(!awayInternal&&!awayExternal))throw new Error('Opponent resolution incomplete during create.')

      const {data:same,error:sameError}=await db.from('games').select('id,game_time,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id').eq('game_date',row.date).eq('sport_id',row.sportId)
      if(sameError)throw new Error(`Duplicate safety check failed: ${sameError.message}`)
      const h=homeInternal?`t:${homeInternal}`:`e:${homeExternal}`,a=awayInternal?`t:${awayInternal}`:`e:${awayExternal}`
      const token=(g:any,home:boolean)=>{const t=home?g.home_team_id:g.away_team_id,e=home?g.external_home_opponent_id:g.external_away_opponent_id;return t?`t:${t}`:e?`e:${e}`:'tba'}
      const teamMatches=(same||[]).filter((g:any)=>(token(g,true)===h&&token(g,false)===a)||(token(g,true)===a&&token(g,false)===h))
      let duplicate:any=null
      if(row.time){
        const exactTime=teamMatches.filter((g:any)=>String(g.game_time||'').slice(0,5)===row.time)
        if(exactTime.length>1)throw new Error('Multiple same-team same-time games already exist; manual reconciliation required.')
        duplicate=exactTime[0]||null
      }else if(teamMatches.length){
        throw new Error('Same teams already play on this date and Arbiter has no reliable time; manual reconciliation required.')
      }
      if(duplicate){
        row.existing={id:duplicate.id,gameTime:duplicate.game_time}
        await updateExisting(row,duplicate.id)
        await log(row,'duplicate-prevented','ok',duplicate.id,{bucket:row.bucket})
        return
      }

      const insert:any={season_id:audit.season.id,sport_id:row.sportId,home_team_id:homeInternal,away_team_id:awayInternal,external_home_opponent_id:homeExternal,external_away_opponent_id:awayExternal,game_date:row.date,game_time:row.time||null,location:meaningfulLocation(row.location)?row.location:null,status:sourceStatus(row.status),verification_status:'Reported',source:'arbiter-api',contest_type:contestType(row.type)}
      const {data:created,error:createError}=await db.from('games').insert(insert).select('id').single()
      if(createError)throw new Error(`Game create failed: ${createError.message}`)
      try{await linkImmediate(row,created.id)}catch(error){await db.from('games').delete().eq('id',created.id);throw error}
      totals.created++;totals.linked++
      await log(row,'create-and-link','ok',created.id,{bucket:row.bucket})
    }

    for(const row of audit.rows){
      if(!row.safelyActionable){
        if(row.bucket==='other-season'){
          totals.ignoredOtherSeason++
          await log(row,'ignore-other-season','skipped',row.existingGameId,{bucket:row.bucket})
        }else{
          totals.quarantined++
          await log(row,'quarantine','skipped',row.existingGameId,{bucket:row.bucket,issues:row.mappingIssues,warnings:row.warnings})
        }
        processed++
        await updateProgress(false)
        continue
      }
      try{
        if(['stable-id-match','stable-id-update','exact-match','probable-match'].includes(row.bucket)){
          if(!row.existingGameId)throw new Error(`${row.bucket} missing existingGameId`)
          await updateExisting(row,row.existingGameId)
        }else{
          await createGame(row)
        }
      }catch(error){
        totals.failed++
        await log(row,'write','failed',row.existingGameId,{bucket:row.bucket,error:error instanceof Error?error.message:String(error)})
      }
      processed++
      await updateProgress(false)
    }

    await flushLinks(true)
    await flushLogs(true)
    await updateProgress(true)

    try{
      const deleted=await arbiterApi.deletedGames(audit.window.start,audit.window.end)
      for(const arbiterId of deletedIds(deleted)){
        const {data:link}=await db.from('arbiter_game_links').select('game_id').eq('arbiter_game_id',arbiterId).maybeSingle()
        if(!link?.game_id)continue
        const {error}=await db.from('games').update({status:'Canceled',updated_at:new Date().toISOString()}).eq('id',link.game_id)
        if(error){totals.failed++;continue}
        await db.from('arbiter_game_links').update({source_status:'Deleted',last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('arbiter_game_id',arbiterId)
        totals.deletedMarked++
        await log({uniqueGameId:arbiterId},'mark-deleted','ok',link.game_id,{source:'Arbiter DeletedGames'})
      }
    }catch(error){
      await log(null,'deleted-games-check','warning',null,{error:error instanceof Error?error.message:String(error)})
    }

    await flushLogs(true)
    const status=totals.failed?'completed-with-errors':'completed'
    await db.from('arbiter_sync_runs').update({status,summary:currentSummary(),finished_at:new Date().toISOString()}).eq('id',runId)

    return NextResponse.json({
      ok:totals.failed===0,
      controlledWrite:true,
      runId,
      season:audit.season,
      window:audit.window,
      totals,
      comparison:audit.comparison,
      actions:responseLogs.slice(0,200),
      note:'Only confidently resolved rows were written. TBA, event sports, title/type conflicts, ambiguous same-day matches, mapping ambiguity, orphaned links, other-season rows, and unlinked cancelled source rows were quarantined or skipped.'
    },{status:totals.failed?207:200})
  }catch(error){
    console.error('Arbiter controlled sync error:',error)
    if(runId)await db.from('arbiter_sync_runs').update({status:'failed',summary:{error:error instanceof Error?error.message:String(error)},finished_at:new Date().toISOString()}).eq('id',runId)
    if(error instanceof ArbiterApiError)return NextResponse.json({ok:false,error:error.message,arbiterStatus:error.status,details:error.details},{status:502})
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
