import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req:NextRequest){
  const seasonId=req.nextUrl.searchParams.get('seasonId')
  if(!seasonId) return NextResponse.json({ok:false,error:'seasonId is required'},{status:400})
  const db=createAdminClient()
  const limit=Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')||10),1),50)
  try{
    const [{data:checks,error:checkError},{data:runs,error:runError}]=await Promise.all([
      db.from('arbiter_health_checks')
        .select('id,status,summary,changes,quarantines,created_at')
        .eq('season_id',seasonId)
        .order('created_at',{ascending:false})
        .limit(limit),
      db.from('arbiter_sync_runs')
        .select('id,status,summary,created_at,finished_at')
        .eq('season_id',seasonId)
        .order('created_at',{ascending:false})
        .limit(limit),
    ])
    if(checkError) throw new Error(`Could not load health checks: ${checkError.message}`)
    if(runError) throw new Error(`Could not load sync runs: ${runError.message}`)
    return NextResponse.json({ok:true,checks:checks||[],runs:runs||[]})
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
