import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { runLiveOperationsCheck } from '@/lib/arbiter/live-operations'

export const dynamic='force-dynamic'
export const maxDuration=300
const CONFIRM='APPLY_ARBITER_SCORE_SYNC'

export async function POST(req:NextRequest){
  try{
    const body=await req.json().catch(()=>({}))
    if(body?.confirm!==CONFIRM)return NextResponse.json({ok:false,error:'Explicit score sync confirmation required.',requiredConfirmation:CONFIRM},{status:400})
    const check=await runLiveOperationsCheck(body?.seasonId||null)
    const candidates=(check.scores.rows||[]).filter((r:any)=>r.safeToApply)
    const {env}=getCloudflareContext(),db=(env as any).DB
    if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
    const results:any[]=[]
    let updated=0,failed=0
    for(const row of candidates){
      try{
        await db.prepare("UPDATE games SET home_score=?,away_score=?,status='Final',verification_status='Reported',source='arbiter-api',updated_at=datetime('now') WHERE id=?")
          .bind(row.arbiter.home,row.arbiter.away,row.gameId).run()
        updated++
        results.push({gameId:row.gameId,arbiterGameId:row.arbiterGameId,action:row.bucket,outcome:'updated',score:`${row.arbiter.away}-${row.arbiter.home}`})
      }catch(e:any){
        failed++
        results.push({gameId:row.gameId,arbiterGameId:row.arbiterGameId,action:row.bucket,outcome:'failed',error:e?.message||'D1 update failed'})
      }
    }
    return NextResponse.json({ok:failed===0,controlledWrite:true,backend:'cloudflare-d1',updated,failed,conflictsUntouched:check.scores.conflicts,reportedNotFinalUntouched:check.scores.counts?.['score-reported-not-final']||0,results},{status:failed?207:200})
  }catch(error){
    console.error('Controlled Arbiter score sync failed:',error)
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
