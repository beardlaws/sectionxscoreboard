import { NextRequest, NextResponse } from 'next/server'
import { arbiterApi, ArbiterApiError } from '@/lib/arbiter/client'
import { runScheduleAudit } from '@/lib/arbiter/schedule-intelligence'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const CONFIRMATION = 'APPLY_ARBITER_SCHEDULE_SYNC'

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
    const {data:run,error:runError}=await db.from('arbiter_sync_runs').insert({season_id:audit.season.id,mode:'controlled',window_start:audit.window.start,window_end:audit.window.end,status:'running',summary:{planned:audit.comparison.counts,eligible:audit.comparison.eligible,quarantined:audit.comparison.quarantined}}).select('id').single()
    if(runError)throw new Error(`Could not create sync run: ${runError.message}`)
    runId=run.id
    const totals={linked:0,updated:0,created:0,externalCreated:0,quarantined:0,deletedMarked:0,failed:0}
    const logs:any[]=[]
    const log=async(row:any,action:string,outcome:string,gameId:string|null,details:any={})=>{
      logs.push({arbiterGameId:row?.uniqueGameId??null,action,outcome,gameId,...details})
      const {error}=await db.from('arbiter_sync_actions').insert({run_id:runId,arbiter_game_id:row?.uniqueGameId??null,game_id:gameId,action,outcome,details})
      if(error)console.error('Arbiter sync action log failed',error)
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
    const linkGame=async(row:any,gameId:string)=>{
      const payload={arbiter_game_id:row.uniqueGameId,game_id:gameId,last_modified_at:row.lastModifiedDate||null,last_seen_at:new Date().toISOString(),source_status:row.status||null,source_payload:row.sourcePayload||null,updated_at:new Date().toISOString()}
      const {error}=await db.from('arbiter_game_links').upsert(payload,{onConflict:'arbiter_game_id'})
      if(error)throw new Error(`Stable Arbiter link failed: ${error.message}`)
    }
    const updateExisting=async(row:any,gameId:string)=>{
      const {data:current,error:readError}=await db.from('games').select('id,status,game_date,game_time,location,contest_type').eq('id',gameId).single()
      if(readError)throw new Error(`Existing game lookup failed: ${readError.message}`)
      const patch:any={game_date:row.date,updated_at:new Date().toISOString()}
      if(row.time)patch.game_time=row.time
      if(meaningfulLocation(row.location))patch.location=row.location
      if(sourceStatus(row.status)==='Canceled')patch.status='Canceled'
      if(clean(row.type)==='scrimmage')patch.contest_type='Scrimmage'
      const changed=Object.entries(patch).some(([k,v])=>k!=='updated_at'&&String((current as any)?.[k]??'')!==String(v??''))
      if(changed){const {error}=await db.from('games').update(patch).eq('id',gameId);if(error)throw new Error(`Game update failed: ${error.message}`);totals.updated++}
      await linkGame(row,gameId);totals.linked++
      await log(row,changed?'update-and-link':'link','ok',gameId,{bucket:row.bucket})
    }
    const createGame=async(row:any)=>{
      if(!row.sportId||!row.date||row.uniqueGameId==null)throw new Error('Missing sport/date/stable identity for create.')
      const {data:alreadyLinked}=await db.from('arbiter_game_links').select('game_id').eq('arbiter_game_id',row.uniqueGameId).maybeSingle()
      if(alreadyLinked?.game_id){await updateExisting(row,alreadyLinked.game_id);return}
      const homeInternal=row.home.kind==='internal'?row.home.id:null,awayInternal=row.away.kind==='internal'?row.away.id:null
      const homeExternal=row.home.kind==='external'?await ensureExternal(row.home):null,awayExternal=row.away.kind==='external'?await ensureExternal(row.away):null
      if((!homeInternal&&!homeExternal)||(!awayInternal&&!awayExternal))throw new Error('Opponent resolution incomplete during create.')
      const {data:same,error:sameError}=await db.from('games').select('id,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id').eq('game_date',row.date).eq('sport_id',row.sportId)
      if(sameError)throw new Error(`Duplicate safety check failed: ${sameError.message}`)
      const h=homeInternal?`t:${homeInternal}`:`e:${homeExternal}`,a=awayInternal?`t:${awayInternal}`:`e:${awayExternal}`
      const token=(g:any,home:boolean)=>{const t=home?g.home_team_id:g.away_team_id,e=home?g.external_home_opponent_id:g.external_away_opponent_id;return t?`t:${t}`:e?`e:${e}`:'tba'}
      const duplicate=(same||[]).find((g:any)=>(token(g,true)===h&&token(g,false)===a)||(token(g,true)===a&&token(g,false)===h))
      if(duplicate){await updateExisting(row,duplicate.id);await log(row,'duplicate-prevented','ok',duplicate.id,{bucket:row.bucket});return}
      const insert:any={season_id:audit.season.id,sport_id:row.sportId,home_team_id:homeInternal,away_team_id:awayInternal,external_home_opponent_id:homeExternal,external_away_opponent_id:awayExternal,game_date:row.date,game_time:row.time||null,location:meaningfulLocation(row.location)?row.location:null,status:sourceStatus(row.status),verification_status:'Reported',source:'arbiter-api',contest_type:contestType(row.type)}
      const {data:created,error:createError}=await db.from('games').insert(insert).select('id').single()
      if(createError)throw new Error(`Game create failed: ${createError.message}`)
      try{await linkGame(row,created.id)}catch(error){await db.from('games').delete().eq('id',created.id);throw error}
      totals.created++;totals.linked++
      await log(row,'create-and-link','ok',created.id,{bucket:row.bucket})
    }

    for(const row of audit.rows){
      if(!row.safelyActionable){totals.quarantined++;await log(row,'quarantine','skipped',row.existingGameId,{bucket:row.bucket,issues:row.mappingIssues,warnings:row.warnings});continue}
      try{
        if(row.bucket==='stable-id-match'||row.bucket==='exact-match'||row.bucket==='probable-match'){
          if(!row.existingGameId)throw new Error(`${row.bucket} missing existingGameId`)
          await updateExisting(row,row.existingGameId)
        }else await createGame(row)
      }catch(error){totals.failed++;await log(row,'write','failed',row.existingGameId,{bucket:row.bucket,error:error instanceof Error?error.message:String(error)})}
    }

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
    }catch(error){await log(null,'deleted-games-check','warning',null,{error:error instanceof Error?error.message:String(error)})}

    const status=totals.failed?'completed-with-errors':'completed'
    await db.from('arbiter_sync_runs').update({status,summary:{...totals,planned:audit.comparison.counts},finished_at:new Date().toISOString()}).eq('id',runId)
    return NextResponse.json({ok:totals.failed===0,controlledWrite:true,runId,season:audit.season,window:audit.window,totals,comparison:audit.comparison,actions:logs.slice(0,200),note:'Only confidently resolved rows were written. TBA, event sports, mapping ambiguity, orphaned links, and unlinked cancelled source rows were quarantined.'},{status:totals.failed?207:200})
  }catch(error){
    console.error('Arbiter controlled sync error:',error)
    if(runId)await db.from('arbiter_sync_runs').update({status:'failed',summary:{error:error instanceof Error?error.message:String(error)},finished_at:new Date().toISOString()}).eq('id',runId)
    if(error instanceof ArbiterApiError)return NextResponse.json({ok:false,error:error.message,arbiterStatus:error.status,details:error.details},{status:502})
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
