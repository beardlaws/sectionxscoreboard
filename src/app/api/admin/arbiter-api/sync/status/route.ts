import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req:NextRequest){
  const seasonId=req.nextUrl.searchParams.get('seasonId')
  if(!seasonId)return NextResponse.json({ok:false,error:'seasonId is required'},{status:400})

  const db=createAdminClient()
  const {data,error}=await db
    .from('arbiter_sync_runs')
    .select('id,season_id,mode,status,summary,created_at,finished_at,window_start,window_end')
    .eq('season_id',seasonId)
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle()

  if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
  if(!data)return NextResponse.json({ok:true,run:null})

  return NextResponse.json({
    ok:true,
    run:{
      id:data.id,
      seasonId:data.season_id,
      mode:data.mode,
      status:data.status,
      summary:data.summary||{},
      createdAt:data.created_at,
      finishedAt:data.finished_at,
      window:{start:data.window_start,end:data.window_end},
      isRunning:data.status==='running'
    }
  })
}
