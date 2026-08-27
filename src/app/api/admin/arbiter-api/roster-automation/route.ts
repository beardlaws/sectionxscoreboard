import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic='force-dynamic'

const STALE_MINUTES=12
const nowIso=()=>new Date().toISOString()
const heartbeatMs=(run:any)=>new Date(run?.summary?.progress?.heartbeatAt||run?.started_at||0).getTime()
const isStale=(run:any)=>Date.now()-heartbeatMs(run)>STALE_MINUTES*60_000

export async function GET(){
  const db=createAdminClient()
  const {data,error}=await db.from('arbiter_roster_automation_runs').select('id,season_id,trigger_source,status,summary,started_at,finished_at').order('started_at',{ascending:false}).limit(5)
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
  return NextResponse.json({ok:true,runs:data||[]})
}

export async function POST(){
  const db=createAdminClient()
  const {data:running,error:runningError}=await db.from('arbiter_roster_automation_runs').select('id,status,summary,started_at').eq('status','running').order('started_at',{ascending:false}).limit(1).maybeSingle()
  if(runningError)return NextResponse.json({ok:false,error:runningError.message},{status:500})
  if(running?.id&&!isStale(running))return NextResponse.json({ok:false,error:'Roster automation is already running.',runId:running.id,progress:running.summary?.progress||{}},{status:409})
  if(running?.id&&isStale(running)){
    const summary={...(running.summary||{}),error:'Previous roster run exceeded the heartbeat window and was automatically retired.',stale:true,staleDetectedAt:nowIso(),progress:{...(running.summary?.progress||{}),phase:'stale',heartbeatAt:running.summary?.progress?.heartbeatAt||running.started_at}}
    const {error:staleError}=await db.from('arbiter_roster_automation_runs').update({status:'failed',summary,finished_at:nowIso()}).eq('id',running.id).eq('status','running')
    if(staleError)return NextResponse.json({ok:false,error:`Could not retire stale roster run: ${staleError.message}`},{status:500})
  }
  const requestedAt=nowIso()
  const {data:requestId,error}=await db.rpc('trigger_sectionx_arbiter_rosters')
  if(error)return NextResponse.json({ok:false,error:`Could not trigger roster automation: ${error.message}`},{status:500})
  return NextResponse.json({ok:true,queued:true,requestId,requestedAt,retiredStaleRun:running?.id||null})
}
