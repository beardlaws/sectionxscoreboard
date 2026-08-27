import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic='force-dynamic'

export async function GET(){
  const db=createAdminClient()
  const {data,error}=await db.from('arbiter_roster_automation_runs').select('id,season_id,trigger_source,status,summary,started_at,finished_at').order('started_at',{ascending:false}).limit(5)
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
  return NextResponse.json({ok:true,runs:data||[]})
}

export async function POST(){
  const db=createAdminClient()
  const cutoff=new Date(Date.now()-20*60_000).toISOString()
  const {data:running,error:runningError}=await db.from('arbiter_roster_automation_runs').select('id,started_at').eq('status','running').gte('started_at',cutoff).order('started_at',{ascending:false}).limit(1).maybeSingle()
  if(runningError)return NextResponse.json({ok:false,error:runningError.message},{status:500})
  if(running?.id)return NextResponse.json({ok:false,error:'Roster automation is already running.',runId:running.id},{status:409})
  const requestedAt=new Date().toISOString()
  const {data:requestId,error}=await db.rpc('trigger_sectionx_arbiter_rosters')
  if(error)return NextResponse.json({ok:false,error:`Could not trigger roster automation: ${error.message}`},{status:500})
  return NextResponse.json({ok:true,queued:true,requestId,requestedAt})
}
