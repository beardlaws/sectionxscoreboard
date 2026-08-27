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

    let scheduleUpdated=0,linksRefreshed=0,deletedMarked=0
    const scheduleActions:any[]=[]

    for(const row of audit.rows||[]){
      if(!row?.existingGameId||row?.uniqueGameId==null)continue
      if(!['stable-id-match','stable-id-update'].includes(row.bucket))continue

      if(row.bucket==='stable-id-update'&&row.safelyActionable){
        const current:any=row.existing||{}
        const patch:any={}
        if(row.date&&current.gameDate!==row.date)patch.game_date=row.date
        if(row.time&&String(current.gameTime||'').slice(0,5)!==row.time)patch.game_time=row.time
        if(meaningfulLocation(row.location)&&clean(current.location)!==clean(row.location))patch.location=row.location
        if(sourceStatus(row.status)==='Canceled'&&clean(current.status)!=='canceled')patch.status='Canceled'
        else if(sourceStatus(row.status)==='Scheduled'&&clean(current.status)==='canceled'&&['canceled','cancelled','deleted'].includes(clean(row.linked?.sourceStatus)))patch.status='Scheduled'
        const desiredContest=contestType(row.type)
        if(clean(current.contestType||'Game')!==clean(desiredContest))patch.contest_type=desiredContest
        if(Object.keys(patch).length){
          patch.updated_at=new Date().toISOString()
          const {error}=await db.from('games').update(patch).eq('id',row.existingGameId)
          if(error)throw new Error(`Stable schedule update failed for ${row.existingGameId}: ${error.message}`)
          scheduleUpdated++
          scheduleActions.push({arbiterGameId:row.uniqueGameId,gameId:row.existingGameId,patch,driftReasons:row.driftReasons||[]})
        }
      }

      const {error:linkError}=await db.from('arbiter_game_links').upsert({
        arbiter_game_id:row.uniqueGameId,
        game_id:row.existingGameId,
        last_modified_at:row.lastModifiedDate||null,
        last_seen_at:new Date().toISOString(),
        source_status:row.status||null,
        source_payload:row.sourcePayload||null,
        updated_at:new Date().toISOString()
      },{onConflict:'arbiter_game_id'})
      if(linkError)throw new Error(`Stable-link refresh failed: ${linkError.message}`)
      linksRefreshed++
    }

    try{
      const deleted=await arbiterApi.deletedGames(audit.window.start,audit.window.end)
      for(const arbiterId of deletedIds(deleted)){
        const {data:link}=await db.from('arbiter_game_links').select('game_id').eq('arbiter_game_id',arbiterId).maybeSingle()
        if(!link?.game_id)continue
        const {error}=await db.from('games').update({status:'Canceled',updated_at:new Date().toISOString()}).eq('id',link.game_id)
        if(error)continue
        await db.from('arbiter_game_links').update({source_status:'Deleted',last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('arbiter_game_id',arbiterId)
        deletedMarked++
      }
    }catch(error){console.error('Automated deleted-games check warning:',error)}

    const live=await runLiveOperationsCheck(season.id)
    const safeScores=(live.scores.rows||[]).filter((r:any)=>r.safeToApply)
    let scoresUpdated=0,scoreFailures=0
    const scoreActions:any[]=[]
    for(const row of safeScores){
      const patch={home_score:row.arbiter.home,away_score:row.arbiter.away,status:'Final',verification_status:'Reported',source:'arbiter-api',updated_at:new Date().toISOString()}
      const {error}=await db.from('games').update(patch).eq('id',row.gameId)
      if(error){scoreFailures++;scoreActions.push({gameId:row.gameId,arbiterGameId:row.arbiterGameId,outcome:'failed',error:error.message});continue}
      scoresUpdated++
      scoreActions.push({gameId:row.gameId,arbiterGameId:row.arbiterGameId,outcome:'updated',bucket:row.bucket,score:`${row.arbiter.away}-${row.arbiter.home}`})
    }

    const summary={
      season:{id:season.id,name:season.name},
      schedule:{stableLinks:linksRefreshed,updated:scheduleUpdated,deletedMarked,pendingChanges:audit.comparison.pendingChanges||0,quarantined:audit.comparison.quarantined||0,blockers:audit.comparison.trueBlockers||0,actions:scheduleActions.slice(0,50)},
      scores:{updated:scoresUpdated,failed:scoreFailures,conflictsUntouched:live.scores.conflicts||0,reportedNotFinalUntouched:live.scores.counts?.['score-reported-not-final']||0,actions:scoreActions.slice(0,50)},
      rosters:{loaded:live.rosters.loaded,missing:live.rosters.missing,varsityTeams:live.rosters.varsityTeams},
      exceptions:live.exceptions.length
    }
    const status=scoreFailures?'completed-with-errors':'completed'
    await db.from('arbiter_automation_runs').update({status,season_id:season.id,summary,finished_at:new Date().toISOString()}).eq('id',runId)
    return NextResponse.json({ok:scoreFailures===0,automated:true,runId,...summary},{status:scoreFailures?207:200})
  }catch(error){
    const message=error instanceof Error?error.message:String(error)
    console.error('Automated Arbiter pull failed:',error)
    await db.from('arbiter_automation_runs').update({status:'failed',summary:{error:message},finished_at:new Date().toISOString()}).eq('id',runId)
    return NextResponse.json({ok:false,automated:true,runId,error:message},{status:500})
  }
}
