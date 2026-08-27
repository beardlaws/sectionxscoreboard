import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runLiveOperationsCheck } from '@/lib/arbiter/live-operations'

export const dynamic='force-dynamic'
export const maxDuration=300
const CONFIRM='APPLY_ARBITER_SCORE_SYNC'

export async function POST(req:NextRequest){
  const db=createAdminClient()
  try{
    const body=await req.json().catch(()=>({}))
    if(body?.confirm!==CONFIRM)return NextResponse.json({ok:false,error:'Explicit score sync confirmation required.',requiredConfirmation:CONFIRM},{status:400})
    const check=await runLiveOperationsCheck(body?.seasonId||null)
    const candidates=(check.scores.rows||[]).filter((r:any)=>r.safeToApply)
    const results:any[]=[]
    let updated=0,failed=0
    for(const row of candidates){
      const patch={home_score:row.arbiter.home,away_score:row.arbiter.away,status:'Final',verification_status:'Reported',source:'arbiter-api',updated_at:new Date().toISOString()}
      const {error}=await db.from('games').update(patch).eq('id',row.gameId)
      if(error){failed++;results.push({gameId:row.gameId,arbiterGameId:row.arbiterGameId,action:row.bucket,outcome:'failed',error:error.message});continue}
      updated++;results.push({gameId:row.gameId,arbiterGameId:row.arbiterGameId,action:row.bucket,outcome:'updated',score:`${row.arbiter.away}-${row.arbiter.home}`})
    }
    return NextResponse.json({ok:failed===0,controlledWrite:true,updated,failed,conflictsUntouched:check.scores.conflicts,reportedNotFinalUntouched:check.scores.counts?.['score-reported-not-final']||0,results},{status:failed?207:200})
  }catch(error){
    console.error('Controlled Arbiter score sync failed:',error)
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
